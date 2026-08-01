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

/** Checkout icons: super.money → GPay → PhonePe → Paytm. */
export const UPI_CHECKOUT_APPS: UpiCheckoutAppOption[] = [
  {
    id: "supermoney",
    label: "super.money",
    shortLabel: "super.money",
    logo: "/upi-logos/supermoney.png",
    iosAppStoreUrl: "https://apps.apple.com/in/app/super-money-upi-credit-card/id6476118795",
  },
  {
    id: "gpay",
    label: "Google Pay",
    shortLabel: "GPay",
    logo: "/upi-logos/gpay.png",
    iosAppStoreUrl: "https://apps.apple.com/app/google-pay/id1193357041",
  },
  {
    id: "phonepe",
    label: "PhonePe",
    shortLabel: "PhonePe",
    logo: "/upi-logos/phonepe.png",
    iosAppStoreUrl: "https://apps.apple.com/in/app/phonepe/id1170055821",
  },
  {
    id: "paytm",
    label: "Paytm",
    shortLabel: "Paytm",
    logo: "/upi-logos/paytm.png",
    iosAppStoreUrl: "https://apps.apple.com/in/app/paytm/id473941634",
  },
];

const ANDROID_PACKAGES: Partial<Record<UpiCheckoutApp, string>> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  paytm: "net.one97.paytm",
};

export function getCheckoutApp(id: UpiCheckoutApp): UpiCheckoutAppOption {
  const app = UPI_CHECKOUT_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown UPI app: ${id}`);
  return app;
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

/** Strip characters PSPs often choke on in pn/tn. */
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
  note?: string;
  /** Server ledger id — embedded as UPI `tr` (unique per attempt). */
  transactionId: string;
}

/**
 * Build UPI query string.
 * IMPORTANT: use encodeURIComponent (not URLSearchParams) so spaces are %20,
 * not `+` — GPay/PhonePe often mis-parse `+` and show fake "bank limit" / QR flows.
 *
 * Include empty `mc` + unique `tr` — required by many PSP builds for intent pays.
 */
export function buildCheckoutUpiQuery(params: UpiLaunchParams): string {
  const pa = assertPayeeVpa(params.payeeVpa);
  if (!(params.amount > 0)) throw new Error("Amount must be greater than 0.");

  const am = Number(params.amount).toFixed(2);
  const pn = sanitizeUpiText(params.payeeName || "Payee", 50) || "Payee";
  const tr = sanitizeUpiText(params.transactionId, 35).replace(/\s/g, "") || `EM${Date.now()}`;
  const tn = sanitizeUpiText(params.note || "Reimbursement", 80) || "Reimbursement";
  const cu = (params.currency ?? "INR").toUpperCase();

  const parts: Array<[string, string]> = [
    ["pa", pa],
    ["pn", pn],
    ["mc", ""], // blank merchant code — P2P-safe; avoids false GPay limit errors
    ["tr", tr],
    ["tn", tn],
    ["am", am],
    ["cu", cu],
  ];

  return parts
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
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
 * App-specific UPI deep links for PWA / mobile web.
 * SECURITY: URI alone is not payment proof — only server webhook / status is.
 */
export function buildIosCheckoutUri(app: UpiCheckoutApp, params: UpiLaunchParams): string {
  const query = buildCheckoutUpiQuery(params);

  // Android: package-targeted intent keeps amount/VPA intact (custom schemes often drop params).
  if (isAndroid()) {
    const pkg = ANDROID_PACKAGES[app];
    if (pkg) return androidIntentPay(query, pkg);
    return androidIntentPay(query);
  }

  switch (app) {
    case "supermoney":
      return `upi://pay?${query}`;
    case "gpay":
      // Google docs: gpay:// on iOS; tez:// also used widely in India.
      return isIOS() ? `gpay://upi/pay?${query}` : `tez://upi/pay?${query}`;
    case "phonepe":
      // Prefer upi host path — phonepe://pay without params often opens Scan/QR gallery.
      return `phonepe://upi/pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    default:
      return `upi://pay?${query}`;
  }
}

export function launchCheckoutUri(uri: string): void {
  window.location.href = uri;
}
