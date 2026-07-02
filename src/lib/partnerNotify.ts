import { getReimbursementPartner, isQuickSwitchEmail } from "@/auth/quickSwitch";
import { formatCurrency } from "@/lib/format";
import { isSupabaseEnabled, getSupabase } from "@/lib/supabase/client";
import { invokePartnerWebPush } from "@/lib/webPush";
import type { Expense, ReimbursementRequest, SessionUser } from "@/lib/types";

export type PartnerNotificationKind =
  | "expense_added"
  | "reimbursement_requested"
  | "reimbursement_marked_paid"
  | "reimbursement_confirmed"
  | "reimbursement_rejected";

const PARTNER_ALERTS_KEY = "em.partnerAlerts";

export function partnerAlertsEnabled(userId: string): boolean {
  try {
    const v = localStorage.getItem(`${PARTNER_ALERTS_KEY}.${userId}`);
    return v === "1";
  } catch {
    return false;
  }
}

export function setPartnerAlertsEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(`${PARTNER_ALERTS_KEY}.${userId}`, enabled ? "1" : "0");
  } catch {
    /* no-op */
  }
}

async function sendPartnerNotification(input: {
  recipientEmail: string;
  actorName: string;
  title: string;
  body: string;
  kind: PartnerNotificationKind;
}) {
  if (!isSupabaseEnabled()) return;
  const sb = getSupabase();
  const { error } = await sb.from("partner_notifications").insert({
    recipient_email: input.recipientEmail.toLowerCase(),
    actor_name: input.actorName,
    title: input.title,
    body: input.body,
    kind: input.kind,
  });
  if (error) {
    console.warn("Partner notification failed:", error.message);
    return;
  }
  void invokePartnerWebPush({
    recipientEmail: input.recipientEmail,
    title: input.title,
    body: input.body,
  });
}

function actorName(user: SessionUser): string {
  return user.displayName?.trim() || user.email.split("@")[0] || "User";
}

function partnerFor(user: SessionUser) {
  if (!isQuickSwitchEmail(user.email)) return null;
  return getReimbursementPartner(user.email);
}

export async function notifyPartnerExpenseAdded(
  user: SessionUser,
  expense: Expense,
  isReimbursement: boolean,
) {
  const partner = partnerFor(user);
  if (!partner) return;
  const name = actorName(user);
  const amount = formatCurrency(expense.amount, user.currency);

  if (isReimbursement) {
    await sendPartnerNotification({
      recipientEmail: partner.email,
      actorName: name,
      title: `${name} requested reimbursement`,
      body: `${amount} for ${expense.merchant} — tap to review`,
      kind: "reimbursement_requested",
    });
    return;
  }

  await sendPartnerNotification({
    recipientEmail: partner.email,
    actorName: name,
    title: `${name} added an expense`,
    body: `${amount} at ${expense.merchant}`,
    kind: "expense_added",
  });
}

export async function notifyPartnerReimbursementMarkedPaid(
  user: SessionUser,
  req: ReimbursementRequest,
) {
  if (req.payerEmail.toLowerCase() !== user.email.toLowerCase()) return;
  const partner = partnerFor(user);
  if (!partner) return;
  const name = actorName(user);
  const amount = formatCurrency(req.amount, user.currency);

  await sendPartnerNotification({
    recipientEmail: partner.email,
    actorName: name,
    title: `${name} marked a reimbursement paid`,
    body: `${amount} for ${req.merchant} — confirm you received it`,
    kind: "reimbursement_marked_paid",
  });
}

export async function notifyPartnerReimbursementConfirmed(
  user: SessionUser,
  req: ReimbursementRequest,
) {
  const partner = partnerFor(user);
  if (!partner || req.requesterId !== user.id) return;
  const name = actorName(user);
  const amount = formatCurrency(req.amount, user.currency);

  await sendPartnerNotification({
    recipientEmail: partner.email,
    actorName: name,
    title: `${name} confirmed reimbursement`,
    body: `${amount} for ${req.merchant} was received`,
    kind: "reimbursement_confirmed",
  });
}

export async function notifyPartnerReimbursementRejected(
  user: SessionUser,
  req: ReimbursementRequest,
) {
  const partner = partnerFor(user);
  if (!partner || req.requesterId !== user.id) return;
  const name = actorName(user);
  const amount = formatCurrency(req.amount, user.currency);

  await sendPartnerNotification({
    recipientEmail: partner.email,
    actorName: name,
    title: `${name} has not received payment yet`,
    body: `${amount} for ${req.merchant} — please pay again when ready`,
    kind: "reimbursement_rejected",
  });
}
