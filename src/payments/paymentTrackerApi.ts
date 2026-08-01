import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
} from "./trackerTypes";

/**
 * Client for the payment tracker API.
 *
 * SECURITY: Do not send service-role keys or bank webhook secrets from here.
 */

function paymentsApiBase(): string | null {
  const custom = import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined;
  if (custom?.trim()) return custom.replace(/\/$/, "");
  const sb = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (sb?.trim()) return `${sb.replace(/\/$/, "")}/functions/v1`;
  return null;
}

/** Ensure we have a fresh access token (iOS PWA sessions go stale often). */
async function requireAccessToken(): Promise<string> {
  if (!isSupabaseEnabled()) throw new Error("Supabase is not configured.");
  const sb = getSupabase();

  let { data } = await sb.auth.getSession();
  if (!data.session?.access_token) {
    const refreshed = await sb.auth.refreshSession();
    data = refreshed.data;
  } else {
    // Proactively refresh if expiring within 2 minutes.
    const exp = data.session.expires_at ?? 0;
    if (exp * 1000 < Date.now() + 120_000) {
      const refreshed = await sb.auth.refreshSession();
      if (refreshed.data.session) data = refreshed.data;
    }
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Please sign in again — session expired on this device.");
  }
  return token;
}

export async function createTrackedPayment(
  input: CreatePaymentRequest,
): Promise<CreatePaymentResponse> {
  if (!isSupabaseEnabled()) throw new Error("Payments API is not configured.");

  // Prefer invoke — attaches the user JWT the same way as other Supabase calls.
  // Manual fetch often returns Unauthorized on iOS PWAs when getSession() is stale.
  if (!import.meta.env.VITE_PAYMENTS_API_BASE) {
    const token = await requireAccessToken();
    const { data, error } = await getSupabase().functions.invoke("payments-create", {
      body: input,
      // Explicit JWT — invoke may otherwise send a stale/anon token on iOS PWA.
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      let detail = error.message || "Could not create payment";
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        try {
          const bodyText = await ctx.clone().text();
          if (bodyText) {
            try {
              const parsed = JSON.parse(bodyText) as { error?: string };
              detail = parsed.error || bodyText;
            } catch {
              detail = bodyText;
            }
          }
        } catch {
          /* keep detail */
        }
      }
      if (/401|unauthorized/i.test(detail)) {
        throw new Error("Please sign in again — session expired on this device.");
      }
      throw new Error(detail);
    }
    if (!data) throw new Error("Could not create payment");
    if (typeof data === "object" && data && "error" in data && !("transactionId" in data)) {
      throw new Error(String((data as { error: unknown }).error));
    }
    return data as CreatePaymentResponse;
  }

  const base = paymentsApiBase();
  if (!base) throw new Error("Payments API is not configured.");
  const token = await requireAccessToken();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${base}/api/v1/payments/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("Please sign in again — session expired on this device.");
    }
    throw new Error(text || `Could not create payment (${res.status})`);
  }
  return (await res.json()) as CreatePaymentResponse;
}

export async function fetchPaymentStatus(
  transactionId: string,
): Promise<PaymentStatusResponse> {
  // Prefer direct PostgREST (RLS) — Edge Function cold starts are 2–4s+.
  if (isSupabaseEnabled() && !import.meta.env.VITE_PAYMENTS_API_BASE) {
    await requireAccessToken();
    const { data, error } = await getSupabase()
      .from("upi_payment_transactions")
      .select("transaction_id, expense_id, amount, currency, status, paid_at, updated_at")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Payment not found");
    return {
      transactionId: data.transaction_id as string,
      expenseId: data.expense_id as string,
      amount: Number(data.amount),
      currency: data.currency as string,
      status: data.status as PaymentStatusResponse["status"],
      paidAt: (data.paid_at as string | null) ?? null,
      updatedAt: data.updated_at as string,
    };
  }

  const base = paymentsApiBase();
  if (!base) throw new Error("Payments API is not configured.");
  const token = await requireAccessToken();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(
    `${base}/api/v1/payments/status/${encodeURIComponent(transactionId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not fetch payment status (${res.status})`);
  }
  return (await res.json()) as PaymentStatusResponse;
}
