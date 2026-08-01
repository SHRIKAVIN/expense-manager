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

export function getCheckoutApp(id: UpiCheckoutApp): UpiCheckoutAppOption {
  const app = UPI_CHECKOUT_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown UPI app: ${id}`);
  return app;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export interface UpiLaunchParams {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  currency?: string;
  note?: string;
  /** Server-issued merchant `tr` — never invent this on the client for verified flows. */
  transactionId: string;
}

export function buildCheckoutUpiQuery(params: UpiLaunchParams): string {
  const pa = assertPayeeVpa(params.payeeVpa);
  if (!(params.amount > 0)) throw new Error("Amount must be greater than 0.");
  const qs = new URLSearchParams({
    pa,
    pn: params.payeeName.trim() || "Payee",
    tr: params.transactionId.slice(0, 35),
    am: params.amount.toFixed(2),
    cu: (params.currency ?? "INR").toUpperCase(),
  });
  const note = params.note?.trim();
  if (note) qs.set("tn", note.slice(0, 80));
  return qs.toString();
}

/**
 * Absolute custom URL scheme matrix for iOS / mobile web PWAs.
 * SECURITY: URI alone is not payment proof — only server webhook / status is.
 */
export function buildIosCheckoutUri(app: UpiCheckoutApp, params: UpiLaunchParams): string {
  const query = buildCheckoutUpiQuery(params);
  switch (app) {
    case "supermoney":
      return `upi://pay?${query}`;
    case "gpay":
      // tez:// has broad India stability; gpay:// is Google's documented iOS format.
      return isIOS() ? `tez://upi/pay?${query}` : `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    default:
      return `upi://pay?${query}`;
  }
}

export function launchCheckoutUri(uri: string): void {
  window.location.href = uri;
}
