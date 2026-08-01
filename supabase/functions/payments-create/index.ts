// @ts-nocheck — Deno Edge Function (not part of the Vite/DOM TypeScript project).
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * POST /functions/v1/payments-create
 *
 * Creates a PENDING row in upi_payment_transactions for direct UPI settle-up.
 * Auth: Bearer user access token (validated via Auth API with service role).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cryptoTxnId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return `EM${hex}`.slice(0, 35);
}

function extractJwt(req) {
  const raw =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  const token = match && match[1] ? match[1].trim() : "";
  // User JWTs are three-part; reject empty / anon-key shaped values.
  if (!token || token.split(".").length < 3) return null;
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const jwt = extractJwt(req);
    if (!jwt) {
      return json({ error: "Unauthorized — missing Bearer token" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(jwt);

    if (userErr || !user) {
      console.error("payments-create getUser:", userErr?.message ?? "no user");
      return json({ error: "Unauthorized — invalid or expired session" }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const expenseId = body.expenseId?.trim();
    const amount = Number(body.amount);
    const payeeVpa = body.payeeVpa?.trim().toLowerCase();
    if (!expenseId || !(amount > 0) || !payeeVpa) {
      return json({ error: "expenseId, amount, and payeeVpa are required" }, 400);
    }
    if (!payeeVpa.includes("@") || payeeVpa.endsWith("@upi")) {
      return json({ error: "payeeVpa must be a full UPI ID (e.g. name@ybl)" }, 400);
    }

    const { data: reimb, error: reimbErr } = await admin
      .from("reimbursement_requests")
      .select("id, amount, payer_email, status")
      .eq("id", expenseId)
      .maybeSingle();

    if (reimbErr) {
      return json({ error: reimbErr.message }, 500);
    }
    if (!reimb) {
      return json({ error: "Reimbursement not found" }, 404);
    }
    if (reimb.status !== "pending") {
      return json({ error: "Reimbursement is not awaiting payment" }, 409);
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return json({ error: profileErr.message }, 500);
    }

    const payerEmail = (profile?.email || "").toLowerCase().trim();
    const reimbPayer = String(reimb.payer_email || "")
      .toLowerCase()
      .trim();
    if (!payerEmail || payerEmail !== reimbPayer) {
      return json(
        { error: "Forbidden — you are not the payer for this reimbursement" },
        403,
      );
    }

    const related = (body.relatedExpenseIds || []).filter((id) => id && id !== expenseId);
    const transactionId = cryptoTxnId();
    const currency = (body.currency || "INR").toUpperCase();
    const payeeName = (body.payeeName || "Payee").trim() || "Payee";
    const note = (body.note || "Reimbursement").trim().slice(0, 80);

    const { data, error } = await admin
      .from("upi_payment_transactions")
      .insert({
        transaction_id: transactionId,
        expense_id: expenseId,
        related_expense_ids: related,
        payer_id: user.id,
        payee_vpa: payeeVpa,
        amount,
        currency,
        preferred_app: body.preferredApp || null,
        note,
        status: "PENDING",
      })
      .select("transaction_id, amount, currency, payee_vpa, note, status, created_at")
      .single();

    if (error || !data) {
      console.error("payments-create insert:", error?.message);
      return json({ error: error?.message || "Could not create payment" }, 500);
    }

    return json({
      transactionId: data.transaction_id,
      amount: Number(data.amount),
      currency: data.currency,
      payeeVpa: data.payee_vpa,
      payeeName,
      note: data.note || note,
      status: data.status,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error("payments-create unhandled:", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
});
