import type { CreatePaymentInput, PaymentIntent, PaymentProvider } from "./types";
import { buildCheckoutUpiQuery } from "./upiCheckoutLinks";
import { assertPayeeVpa } from "./upiVpa";

export type UpiApp = NonNullable<CreatePaymentInput["preferredApp"]>;

export function isValidUpiId(upi: string): boolean {
  try {
    assertPayeeVpa(upi);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUpiId(upi: string): string {
  return assertPayeeVpa(upi);
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Stable-enough txn ref for UPI `tr` (max ~35 chars commonly accepted). */
export function createUpiTxnId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `EM${Date.now().toString(36)}${rand}`.slice(0, 35);
}

function androidIntentPay(query: string, pkg?: string): string {
  const packagePart = pkg ? `package=${pkg};` : "";
  return (
    `intent://pay?${query}` +
    `#Intent;scheme=upi;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;${packagePart}end`
  );
}

/**
 * App-specific UPI deep links for PWA / website.
 * Uses P2P query from upiCheckoutLinks (no mc/tr).
 */
export function buildUpiPayUri(input: CreatePaymentInput): string {
  const query = buildCheckoutUpiQuery({
    payeeVpa: input.payeeUpi,
    payeeName: input.payeeName,
    amount: input.amount,
    currency: input.currency,
    note: input.note,
    transactionId: input.transactionId?.trim() || createUpiTxnId(),
  });
  const app = input.preferredApp ?? "generic";

  if (isAndroid()) {
    const pkgs: Partial<Record<UpiApp, string>> = {
      gpay: "com.google.android.apps.nbu.paisa.user",
      phonepe: "com.phonepe.app",
      paytm: "net.one97.paytm",
      whatsapp: "com.whatsapp",
    };
    if (app !== "generic" && pkgs[app]) {
      return androidIntentPay(query, pkgs[app]);
    }
  }

  switch (app) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "supermoney":
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
