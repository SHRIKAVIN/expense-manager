import type { CreatePaymentInput, PaymentIntent, PaymentProvider } from "./types";

/** Basic UPI VPA: local@handle (letters, digits, ., _, -). */
const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(upi: string): boolean {
  return UPI_VPA_RE.test(upi.trim());
}

export function normalizeUpiId(upi: string): string {
  return upi.trim().toLowerCase();
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Query string shared by upi:// and Android intent:// forms. */
function buildUpiQuery(input: CreatePaymentInput): { pa: string; query: string } {
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
    am: input.amount.toFixed(2),
    cu: (input.currency ?? "INR").toUpperCase(),
  });
  const note = input.note?.trim();
  if (note) params.set("tn", note.slice(0, 80));
  return { pa, query: params.toString() };
}

/**
 * Build a launch URI. For generic on Android, use Chrome's intent:// form so the
 * system can show every installed app that handles UPI (GPay, PhonePe, etc.).
 */
export function buildUpiPayUri(input: CreatePaymentInput): string {
  const { query } = buildUpiQuery(input);

  switch (input.preferredApp) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "bhim":
      return `bhim://upi/pay?${query}`;
    case "generic":
    default:
      if (isAndroid()) {
        // No package= → Android resolves all UPI handlers and shows the native chooser
        // (or the default app if the user set one).
        return (
          `intent://pay?${query}` +
          "#Intent;scheme=upi;action=android.intent.action.VIEW;" +
          "category=android.intent.category.BROWSABLE;end"
        );
      }
      return `upi://pay?${query}`;
  }
}

/**
 * Must run in the same user-gesture turn as the tap (no await before this),
 * or mobile browsers may refuse to open the native UPI chooser.
 */
export function launchUpiUri(uri: string): void {
  window.location.href = uri;
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
