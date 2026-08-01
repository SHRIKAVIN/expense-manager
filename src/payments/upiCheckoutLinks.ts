import type { UpiCheckoutApp } from "./trackerTypes";
import { assertPayeeVpa } from "./upiVpa";

export type { UpiCheckoutApp };

export type UpiCheckoutAppOption = {
  id: UpiCheckoutApp;
  label: string;
  shortLabel: string;
  logo: string;
  /** iOS App Store fallback when the app doesn't open within the timeout. */
  iosAppStoreUrl: string;
};

/** Checkout: WhatsApp Pay only. */
export const UPI_CHECKOUT_APPS: UpiCheckoutAppOption[] = [
  {
    id: "whatsapp",
    label: "WhatsApp Pay",
    shortLabel: "WhatsApp",
    logo: "/upi-logos/whatsapp.png",
    iosAppStoreUrl: "https://apps.apple.com/app/whatsapp-messenger/id310633997",
  },
];

export function getCheckoutApp(id: UpiCheckoutApp): UpiCheckoutAppOption {
  const app = UPI_CHECKOUT_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown UPI app: ${id}`);
  return app;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Strip characters PSPs often choke on in pn. */
function sanitizeUpiText(value: string, max: number): string {
  return value
    .replace(/[^\w\s.&@-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export interface UpiLaunchParams {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  currency?: string;
  /** Ignored — WhatsApp rejects deep links that include `tn`. */
  note?: string;
  transactionId: string;
}

/**
 * WhatsApp-friendly P2P query: pa, pn, am, cu only.
 *
 * Do NOT send `tn` (description) — WhatsApp Pay declines links that include it.
 * Do NOT send `mc` / `tr` for personal settle-up.
 *
 * encodeURIComponent (not URLSearchParams) so spaces are %20, not +.
 */
export function buildCheckoutUpiQuery(params: UpiLaunchParams): string {
  const pa = assertPayeeVpa(params.payeeVpa);
  if (!(params.amount > 0)) throw new Error("Amount must be greater than 0.");

  if (pa.endsWith("@upi")) {
    throw new Error("Use a full UPI ID (e.g. name@ybl / name@oksbi), not phone@upi.");
  }

  const am = Number(params.amount).toFixed(2);
  const pn = sanitizeUpiText(params.payeeName || "Payee", 50) || "Payee";
  const cu = (params.currency ?? "INR").toUpperCase();

  const parts: Array<[string, string]> = [
    ["pa", pa],
    ["pn", pn],
    ["am", am],
    ["cu", cu],
  ];

  return parts
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function androidIntentPay(query: string, pkg: string): string {
  return (
    `intent://pay?${query}` +
    `#Intent;scheme=upi;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;package=${pkg};end`
  );
}

/** Deep link for WhatsApp Pay (PWA settle-up). */
export function buildIosCheckoutUri(app: UpiCheckoutApp, params: UpiLaunchParams): string {
  const query = buildCheckoutUpiQuery(params);

  if (isAndroid() && app === "whatsapp") {
    return androidIntentPay(query, "com.whatsapp");
  }

  return `upi://pay?${query}`;
}

export function launchCheckoutUri(uri: string): void {
  window.location.href = uri;
}
