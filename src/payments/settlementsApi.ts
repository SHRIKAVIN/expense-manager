import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";
import { toSettlement } from "@/lib/supabase/mappers";
import type { Settlement, SettlementMethod, SettlementStatus } from "@/lib/types";

export interface PartnerPaymentInfo {
  id: string;
  email: string;
  displayName: string;
  upiId?: string;
  phone?: string;
}

export async function fetchPartnerPaymentInfo(
  partnerEmail: string,
): Promise<PartnerPaymentInfo | null> {
  if (!isSupabaseEnabled()) return null;
  const { data, error } = await getSupabase().rpc("get_partner_payment_info", {
    partner_email: partnerEmail.toLowerCase(),
  });
  if (error) {
    console.warn("get_partner_payment_info:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: (row.display_name as string) || (row.email as string),
    upiId: (row.upi_id as string | null)?.trim() || undefined,
    phone: (row.phone as string | null)?.trim() || undefined,
  };
}

export async function createSettlement(input: {
  reimbursementRequestId: string;
  payerId: string;
  payeeId: string;
  payerName: string;
  payeeName: string;
  merchant?: string;
  amount: number;
  method?: SettlementMethod;
  note?: string;
  status?: SettlementStatus;
}): Promise<Settlement> {
  if (!isSupabaseEnabled()) throw new Error("Supabase is required for settlements.");
  const now = new Date().toISOString();
  const status = input.status ?? "payer_confirmed";
  const { data, error } = await getSupabase()
    .from("settlements")
    .insert({
      reimbursement_request_id: input.reimbursementRequestId,
      payer_id: input.payerId,
      payee_id: input.payeeId,
      payer_name: input.payerName,
      payee_name: input.payeeName,
      merchant: input.merchant ?? null,
      amount: input.amount,
      method: input.method ?? "upi",
      note: input.note?.trim() || null,
      status,
      settled_at: status === "payer_confirmed" ? now : null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save settlement.");
  return toSettlement(data);
}

export async function listSettlements(): Promise<Settlement[]> {
  if (!isSupabaseEnabled()) return [];
  const { data, error } = await getSupabase()
    .from("settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSettlement);
}
