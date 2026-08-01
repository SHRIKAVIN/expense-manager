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

/** Android package names so we open a specific app instead of the default chooser. */
const ANDROID_UPI_PACKAGES: Partial<
  Record<NonNullable<CreatePaymentInput["preferredApp"]>, string>
> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  whatsapp: "com.whatsapp",
};

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
    am: input.amount.toFixed(2),
    cu: (input.currency ?? "INR").toUpperCase(),
  });
  const note = input.note?.trim();
  if (note) params.set("tn", note.slice(0, 80));
  return params.toString();
}

function androidIntentUpi(query: string, pkg?: string): string {
  const packagePart = pkg ? `package=${pkg};` : "";
  return (
    `intent://pay?${query}` +
    `#Intent;scheme=upi;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;${packagePart}end`
  );
}

/** Build a launch URI for a preferred UPI app. */
export function buildUpiPayUri(input: CreatePaymentInput): string {
  const query = buildUpiQuery(input);
  const app = input.preferredApp ?? "generic";
  const android = isAndroid();

  if (android && app !== "generic") {
    const pkg = ANDROID_UPI_PACKAGES[app];
    if (pkg) return androidIntentUpi(query, pkg);
  }

  switch (app) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "whatsapp":
      return `upi://pay?${query}`;
    case "generic":
    default:
      if (android) return androidIntentUpi(query);
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
