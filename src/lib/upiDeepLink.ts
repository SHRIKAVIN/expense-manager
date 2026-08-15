/**
 * UPI payment launching for a PWA.
 *
 * Raw `upi://` navigation from a browser is unreliable: Android Chrome routes
 * custom schemes inconsistently, and iOS Safari suppresses app switches that
 * aren't triggered synchronously inside a user gesture. So:
 *
 * - Android → `intent://` URL, which hands Chrome a real Android Intent and
 *   opens the system UPI app chooser.
 * - iOS → `upi://` fired synchronously, with a QR modal as the fail-safe.
 * - Anything else (desktop) → QR only.
 *
 * CRITICAL: `openUpiApp()` must be called synchronously from the click handler.
 * Any `await` before it puts the navigation outside the user gesture and iOS
 * will silently drop it.
 */

export interface UpiPaymentParams {
  /** Payee UPI address (VPA), e.g. "9965278945@ybl" */
  upiId: string;
  /** Payee name shown in the UPI app (max 60 chars per NPCI spec) */
  payeeName: string;
  /** Transaction note (max 80 chars) */
  transactionNote: string;
  /** Amount in rupees */
  amount: number;
  /** Unique transaction reference. Auto-generated when omitted. */
  transactionId?: string;
}

export type UpiPlatform = "android" | "ios" | "other";

/** Unique per-attempt reference. Generated client-side so it needs no await. */
export function generateTransactionId(): string {
  return `TXN${Date.now()}${Math.random().toString(36).slice(2, 8)}`.slice(0, 35);
}

export function detectUpiPlatform(): UpiPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || navigator.vendor || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "other";
}

/**
 * Shared NPCI query string. Every value is percent-encoded except `am`, which
 * strict parsers reject unless it is a plain two-decimal number.
 */
function buildUpiQuery(params: UpiPaymentParams): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent(params.payeeName.slice(0, 60));
  const tn = encodeURIComponent(params.transactionNote.slice(0, 80));
  const tr = encodeURIComponent(params.transactionId ?? generateTransactionId());
  const am = params.amount.toFixed(2);

  return `pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
}

/** Standard `upi://pay?…` URI. Used for iOS launching and for QR encoding. */
export function buildUpiDeepLink(params: UpiPaymentParams): string {
  return `upi://pay?${buildUpiQuery(params)}`;
}

/** Android Intent URL — opens Chrome's UPI app chooser rather than a raw scheme. */
export function buildAndroidIntentUrl(params: UpiPaymentParams): string {
  return `intent://pay?${buildUpiQuery(params)}#Intent;scheme=upi;end;`;
}

/**
 * Launch the platform-appropriate UPI flow.
 *
 * MUST be called synchronously inside the click handler — see file header.
 *
 * @returns the platform, so the caller knows whether to arm the QR fail-safe
 *          ("ios") or show the QR immediately ("other").
 */
export function openUpiApp(params: UpiPaymentParams): UpiPlatform {
  const platform = detectUpiPlatform();

  if (platform === "android") {
    window.location.href = buildAndroidIntentUrl(params);
  } else if (platform === "ios") {
    window.location.href = buildUpiDeepLink(params);
  }

  return platform;
}
