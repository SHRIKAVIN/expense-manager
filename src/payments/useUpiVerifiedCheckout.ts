import { useCallback, useEffect, useRef, useState } from "react";
import { createTrackedPayment, fetchPaymentStatus } from "./paymentTrackerApi";
import type { PaymentStatusResponse, UpiPaymentStatus } from "./trackerTypes";
import {
  buildIosCheckoutUri,
  getCheckoutApp,
  launchCheckoutUri,
  type UpiCheckoutApp,
} from "./upiCheckoutLinks";
import { assertPayeeVpa } from "./upiVpa";

const APP_MISS_TIMEOUT_MS = 2500;
/** Fast checks — without a real bank webhook, PENDING will never become PAID. */
const STATUS_POLL_MS = 900;
const STATUS_POLL_MAX = 5;
const STATUS_DEADLINE_MS = 6000;

export type CheckoutPhase =
  | "idle"
  | "creating"
  | "launching"
  | "awaiting_return"
  | "verifying"
  | "paid"
  | "unpaid"
  | "error";

type ActiveLaunch = {
  app: UpiCheckoutApp;
  transactionId: string;
  expenseIds: string[];
};

/**
 * iOS/PWA UPI checkout: register txn → deep link → App Store miss timeout →
 * one status poll cycle when returning from the UPI app (not on every focus).
 */
export function useUpiVerifiedCheckout(opts: {
  onPaid: (result: PaymentStatusResponse, expenseIds: string[]) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [status, setStatus] = useState<UpiPaymentStatus | null>(null);
  const [active, setActive] = useState<ActiveLaunch | null>(null);
  const activeRef = useRef<ActiveLaunch | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const verifyingRef = useRef(false);
  const inFlightRef = useRef(false);
  /** After one verify cycle (paid/unpaid), ignore further resume events for this txn. */
  const verifyDoneForTxnRef = useRef<string | null>(null);
  const wasHiddenRef = useRef(false);
  const onPaidRef = useRef(opts.onPaid);
  const onErrorRef = useRef(opts.onError);
  onPaidRef.current = opts.onPaid;
  onErrorRef.current = opts.onError;

  const clearMissTimer = () => {
    window.clearTimeout(missTimerRef.current);
    missTimerRef.current = undefined;
  };

  const clearPoll = () => {
    window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = undefined;
    verifyingRef.current = false;
    inFlightRef.current = false;
  };

  const reset = useCallback(() => {
    clearMissTimer();
    clearPoll();
    activeRef.current = null;
    verifyDoneForTxnRef.current = null;
    wasHiddenRef.current = false;
    setActive(null);
    setPhase("idle");
    setStatus(null);
  }, []);

  const verifyLoop = useCallback(async (transactionId: string, expenseIds: string[]) => {
    if (verifyingRef.current) return;
    if (verifyDoneForTxnRef.current === transactionId) return;

    verifyingRef.current = true;
    setPhase("verifying");
    window.clearTimeout(pollTimerRef.current);

    let attempts = 0;
    const startedAt = Date.now();

    const finishUnpaid = () => {
      verifyDoneForTxnRef.current = transactionId;
      clearPoll();
      setPhase("unpaid");
    };

    const tick = async () => {
      if (!verifyingRef.current || inFlightRef.current) return;
      if (Date.now() - startedAt > STATUS_DEADLINE_MS || attempts >= STATUS_POLL_MAX) {
        finishUnpaid();
        return;
      }

      attempts += 1;
      inFlightRef.current = true;
      try {
        const result = await fetchPaymentStatus(transactionId);
        if (!verifyingRef.current) return;
        setStatus(result.status);
        if (result.status === "PAID") {
          verifyDoneForTxnRef.current = transactionId;
          clearPoll();
          setPhase("paid");
          await onPaidRef.current(result, expenseIds);
          return;
        }
        if (result.status === "FAILED" || result.status === "EXPIRED") {
          finishUnpaid();
          return;
        }
      } catch (err) {
        if (attempts >= STATUS_POLL_MAX) {
          finishUnpaid();
          onErrorRef.current?.(err instanceof Error ? err.message : "Status check failed");
          return;
        }
      } finally {
        inFlightRef.current = false;
      }

      if (!verifyingRef.current) return;
      if (attempts >= STATUS_POLL_MAX || Date.now() - startedAt > STATUS_DEADLINE_MS) {
        finishUnpaid();
        return;
      }
      pollTimerRef.current = setTimeout(() => {
        void tick();
      }, STATUS_POLL_MS);
    };

    await tick();
  }, []);

  useEffect(() => {
    const onVis = () => {
      const launch = activeRef.current;
      if (!launch) return;

      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        clearMissTimer();
        return;
      }

      // Only after a real background→foreground (return from UPI), not DevTools focus.
      if (
        document.visibilityState === "visible" &&
        wasHiddenRef.current &&
        verifyDoneForTxnRef.current !== launch.transactionId
      ) {
        wasHiddenRef.current = false;
        clearMissTimer();
        void verifyLoop(launch.transactionId, launch.expenseIds);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearMissTimer();
      clearPoll();
    };
  }, [verifyLoop]);

  const payWithApp = useCallback(
    async (
      app: UpiCheckoutApp,
      input: {
        expenseIds: string[];
        amount: number;
        currency?: string;
        payeeVpa: string;
        payeeName?: string;
        note?: string;
      },
    ) => {
      clearMissTimer();
      clearPoll();
      verifyDoneForTxnRef.current = null;
      wasHiddenRef.current = false;
      setPhase("creating");
      setStatus(null);

      try {
        const payeeVpa = assertPayeeVpa(input.payeeVpa);
        const [primary, ...rest] = input.expenseIds;
        if (!primary) throw new Error("Nothing to pay.");

        const created = await createTrackedPayment({
          expenseId: primary,
          relatedExpenseIds: rest,
          amount: input.amount,
          currency: input.currency,
          payeeVpa,
          payeeName: input.payeeName,
          note: input.note,
          preferredApp: app,
        });

        const launch: ActiveLaunch = {
          app,
          transactionId: created.transactionId,
          expenseIds: input.expenseIds,
        };
        activeRef.current = launch;
        setActive(launch);
        setPhase("launching");

        const uri = buildIosCheckoutUri(app, {
          payeeVpa: created.payeeVpa,
          payeeName: created.payeeName,
          amount: created.amount,
          currency: created.currency,
          note: created.note,
          transactionId: created.transactionId,
        });

        missTimerRef.current = setTimeout(() => {
          if (
            document.visibilityState === "visible" &&
            activeRef.current?.transactionId === created.transactionId &&
            verifyDoneForTxnRef.current !== created.transactionId
          ) {
            // Never left the page — app likely missing.
            window.location.href = getCheckoutApp(app).iosAppStoreUrl;
          }
        }, APP_MISS_TIMEOUT_MS);

        setPhase("awaiting_return");
        launchCheckoutUri(uri);
      } catch (err) {
        setPhase("error");
        onErrorRef.current?.(err instanceof Error ? err.message : "Could not start payment");
      }
    },
    [],
  );

  const cancelVerify = useCallback(() => {
    const txn = activeRef.current?.transactionId;
    if (txn) verifyDoneForTxnRef.current = txn;
    clearMissTimer();
    clearPoll();
    setPhase("unpaid");
  }, []);

  return {
    phase,
    status,
    active,
    payWithApp,
    reset,
    cancelVerify,
    verifying: phase === "verifying" || phase === "creating",
  };
}
