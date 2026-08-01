import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { useAuth } from "@/auth/AuthProvider";
import { getReimbursementPartner } from "@/auth/quickSwitch";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { isOffline } from "@/lib/offlineQueue";
import {
  createSettlement,
  fetchPartnerPaymentInfo,
  type PartnerPaymentInfo,
} from "@/payments/settlementsApi";
import { useUpiVerifiedCheckout } from "@/payments/useUpiVerifiedCheckout";
import type { UpiCheckoutApp } from "@/payments/upiCheckoutLinks";
import { UpiCheckoutIcons } from "@/features/UpiCheckoutIcons";
import type { ReimbursementRequest } from "@/lib/types";

type PayTarget =
  | { mode: "single"; req: ReimbursementRequest }
  | { mode: "all"; requests: ReimbursementRequest[] };

function tapHaptic() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* ignore */
  }
}

export function ReimbursementsOwedCard({ currency }: { currency: string }) {
  const { user } = useAuth();
  const { reimbursementsToPay, markReimbursementPaid, refresh, can } = useAppData();
  const { show } = useToast();
  const [partnerPay, setPartnerPay] = useState<PartnerPaymentInfo | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payStep, setPayStep] = useState<"choose" | "upi">("choose");
  const [celebration, setCelebration] = useState<{
    amountLabel: string;
    detail: string;
  } | null>(null);
  const settlingRef = useRef(false);
  const payTargetRef = useRef<PayTarget | null>(null);
  payTargetRef.current = payTarget;

  const partnerEmail = user?.email ? getReimbursementPartner(user.email)?.email : undefined;

  const {
    phase,
    prepareCheckout,
    payWithApp,
    reset: resetCheckout,
    verifying,
    ready,
  } = useUpiVerifiedCheckout({
    onPaid: async (_result, expenseIds) => {
      if (!user || !partnerPay || settlingRef.current) return;
      const toSettle = reimbursementsToPay.filter((r) => expenseIds.includes(r.id));
      if (toSettle.length === 0) {
        await refresh();
        resetCheckout();
        setPayTarget(null);
        setPayStep("choose");
        show("Payment confirmed");
        return;
      }
      settlingRef.current = true;
      setBusyId(toSettle.length > 1 ? "all" : toSettle[0]!.id);
      try {
        for (const req of toSettle) {
          await createSettlement({
            reimbursementRequestId: req.id,
            payerId: user.id,
            payeeId: partnerPay.id,
            payerName: user.displayName || user.email,
            payeeName: partnerPay.displayName || req.requesterName,
            merchant: req.merchant,
            amount: req.amount,
            method: "upi",
            note: `UPI verified · ${req.merchant}`,
            status: "payer_confirmed",
          });
          try {
            await markReimbursementPaid(req.id);
          } catch {
            /* webhook may have already marked it */
          }
        }
        await refresh();
        const total = toSettle.reduce((s, r) => s + r.amount, 0);
        const name = toSettle[0]?.requesterName ?? "partner";
        resetCheckout();
        setPayTarget(null);
        setPayStep("choose");
        setCelebration({
          amountLabel: formatCurrency(total, currency),
          detail:
            toSettle.length > 1
              ? `Bank confirmed ${toSettle.length} refunds — waiting for ${name}`
              : `Bank confirmed — waiting for ${name} to confirm receipt`,
        });
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not record settlement");
      } finally {
        settlingRef.current = false;
        setBusyId(null);
      }
    },
    onError: (message) => show(message),
  });

  useEffect(() => {
    if (!partnerEmail || reimbursementsToPay.length === 0) {
      setPartnerPay(null);
      return;
    }
    let cancelled = false;
    setPartnerLoading(true);
    void fetchPartnerPaymentInfo(partnerEmail)
      .then((info) => {
        if (!cancelled) setPartnerPay(info);
      })
      .finally(() => {
        if (!cancelled) setPartnerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partnerEmail, reimbursementsToPay.length]);

  if (
    reimbursementsToPay.length === 0 &&
    !celebration &&
    !payTarget &&
    phase === "idle"
  ) {
    return null;
  }

  const openPaySheet = (target: PayTarget) => {
    if (isOffline()) {
      show("You're offline — reconnect to settle up");
      return;
    }
    tapHaptic();
    resetCheckout();
    setPayStep("choose");
    setPayTarget(target);
  };

  const closePaySheet = () => {
    if (verifying || phase === "awaiting_return" || phase === "launching") return;
    setPayTarget(null);
    setPayStep("choose");
    resetCheckout();
  };

  const goToUpiApps = () => {
    const target = payTargetRef.current;
    if (!partnerPay || !target) return;
    // Prefer real VPA — bare phone→@upi often fails in GPay/PhonePe.
    const payeeVpa = partnerPay.upiId?.trim() || partnerPay.phone?.trim();
    if (!payeeVpa) {
      show("Ask them to add their UPI ID in Settings (e.g. name@oksbi)");
      return;
    }
    if (!partnerPay.upiId?.includes("@")) {
      show("Use a full UPI ID in Settings (name@ybl), not only a phone number");
    }
    tapHaptic();
    setPayStep("upi");
    const requests = target.mode === "all" ? target.requests : [target.req];
    const amount = requests.reduce((s, r) => s + r.amount, 0);
    const note =
      requests.length === 1
        ? `Settle ${requests[0]!.merchant}`
        : `Settle ${requests.length} reimbursements`;
    void prepareCheckout({
      expenseIds: requests.map((r) => r.id),
      amount,
      currency,
      payeeVpa,
      payeeName: partnerPay.displayName || requests[0]!.requesterName,
      note,
    });
  };

  const launchWithApp = (app: UpiCheckoutApp) => {
    if (!ready) {
      show("Still preparing payment…");
      return;
    }
    tapHaptic();
    payWithApp(app);
  };

  const recordSettlements = async (
    toSettle: ReimbursementRequest[],
    opts: { method: "upi" | "other"; note?: string },
  ) => {
    if (!user || !partnerPay || settlingRef.current || toSettle.length === 0) return;
    settlingRef.current = true;
    setBusyId(toSettle.length > 1 ? "all" : toSettle[0]!.id);
    try {
      for (const req of toSettle) {
        await createSettlement({
          reimbursementRequestId: req.id,
          payerId: user.id,
          payeeId: partnerPay.id,
          payerName: user.displayName || user.email,
          payeeName: partnerPay.displayName || req.requesterName,
          merchant: req.merchant,
          amount: req.amount,
          method: opts.method,
          note: opts.note ?? `Settle ${req.merchant}`,
          status: "payer_confirmed",
        });
        await markReimbursementPaid(req.id);
      }
      const total = toSettle.reduce((s, r) => s + r.amount, 0);
      const name = toSettle[0]?.requesterName ?? "partner";
      closePaySheet();
      setCelebration({
        amountLabel: formatCurrency(total, currency),
        detail:
          toSettle.length > 1
            ? `Marked ${toSettle.length} refunds paid — waiting for ${name} to confirm`
            : `Waiting for ${name} to confirm they received it`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not record settlement");
    } finally {
      settlingRef.current = false;
      setBusyId(null);
    }
  };

  const handlePaidOutside = async () => {
    if (!payTarget || !user || !partnerPay) {
      if (!partnerPay) show("Could not load partner details — try again");
      return;
    }
    const toSettle =
      payTarget.mode === "all" ? payTarget.requests : [payTarget.req];
    const stillPending = reimbursementsToPay.filter((r) =>
      toSettle.some((t) => t.id === r.id),
    );
    if (stillPending.length === 0) {
      show("Those reimbursements are no longer pending");
      closePaySheet();
      return;
    }
    await recordSettlements(stillPending, {
      method: "other",
      note:
        stillPending.length === 1
          ? `Paid outside — ${stillPending[0]!.merchant}`
          : `Paid outside — ${stillPending.length} reimbursements`,
    });
  };

  const totalOwed = reimbursementsToPay.reduce((sum, req) => sum + req.amount, 0);
  const hasPartnerUpi = Boolean(partnerPay?.upiId || partnerPay?.phone);
  const upiHint = partnerLoading
    ? "Checking partner…"
    : partnerPay?.upiId
      ? `Pays ${partnerPay.upiId}`
      : partnerPay?.phone
        ? `Pays ${partnerPay.phone}`
        : partnerPay
          ? "No UPI yet — mark paid outside, or ask them to add one"
          : "Partner details unavailable";

  const payRequests =
    payTarget == null
      ? []
      : payTarget.mode === "all"
        ? payTarget.requests
        : [payTarget.req];
  const chooserAmount = payRequests.reduce((s, r) => s + r.amount, 0);
  const payeeLabel =
    partnerPay?.displayName || payRequests[0]?.requesterName || "Partner";
  const paySubtitle =
    payRequests.length > 1
      ? `${payRequests.length} reimbursements`
      : (payRequests[0]?.merchant ?? "");

  const showVerifySheet = phase === "verifying" || phase === "unpaid" || phase === "paid";

  return (
    <>
      {reimbursementsToPay.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-owed">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-tagline text-ink">Reimbursements owed</p>
              <p className="text-caption text-ink-muted-48 mt-1 truncate">{upiHint}</p>
            </div>
            {reimbursementsToPay.length > 1 && (
              <p className="text-body-strong text-primary tabular-nums shrink-0 pt-0.5">
                {formatCurrency(totalOwed, currency)}
              </p>
            )}
          </div>

          {reimbursementsToPay.length > 1 && can.writeExpenses && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-caption-strong text-ink">Pay everything</p>
                <p className="text-caption text-ink-muted-48 mt-0.5">
                  {reimbursementsToPay.length} refunds · {formatCurrency(totalOwed, currency)}
                </p>
              </div>
              <Button
                variant="primary"
                className="shrink-0 px-4 py-2"
                disabled={busyId === "all"}
                data-testid="reimbursement-pay-all"
                onClick={() =>
                  openPaySheet({ mode: "all", requests: [...reimbursementsToPay] })
                }
              >
                Pay All
              </Button>
            </div>
          )}

          {reimbursementsToPay.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-md border border-hairline bg-canvas-parchment px-4 py-3"
              data-testid={`reimbursement-owed-${req.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-ink truncate">{req.merchant}</p>
                <p className="text-caption text-ink-muted-48">
                  {req.requesterName} · {formatCurrency(req.amount, currency)}
                </p>
              </div>
              {can.writeExpenses && (
                <Button
                  variant="primary"
                  className="shrink-0 px-4 py-2"
                  disabled={busyId === req.id || busyId === "all"}
                  data-testid={`reimbursement-pay-now-${req.id}`}
                  onClick={() => openPaySheet({ mode: "single", req })}
                >
                  Pay Now
                </Button>
              )}
            </div>
          ))}
        </Card>
      ) : null}

      <Sheet
        open={Boolean(payTarget) && !showVerifySheet}
        onClose={closePaySheet}
        title={payStep === "upi" ? "Pay with UPI" : "How do you want to pay?"}
      >
        <div className="flex flex-col items-center text-center pt-1 pb-2">
          <div className="mb-4 h-1 w-10 rounded-full bg-ink/15" aria-hidden />
          <p className="text-caption text-ink-muted-48 uppercase tracking-wide">You pay</p>
          <p className="text-[2rem] leading-tight font-semibold text-ink tabular-nums mt-1">
            {formatCurrency(chooserAmount, currency)}
          </p>
          <p className="text-body text-ink mt-2">{payeeLabel}</p>
          {(partnerPay?.upiId || partnerPay?.phone) && (
            <p className="text-caption text-ink-muted-48 mt-1 select-all">
              {partnerPay.upiId || partnerPay.phone}
            </p>
          )}
          {paySubtitle ? (
            <p className="text-caption text-ink-muted-48 mt-2">{paySubtitle}</p>
          ) : null}
        </div>

        {payStep === "choose" ? (
          <div className="flex flex-col gap-3 mt-4" data-testid="pay-method-chooser">
            <button
              type="button"
              data-testid="pay-method-upi"
              disabled={!hasPartnerUpi || Boolean(busyId)}
              className="flex flex-col items-start gap-1 rounded-xl border border-hairline bg-canvas px-4 py-3.5 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
              onClick={goToUpiApps}
            >
              <span className="text-body-strong text-ink">Pay with UPI apps</span>
              <span className="text-caption text-ink-muted-48">
                {hasPartnerUpi
                  ? "Open super.money, GPay, PhonePe, or Paytm"
                  : "Partner needs to add a UPI ID in Settings first"}
              </span>
            </button>
            <button
              type="button"
              data-testid="pay-method-outside"
              disabled={Boolean(busyId) || !partnerPay}
              className="flex flex-col items-start gap-1 rounded-xl border border-hairline bg-canvas px-4 py-3.5 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
              onClick={() => void handlePaidOutside()}
            >
              <span className="text-body-strong text-ink">Paid outside — mark here</span>
              <span className="text-caption text-ink-muted-48">
                You already paid via bank, cash, or another app
              </span>
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="text-caption text-primary mt-2 mb-3 self-start"
              data-testid="pay-method-back"
              disabled={verifying || phase === "awaiting_return"}
              onClick={() => {
                resetCheckout();
                setPayStep("choose");
              }}
            >
              ← Back
            </button>
            <UpiCheckoutIcons
              phase={phase}
              disabled={Boolean(busyId) || !ready}
              onSelect={launchWithApp}
            />
          </>
        )}
      </Sheet>

      <Sheet
        open={showVerifySheet}
        onClose={() => {
          if (phase === "verifying") return;
          resetCheckout();
          setPayTarget(null);
          setPayStep("choose");
        }}
        title={
          phase === "verifying"
            ? "Confirming payment"
            : phase === "paid"
              ? "Payment confirmed"
              : "Payment not confirmed yet"
        }
        footer={
          phase === "unpaid" ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                fullWidth
                data-testid="settle-up-retry-status"
                onClick={() => {
                  /* re-open UPI step */
                  resetCheckout();
                  setPayStep("upi");
                }}
              >
                Try again
              </Button>
              <Button
                variant="primary"
                fullWidth
                data-testid="settle-up-dismiss-unpaid"
                onClick={() => {
                  resetCheckout();
                  setPayTarget(null);
                  setPayStep("choose");
                  show("Still unpaid — try again when ready.");
                }}
              >
                Close
              </Button>
            </div>
          ) : undefined
        }
      >
        {phase === "verifying" && (
          <div className="flex flex-col items-center gap-3 py-6" data-testid="upi-verifying">
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-body text-ink text-center">
              Checking bank settlement status…
            </p>
            <p className="text-caption text-ink-muted-48 text-center">
              Do not trust the UPI app alone — we wait for the server ledger.
            </p>
          </div>
        )}
        {phase === "unpaid" && (
          <p className="text-body text-ink">
            No bank confirmation yet. If you completed the payment, it may take a moment — try
            again shortly. If you cancelled, nothing was charged.
          </p>
        )}
      </Sheet>

      <SuccessOverlay
        open={Boolean(celebration)}
        amountLabel={celebration?.amountLabel ?? ""}
        detail={celebration?.detail}
        variant="reimbursement_paid"
        onClose={() => setCelebration(null)}
      />
    </>
  );
}
