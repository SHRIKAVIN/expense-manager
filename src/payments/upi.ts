import type { CreatePaymentInput, PaymentIntent, PaymentProvider } from "./types";

/** Basic UPI VPA: local@handle (letters, digits, ., _, -). */
const UPI_VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(upi: string): boolean {
  return UPI_VPA_RE.test(upi.trim());
}

export function normalizeUpiId(upi: string): string {
  return upi.trim().toLowerCase();
}

export function buildUpiPayUri(input: CreatePaymentInput): string {
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

  const query = params.toString();
  // Preferred-app schemes are best-effort; generic upi:// is the reliable path.
  switch (input.preferredApp) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "bhim":
      return `bhim://upi/pay?${query}`;
    default:
      return `upi://pay?${query}`;
  }
}

export async function launchUpiUri(uri: string): Promise<void> {
  // PWA-safe: navigate so the OS can hand off to a UPI app / chooser.
  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export const upiPaymentProvider: PaymentProvider = {
  id: "upi",
  async createIntent(input) {
    const uri = buildUpiPayUri(input);
    return {
      providerId: "upi",
      uri,
      amount: input.amount,
      currency: (input.currency ?? "INR").toUpperCase(),
      payeeName: input.payeeName.trim() || "Payee",
      payeeUpi: normalizeUpiId(input.payeeUpi),
      note: input.note?.trim(),
    } satisfies PaymentIntent;
  },
  async launch(intent) {
    await launchUpiUri(intent.uri);
  },
};
