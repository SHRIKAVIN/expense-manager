import type { CreatePaymentInput, PaymentIntent, PaymentProvider } from "./types";

/** Basic UPI VPA: local@handle (letters, digits, ., _, -). */
const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export type UpiApp = NonNullable<CreatePaymentInput["preferredApp"]>;

export function isValidUpiId(upi: string): boolean {
  return UPI_VPA_RE.test(upi.trim());
}

export function normalizeUpiId(upi: string): string {
  return upi.trim().toLowerCase();
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Stable-enough txn ref for UPI `tr` (max ~35 chars commonly accepted). */
export function createUpiTxnId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `EM${Date.now().toString(36)}${rand}`.slice(0, 35);
}

function buildUpiQuery(input: CreatePaymentInput): string {
  const pa = normalizeUpiId(input.payeeUpi);
  if (!isValidUpiId(pa)) {
    throw new Error("Invalid UPI ID. Use a format like name@oksbi.");
  }
  if (!(input.amount > 0)) {
    throw new Error("Amount must be greater than 0.");
  }
  const params = new URLSearchParams({
    pa,
    pn: input.payeeName.trim() || "Payee",
    tr: (input.transactionId?.trim() || createUpiTxnId()).slice(0, 35),
    am: input.amount.toFixed(2),
    cu: (input.currency ?? "INR").toUpperCase(),
  });
  const note = input.note?.trim();
  if (note) params.set("tn", note.slice(0, 80));
  return params.toString();
}

/**
 * App-specific UPI deep links for PWA / website.
 * - GPay Android: tez://upi/pay
 * - GPay iOS: gpay://upi/pay
 * - PhonePe: phonepe://pay
 * - Paytm: paytmmp://pay
 * - WhatsApp / Other: upi://pay
 */
export function buildUpiPayUri(input: CreatePaymentInput): string {
  const query = buildUpiQuery(input);
  const app = input.preferredApp ?? "generic";

  switch (app) {
    case "gpay":
      if (isIOS()) return `gpay://upi/pay?${query}`;
      if (isAndroid()) return `tez://upi/pay?${query}`;
      return `upi://pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "whatsapp":
    case "generic":
    default:
      return `upi://pay?${query}`;
  }
}

/**
 * Must run in the same user-gesture turn as the tap (no await before this),
 * or mobile browsers may refuse to open the UPI app.
 */
export function launchUpiUri(uri: string): void {
  window.location.href = uri;
}

/** Build + open a UPI deep link for the chosen app (sync — keep inside the tap). */
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
    payeeUpi: normalizeUpiId(input.payeeUpi),
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
