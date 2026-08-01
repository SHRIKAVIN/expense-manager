import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bank-webhook-secret",
};

type Body = {
  merchant_tran_id?: string;
  amount?: number | string;
  currency?: string;
  bank_reference?: string;
  status?: string;
};

/**
 * Simulated corporate bank UPI credit webhook (ICICI/Axis-style ledger hook).
 *
 * SECURITY:
 * - Authenticate with BANK_WEBHOOK_SECRET (header x-bank-webhook-secret).
 * - Never expose this secret to the PWA.
 * - Treat client-reported "Payment successful" as UX only; this endpoint is source of truth.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const expected = Deno.env.get("BANK_WEBHOOK_SECRET");
  const provided = req.headers.get("x-bank-webhook-secret");
  if (!expected || !provided || provided !== expected) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const merchantTranId = body.merchant_tran_id?.trim();
  const amount = Number(body.amount);
  if (!merchantTranId || !(amount > 0)) {
    return new Response("merchant_tran_id and amount required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { data: tx, error: txErr } = await admin
    .from("upi_payment_transactions")
    .select("*")
    .eq("transaction_id", merchantTranId)
    .maybeSingle();

  if (txErr) {
    return new Response(txErr.message, { status: 500, headers: corsHeaders });
  }
  if (!tx) {
    // Ack 200 so banks don't infinite-retry unknown ids in some setups;
    // log and return ok:false for operators.
    return new Response(JSON.stringify({ ok: false, reason: "unknown_transaction" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectedAmount = Number(tx.amount);
  if (Math.abs(expectedAmount - amount) > 0.009) {
    return new Response(JSON.stringify({ ok: false, reason: "amount_mismatch" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (tx.status === "PAID") {
    return new Response(JSON.stringify({ ok: true, status: "PAID", idempotent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("upi_payment_transactions")
    .update({
      status: "PAID",
      bank_reference: body.bank_reference ?? null,
      paid_at: now,
      updated_at: now,
    })
    .eq("transaction_id", merchantTranId)
    .eq("status", "PENDING");

  if (updErr) {
    return new Response(updErr.message, { status: 500, headers: corsHeaders });
  }

  const ids = [tx.expense_id as string, ...((tx.related_expense_ids as string[]) ?? [])];
  for (const requestId of [...new Set(ids)]) {
    // Reuse existing RPC — marks awaiting_confirmation on the reimbursement.
    const { error: markErr } = await admin.rpc("mark_reimbursement_paid", {
      request_id: requestId,
    });
    if (markErr) {
      console.error("mark_reimbursement_paid failed", requestId, markErr.message);
    }
  }

  return new Response(JSON.stringify({ ok: true, status: "PAID" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
