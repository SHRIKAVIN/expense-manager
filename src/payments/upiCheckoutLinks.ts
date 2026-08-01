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
  /** Server ledger id — kept in our DB; only a short hint goes in `tn` for P2P. */
  transactionId: string;
}

/**
 * Person-to-person UPI query only: pa, pn, am, cu, tn.
 *
 * Do NOT send `mc` / `tr` for personal settle-up. Those flag a merchant (P2M) path;
 * GPay then shows a fake "bank limit exceeded" for personal VPAs, and PhonePe
 * often drops into Scan/QR gallery.
 *
 * encodeURIComponent (not URLSearchParams) so spaces are %20, not +.
 */
export function buildCheckoutUpiQuery(params: UpiLaunchParams): string {
  const pa = assertPayeeVpa(params.payeeVpa);
  if (!(params.amount > 0)) throw new Error("Amount must be greater than 0.");

  // Reject weak phone@upi — PSPs frequently reject it.
  if (pa.endsWith("@upi")) {
    throw new Error("Use a full UPI ID (e.g. name@ybl / name@oksbi), not phone@upi.");
  }

  const am = Number(params.amount).toFixed(2);
  const pn = sanitizeUpiText(params.payeeName || "Payee", 50) || "Payee";
  const shortRef = params.transactionId.replace(/[^a-zA-Z0-9]/g, "").slice(-8);
  const baseNote = sanitizeUpiText(params.note || "Reimbursement", 60) || "Reimbursement";
  const tn = sanitizeUpiText(`${baseNote} ${shortRef}`, 80);
  const cu = (params.currency ?? "INR").toUpperCase();

  const parts: Array<[string, string]> = [
    ["pa", pa],
    ["pn", pn],
    ["am", am],
    ["cu", cu],
    ["tn", tn],
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
 * Deep links for PWA settle-up (personal VPA / P2P).
 * iOS: custom schemes only. Prefer tez:// for GPay (more reliable than gpay:// in India).
 */
export function buildIosCheckoutUri(app: UpiCheckoutApp, params: UpiLaunchParams): string {
  const query = buildCheckoutUpiQuery(params);

  if (isAndroid()) {
    const pkg = ANDROID_PACKAGES[app];
    if (pkg) return androidIntentPay(query, pkg);
    return `upi://pay?${query}`;
  }

  // iOS / other: app schemes with the same P2P query.
  switch (app) {
    case "gpay":
      // tez:// is the widely working GPay scheme on iPhone in India for P2P.
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "supermoney":
    default:
      return `upi://pay?${query}`;
  }
}

export function launchCheckoutUri(uri: string): void {
  window.location.href = uri;
}
