import type { CreatePaymentInput, PaymentIntent, PaymentProvider } from "./types";
import { buildCheckoutUpiQuery } from "./upiCheckoutLinks";
import {
  assertPayeeVpa,
  isValidUpiId as isValidUpiVpa,
  toNpciVpa,
} from "./upiVpa";

export type UpiApp = NonNullable<CreatePaymentInput["preferredApp"]>;

export { assertPayeeVpa };

/** True for a complete VPA like name@oksbi (empty string is not valid). */
export function isValidUpiId(upi: string): boolean {
  return isValidUpiVpa(upi);
}

/** Soft normalize for forms — never throws (empty input stays empty). */
export function normalizeUpiId(upi: string): string {
  const trimmed = upi.trim();
  if (!trimmed) return "";
  return toNpciVpa(trimmed);
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Stable-enough txn ref for our ledger (not sent in WhatsApp deep links). */
export function createUpiTxnId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `EM${Date.now().toString(36)}${rand}`.slice(0, 35);
}

function androidIntentPay(query: string, pkg: string): string {
  return (
    `intent://pay?${query}` +
    `#Intent;scheme=upi;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;package=${pkg};end`
  );
}

/**
 * WhatsApp Pay deep link — no description (`tn`).
 */
export function buildUpiPayUri(input: CreatePaymentInput): string {
  const query = buildCheckoutUpiQuery({
    payeeVpa: input.payeeUpi,
    payeeName: input.payeeName,
    amount: input.amount,
    currency: input.currency,
    transactionId: input.transactionId?.trim() || createUpiTxnId(),
  });

  if (isAndroid()) {
    return androidIntentPay(query, "com.whatsapp");
  }

  return `upi://pay?${query}`;
}

/**
 * Must run in the same user-gesture turn as the tap (no await before this),
 * or mobile browsers may refuse to open the UPI app.
 */
export function launchUpiUri(uri: string): void {
  window.location.href = uri;
}

/** Build + open a WhatsApp Pay deep link (sync — keep inside the tap). */
export function openUpi(
  app: UpiApp,
  input: Omit<CreatePaymentInput, "preferredApp">,
): PaymentIntent {
  const intent = createUpiIntent({ ...input, preferredApp: app });
  launchUpiUri(intent.uri);
  return intent;
}

export function createUpiIntent(input: CreatePaymentInput): PaymentIntent {
  const uri = buildUpiPayUri(input);
  return {
    providerId: "upi",
    uri,
    amount: input.amount,
    currency: (input.currency ?? "INR").toUpperCase(),
    payeeName: input.payeeName.trim() || "Payee",
    payeeUpi: assertPayeeVpa(input.payeeUpi),
    note: input.note?.trim(),
  };
}

export const upiPaymentProvider: PaymentProvider = {
  id: "upi",
  async createIntent(input) {
    return createUpiIntent(input);
  },
  async launch(intent) {
    launchUpiUri(intent.uri);
  },
};
