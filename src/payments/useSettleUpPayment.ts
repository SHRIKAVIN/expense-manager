import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentService } from "./PaymentService";
import type { CreatePaymentInput, PaymentIntent } from "./types";

/**
 * Launches a UPI payment and surfaces a confirmation prompt when the user
 * returns to the PWA (visibility / pageshow). Never assumes success from the intent alone.
 */
export function useSettleUpPayment() {
  const [pendingConfirm, setPendingConfirm] = useState<{
    intent: PaymentIntent;
    reimbursementId: string;
  } | null>(null);
  const launchedRef = useRef(false);
  const metaRef = useRef<{ reimbursementId: string; intent: PaymentIntent } | null>(null);

  const onReturn = useCallback(() => {
    if (!launchedRef.current || !metaRef.current) return;
    launchedRef.current = false;
    setPendingConfirm(metaRef.current);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") onReturn();
    };
    const onPageShow = () => onReturn();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onReturn);
    };
  }, [onReturn]);

  const payNow = useCallback(async (reimbursementId: string, input: CreatePaymentInput) => {
    const intent = await PaymentService.createAndLaunch(input);
    metaRef.current = { reimbursementId, intent };
    launchedRef.current = true;
    // Fallback: some browsers never fire visibility after upi:// — prompt after delay.
    window.setTimeout(() => {
      if (launchedRef.current) onReturn();
    }, 2500);
    return intent;
  }, [onReturn]);

  const dismissConfirm = useCallback(() => {
    setPendingConfirm(null);
    metaRef.current = null;
  }, []);

  return { pendingConfirm, payNow, dismissConfirm };
}
