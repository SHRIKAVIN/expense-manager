import { useCallback, useEffect, useRef, useState } from "react";
import { createTrackedPayment, fetchPaymentStatus } from "./paymentTrackerApi";
import type { CreatePaymentResponse, PaymentStatusResponse, UpiPaymentStatus } from "./trackerTypes";
import {
  buildIosCheckoutUri,
  getCheckoutApp,
  launchCheckoutUri,
  type UpiCheckoutApp,
} from "./upiCheckoutLinks";
import { assertPayeeVpa } from "./upiVpa";

const APP_MISS_TIMEOUT_MS = 2500;
const STATUS_POLL_MS = 1200;
const STATUS_POLL_MAX = 6;
const STATUS_DEADLINE_MS = 8000;

export type CheckoutPhase =
  | "idle"
  | "preparing"
  | "ready"
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

type PreparedPay = {
  created: CreatePaymentResponse;
  expenseIds: string[];
};

/**
 * iOS/PWA UPI checkout:
 * 1) prepareCheckout() registers PENDING txn (before icon tap)
 * 2) payWithApp() launches deep link synchronously in the tap (keeps amount/VPA)
 * 3) visibilitychange → status poll
 */
export function useUpiVerifiedCheckout(opts: {
  onPaid: (result: PaymentStatusResponse, expenseIds: string[]) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [status, setStatus] = useState<UpiPaymentStatus | null>(null);
  const [active, setActive] = useState<ActiveLaunch | null>(null);
  const activeRef = useRef<ActiveLaunch | null>(null);
  const preparedRef = useRef<PreparedPay | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const verifyingRef = useRef(false);
  const inFlightRef = useRef(false);
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
    preparedRef.current = null;
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

  /** Register PENDING txn before the icon tap so launch stays synchronous. */
  const prepareCheckout = useCallback(
    async (input: {
      expenseIds: string[];
      amount: number;
      currency?: string;
      payeeVpa: string;
      payeeName?: string;
      note?: string;
    }) => {
      clearMissTimer();
      clearPoll();
      preparedRef.current = null;
      verifyDoneForTxnRef.current = null;
      wasHiddenRef.current = false;
      setPhase("preparing");
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
        });

        preparedRef.current = { created, expenseIds: input.expenseIds };
        setPhase("ready");
        return created;
      } catch (err) {
        setPhase("error");
        onErrorRef.current?.(err instanceof Error ? err.message : "Could not start payment");
        throw err;
      }
    },
    [],
  );

  /** Must stay sync after prepare — same tap gesture opens the UPI app with full params. */
  const payWithApp = useCallback((app: UpiCheckoutApp) => {
    const prepared = preparedRef.current;
    if (!prepared) {
      onErrorRef.current?.("Payment isn’t ready yet — go back and try again");
      return;
    }

    const { created, expenseIds } = prepared;
    const launch: ActiveLaunch = {
      app,
      transactionId: created.transactionId,
      expenseIds,
    };
    activeRef.current = launch;
    setActive(launch);
    setPhase("launching");

    const uri = buildIosCheckoutUri(app, {
      payeeVpa: created.payeeVpa,
      payeeName: created.payeeName,
      amount: Number(created.amount),
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
        window.location.href = getCheckoutApp(app).iosAppStoreUrl;
      }
    }, APP_MISS_TIMEOUT_MS);

    setPhase("awaiting_return");
    launchCheckoutUri(uri);
  }, []);

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
    prepareCheckout,
    payWithApp,
    reset,
    cancelVerify,
    verifying: phase === "verifying" || phase === "preparing",
    ready: phase === "ready",
  };
}
