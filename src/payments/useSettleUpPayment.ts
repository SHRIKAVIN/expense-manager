import { useCallback, useEffect, useRef, useState } from "react";
import { createUpiIntent, launchUpiUri } from "./upi";
import type { CreatePaymentInput, PaymentIntent } from "./types";

export type PendingSettleReturn = {
  intent: PaymentIntent;
  reimbursementIds: string[];
};

/**
 * Launches UPI in the same tick as the user tap so Android can show the native
 * installed-apps chooser. When the user returns, exposes pending settle metadata
 * so the UI can ask success vs failed (UPI deep links never report status).
 */
export function useSettleUpPayment() {
  const [pendingReturn, setPendingReturn] = useState<PendingSettleReturn | null>(null);
  const launchedRef = useRef(false);
  const metaRef = useRef<PendingSettleReturn | null>(null);

  const onReturn = useCallback(() => {
    if (!launchedRef.current || !metaRef.current) return;
    launchedRef.current = false;
    setPendingReturn(metaRef.current);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") onReturn();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [onReturn]);

  const payNow = useCallback(
    (reimbursementIds: string[], input: CreatePaymentInput): PaymentIntent => {
      if (reimbursementIds.length === 0) {
        throw new Error("Nothing to pay.");
      }
      // Sync create + launch — must stay inside the click gesture.
      const intent = createUpiIntent(input);
      metaRef.current = { reimbursementIds, intent };
      launchedRef.current = true;
      launchUpiUri(intent.uri);
      // Fallback if visibility never fires after the handoff.
      window.setTimeout(() => {
        if (launchedRef.current) onReturn();
      }, 2500);
      return intent;
    },
    [onReturn],
  );

  const dismissReturn = useCallback(() => {
    setPendingReturn(null);
    metaRef.current = null;
  }, []);

  return { pendingReturn, payNow, dismissReturn };
}
