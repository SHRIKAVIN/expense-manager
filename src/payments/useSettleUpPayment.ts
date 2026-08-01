import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentService } from "./PaymentService";
import type { CreatePaymentInput, PaymentIntent } from "./types";

export type PendingSettleReturn = {
  intent: PaymentIntent;
  reimbursementIds: string[];
};

/**
 * Launches a UPI payment and, when the user returns to the PWA, exposes
 * pending settle metadata. Does not ask “did it complete?” — callers settle
 * on return. Still cannot verify the bank txn from a deep link alone.
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
    async (reimbursementIds: string[], input: CreatePaymentInput) => {
      if (reimbursementIds.length === 0) {
        throw new Error("Nothing to pay.");
      }
      const intent = await PaymentService.createAndLaunch(input);
      metaRef.current = { reimbursementIds, intent };
      launchedRef.current = true;
      // Fallback: some browsers never fire visibility after upi:// — settle after delay.
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
