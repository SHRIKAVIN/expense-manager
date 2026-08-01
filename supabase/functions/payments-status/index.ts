import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const transactionId = url.searchParams.get("transactionId")?.trim();
  if (!transactionId) {
    return new Response("transactionId required", { status: 400, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // RLS: payer can only read own rows.
  const { data, error } = await userClient
    .from("upi_payment_transactions")
    .select("transaction_id, expense_id, amount, currency, status, paid_at, updated_at")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error) {
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
  if (!data) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      transactionId: data.transaction_id,
      expenseId: data.expense_id,
      amount: Number(data.amount),
      currency: data.currency,
      status: data.status,
      paidAt: data.paid_at,
      updatedAt: data.updated_at,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
