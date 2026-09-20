/**
 * Platform detection.
 *
 * The same checks are currently inlined in index.html, webPush.ts, usePwaInstall.ts
 * and ReimbursementSyncListener.tsx. This module is the shared version; new code
 * should use it. The existing call sites are intentionally left alone for now.
 *
 * The iOS check matches index.html rather than the narrower regex in webPush.ts:
 * iPadOS 13+ reports a desktop UA, so it is only distinguishable by the
 * MacIntel + touch-points combination.
 */

export type MobilePlatform = "ios" | "android" | "other";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

/** True when launched from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
    );
  } catch {
    return false;
  }
}

export function mobilePlatform(): MobilePlatform {
  if (isAndroid()) return "android";
  if (isIOS()) return "ios";
  return "other";
}
