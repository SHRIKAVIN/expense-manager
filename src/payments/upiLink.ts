/**
 * UPI deep-link construction.
 *
 * Read this before changing anything here — two previous attempts (`f597526`…`54320a1`
 * and `3160374`…`98311c4`) burned a lot of time rediscovering the same constraints.
 *
 * ENCODING RULES (learned the hard way, do not "clean these up"):
 *
 *  1. Use encodeURIComponent, NOT URLSearchParams. URLSearchParams encodes spaces as
 *     `+`; GPay and PhonePe mis-parse `+` and surface misleading "bank limit exceeded"
 *     errors or silently open the QR scanner. Spaces must be %20.
 *  2. `am` is emitted RAW as amount.toFixed(2) — never percent-encoded. Strict parsers
 *     reject an encoded amount.
 *  3. Text values are sanitized to a conservative charset before encoding. PSP parsers
 *     are inconsistent about what they accept in `pn`/`tn`.
 *
 * GESTURE RULE:
 *
 *     launchUpi() MUST be called synchronously from a click handler.
 *
 * Any `await` between the tap and the navigation moves it outside the user-gesture
 * window and iOS silently drops the app switch. Both previous attempts independently
 * hit this; it is real, and it is why nothing is persisted to Supabase before launch.
 *
 * WHAT WE CANNOT DO:
 *
 * NPCI's spec expects a trusted intent to carry `orgid` (6-digit PSP id) and `sign`
 * (an RSA signature over the query string). A web page is not a PSP and has neither.
 * An unsigned intent paying a personal (non-merchant, no `mc`) VPA is the exact shape
 * of the deep-link fraud pattern the risk engines block, which is why GPay/PhonePe
 * have declined every variant tried so far. The variant flags below exist so the
 * /dev matrix tester can establish empirically whether ANY combination gets through.
 */

import { mobilePlatform } from "@/lib/platform";

export interface UpiPaymentParams {
  /** Payee VPA, e.g. "someone@okaxis". */
  upiId: string;
  payeeName: string;
  transactionNote: string;
  amount: number;
  transactionId?: string;
}

export type UpiApp = "gpay" | "phonepe" | "phonepe_upi" | "paytm" | "bhim" | "generic";

export type UpiLaunchMethod = "location" | "open" | "anchor";

export interface UpiVariant {
  app: UpiApp;
  /** Omitting `am` lets the payer type the amount — may dodge the risk check. */
  includeAmount: boolean;
  includeTr: boolean;
  includeTn: boolean;
  /** `mc=""` — some PSP builds expect the key present even when empty. */
  includeMc: boolean;
  /** `mode=04` (Intent) per the NPCI spec. Never tried in either attempt. */
  includeMode: boolean;
  launch: UpiLaunchMethod;
}

export const DEFAULT_VARIANT: UpiVariant = {
  app: "generic",
  includeAmount: true,
  includeTr: true,
  includeTn: true,
  includeMc: false,
  includeMode: false,
  launch: "location",
};

export const UPI_APP_LABELS: Record<UpiApp, string> = {
  gpay: "Google Pay",
  phonepe: "PhonePe",
  phonepe_upi: "PhonePe (/upi/pay)",
  paytm: "Paytm",
  bhim: "BHIM",
  generic: "Any UPI app",
};

/** Android package ids, used to target a specific app via an intent:// URL. */
const ANDROID_PACKAGES: Partial<Record<UpiApp, string>> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  phonepe_upi: "com.phonepe.app",
  paytm: "net.one97.paytm",
  bhim: "in.org.npci.upiapp",
};

export function generateTransactionId(): string {
  // NPCI caps `tr` at 35 chars.
  return `TXN${Date.now()}${Math.random().toString(36).slice(2, 8)}`.slice(0, 35);
}

