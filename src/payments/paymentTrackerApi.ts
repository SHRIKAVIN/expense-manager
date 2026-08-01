import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
} from "./trackerTypes";

/**
 * Client for the payment tracker API.
 *
 * Prefer Supabase Edge Functions in this repo. Optionally set
 * VITE_PAYMENTS_API_BASE to an Express host that implements the same routes
 * under /api/v1/...
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

async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseEnabled()) return {};
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (anon) headers.apikey = anon;
  return headers;
}

export async function createTrackedPayment(
  input: CreatePaymentRequest,
): Promise<CreatePaymentResponse> {
  const base = paymentsApiBase();
  if (!base) throw new Error("Payments API is not configured.");

  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };

  // Edge Function name vs Express path
  const url = base.includes("/functions/v1")
    ? `${base}/payments-create`
    : `${base}/api/v1/payments/create`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not create payment (${res.status})`);
  }
  return (await res.json()) as CreatePaymentResponse;
}

export async function fetchPaymentStatus(
  transactionId: string,
): Promise<PaymentStatusResponse> {
  const base = paymentsApiBase();
  if (!base) throw new Error("Payments API is not configured.");

  const headers = await authHeader();
  const url = base.includes("/functions/v1")
    ? `${base}/payments-status?transactionId=${encodeURIComponent(transactionId)}`
    : `${base}/api/v1/payments/status/${encodeURIComponent(transactionId)}`;

  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not fetch payment status (${res.status})`);
  }
  return (await res.json()) as PaymentStatusResponse;
}
