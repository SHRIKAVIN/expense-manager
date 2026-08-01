import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  expenseId?: string;
  relatedExpenseIds?: string[];
  amount?: number;
  currency?: string;
  payeeVpa?: string;
  payeeName?: string;
  note?: string;
  preferredApp?: string;
};

function cryptoTxnId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `EM${hex}`.slice(0, 35);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const expenseId = body.expenseId?.trim();
  const amount = Number(body.amount);
  const payeeVpa = body.payeeVpa?.trim().toLowerCase();
  if (!expenseId || !(amount > 0) || !payeeVpa) {
    return new Response("expenseId, amount, and payeeVpa are required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const related = (body.relatedExpenseIds ?? []).filter((id) => id && id !== expenseId);
  const transactionId = cryptoTxnId();
  const currency = (body.currency ?? "INR").toUpperCase();
  const payeeName = (body.payeeName ?? "Payee").trim() || "Payee";
  const note = (body.note ?? "Reimbursement").trim().slice(0, 80);

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
      preferred_app: body.preferredApp ?? null,
      note,
      status: "PENDING",
    })
    .select("transaction_id, amount, currency, payee_vpa, note, status, created_at")
    .single();

  if (error || !data) {
    return new Response(error?.message ?? "Could not create payment", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // SECURITY: Response is intentionally limited — no service keys, no bank secrets.
  const payload = {
    transactionId: data.transaction_id as string,
    amount: Number(data.amount),
    currency: data.currency as string,
    payeeVpa: data.payee_vpa as string,
    payeeName,
    note: (data.note as string) || note,
    status: data.status as string,
    createdAt: data.created_at as string,
  };

  return new Response(JSON.stringify(payload), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