/** Strip anything PSP parsers are known to choke on, collapse whitespace, truncate. */
function sanitize(value: string, max: number): string {
  return value
    .replace(/[^\w\s.&@-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Build the query string. Order matters to some parsers, so it is fixed:
 * pa, pn, mc, tr, tn, am, cu, mode.
 */
export function buildUpiQuery(params: UpiPaymentParams, variant: UpiVariant): string {
  const parts: string[] = [];

  parts.push(`pa=${encodeURIComponent(params.upiId.trim())}`);
  parts.push(`pn=${encodeURIComponent(sanitize(params.payeeName, 50))}`);

  if (variant.includeMc) parts.push("mc=");
  if (variant.includeTr) {
    const tr = sanitize(params.transactionId ?? generateTransactionId(), 35);
    parts.push(`tr=${encodeURIComponent(tr)}`);
  }
  if (variant.includeTn) {
    parts.push(`tn=${encodeURIComponent(sanitize(params.transactionNote, 80))}`);
  }
  // Rule 2: raw, never encoded.
  if (variant.includeAmount) parts.push(`am=${params.amount.toFixed(2)}`);

  parts.push("cu=INR");

  if (variant.includeMode) parts.push("mode=04");

  return parts.join("&");
}

/**
 * iOS has no intent resolver, so each app must be addressed by its private scheme.
 * `generic` (upi://) opens whichever installed app claimed the scheme — which one
 * is not deterministic.
 */
function iosUrl(app: UpiApp, query: string): string {
  switch (app) {
    case "gpay":
      return `gpay://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "phonepe_upi":
      // Bare phonepe://pay has been observed to open the QR scanner instead of
      // the payment screen; the /upi/pay host path is the alternative to test.
      return `phonepe://upi/pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "bhim":
      return `bhim://pay?${query}`;
    case "generic":
    default:
      return `upi://pay?${query}`;
  }
}

function androidUrl(app: UpiApp, query: string): string {
  if (app === "generic") {
    return `intent://pay?${query}#Intent;scheme=upi;end;`;
  }
  if (app === "gpay") {
    // tez:// is still the widely-supported scheme for GPay India.
    return `tez://upi/pay?${query}`;
  }
  const pkg = ANDROID_PACKAGES[app];
  const packagePart = pkg ? `package=${pkg};` : "";
  return (
    `intent://pay?${query}#Intent;scheme=upi;` +
    `action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;${packagePart}end`
  );
}

export function buildUpiUrl(params: UpiPaymentParams, variant: UpiVariant): string {
  const query = buildUpiQuery(params, variant);
  const platform = mobilePlatform();
  if (platform === "android") return androidUrl(variant.app, query);
  // iOS schemes are also the right choice on desktop — they simply do nothing there,
  // and desktop is expected to use the QR path instead.
  return iosUrl(variant.app, query);
}

/** Plain upi:// string for QR encoding — always generic, never an intent:// URL. */
export function buildUpiQrUri(params: UpiPaymentParams, variant: UpiVariant): string {
  return `upi://pay?${buildUpiQuery(params, variant)}`;
}

/**
 * Navigate to a custom scheme.
 *
 * MUST be called synchronously inside a click handler — see the gesture rule above.
 *
 * Both previous attempts only ever used `window.location.href`. The other two methods
 * are here because they were never tried and cost nothing to include in the matrix.
 */
export function launchUpi(url: string, method: UpiLaunchMethod = "location"): void {
  switch (method) {
    case "open":
      window.open(url, "_blank");
      break;
    case "anchor": {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      break;
    }
    case "location":
    default:
      window.location.href = url;
      break;
  }
}

/** Short human-readable id for a variant, used in the tester's results log. */
export function describeVariant(v: UpiVariant): string {
  const flags = [
    v.includeAmount ? "+am" : "-am",
    v.includeTr ? "+tr" : "-tr",
    v.includeTn ? "+tn" : "-tn",
    v.includeMc ? "+mc" : null,
    v.includeMode ? "+mode" : null,
  ].filter(Boolean);
  return `${v.app} · ${flags.join(" ")} · ${v.launch}`;
}
