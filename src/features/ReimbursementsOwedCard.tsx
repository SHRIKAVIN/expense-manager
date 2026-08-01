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
import { useSettleUpPayment } from "@/payments/useSettleUpPayment";
import { UPI_APP_OPTIONS, type UpiPreferredApp } from "@/payments/upiApps";
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
  const { reimbursementsToPay, markReimbursementPaid, can } = useAppData();
  const { show } = useToast();
  const { pendingReturn, payNow, dismissReturn } = useSettleUpPayment();
  const [partnerPay, setPartnerPay] = useState<PartnerPaymentInfo | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  /** First: choose UPI vs mark outside; then optionally pick a UPI app. */
  const [payStep, setPayStep] = useState<"choose" | "upi">("choose");
  const [celebration, setCelebration] = useState<{
    amountLabel: string;
    detail: string;
  } | null>(null);
  const settlingRef = useRef(false);

  const partnerEmail = user?.email ? getReimbursementPartner(user.email)?.email : undefined;

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

  // UPI apps never report success/fail to a PWA — ask when the user returns.
  useEffect(() => {
    if (pendingReturn) setBusyId(null);
  }, [pendingReturn]);

  if (reimbursementsToPay.length === 0 && !celebration && !pendingReturn && !payTarget) {
    return null;
  }

  const openPaySheet = (target: PayTarget) => {
    if (isOffline()) {
      show("You're offline — reconnect to settle up");
      return;
    }
    tapHaptic();
    setPayStep("choose");
    setPayTarget(target);
  };

  const closePaySheet = () => {
    setPayTarget(null);
    setPayStep("choose");
  };

  const goToUpiApps = () => {
    if (!partnerPay?.upiId) {
      show("Ask them to add their UPI ID in Settings");
      return;
    }
    tapHaptic();
    setPayStep("upi");
  };

  const launchWithApp = (app: UpiPreferredApp) => {
    if (!user || !partnerPay?.upiId || !payTarget) return;
    const requests =
      payTarget.mode === "all" ? payTarget.requests : [payTarget.req];
    const amount = requests.reduce((s, r) => s + r.amount, 0);
    const note =
      requests.length === 1
        ? `Settle ${requests[0]!.merchant}`
        : `Settle ${requests.length} reimbursements`;
    const ids = requests.map((r) => r.id);
    const busy = payTarget.mode === "all" ? "all" : payTarget.req.id;
    try {
      tapHaptic();
      // Launch in the same tap turn so the OS allows the deep link.
      payNow(ids, {
        payeeUpi: partnerPay.upiId,
        payeeName: partnerPay.displayName || requests[0]!.requesterName,
        amount,
        currency,
        note,
        preferredApp: app,
      });
      setBusyId(busy);
      closePaySheet();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not open UPI");
      setBusyId(null);
    }
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

  const handlePaymentSuccess = async () => {
    if (!pendingReturn || !user || !partnerPay) return;
    const { reimbursementIds: ids, intent } = pendingReturn;
    const toSettle = reimbursementsToPay.filter((r) => ids.includes(r.id));
    dismissReturn();
    if (toSettle.length === 0) {
      show("Those reimbursements are no longer pending");
      return;
    }
    await recordSettlements(toSettle, {
      method: "upi",
      note: intent.note ?? undefined,
    });
  };

  const handlePaymentFailed = () => {
    dismissReturn();
    setBusyId(null);
    show("Marked as failed — still unpaid. Try Pay again when ready.");
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
  const hasPartnerUpi = Boolean(partnerPay?.upiId);
  const upiHint = partnerLoading
    ? "Checking partner…"
    : hasPartnerUpi
      ? `Pays ${partnerPay?.upiId}`
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

  const resultRequests = pendingReturn
    ? reimbursementsToPay.filter((r) => pendingReturn.reimbursementIds.includes(r.id))
    : [];
  const resultAmount =
    resultRequests.reduce((s, r) => s + r.amount, 0) || pendingReturn?.intent.amount || 0;

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
        open={Boolean(payTarget)}
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
          {partnerPay?.upiId && (
            <p className="text-caption text-ink-muted-48 mt-1 select-all">{partnerPay.upiId}</p>
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
                  ? "Open GPay, PhonePe, WhatsApp, or another UPI app"
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
              className="text-caption text-primary mt-2 mb-1 self-start"
              data-testid="pay-method-back"
              onClick={() => setPayStep("choose")}
            >
              ← Back
            </button>
            <p className="text-caption-strong text-ink mt-2 mb-3">Choose a UPI app</p>
            <div
              className="grid grid-cols-3 gap-3 sm:grid-cols-4"
              data-testid="upi-app-picker"
            >
              {UPI_APP_OPTIONS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  data-testid={`upi-app-${app.id}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-canvas px-2 py-3 active:scale-95 transition-transform"
                  onClick={() => launchWithApp(app.id)}
                >
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white border border-hairline">
                    <img
                      src={app.logo}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-contain p-1"
                      draggable={false}
                    />
                  </span>
                  <span className="text-caption text-ink text-center leading-tight">
                    {app.shortLabel}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-caption text-ink-muted-48 mt-4 text-center">
              Opens the app you pick. If it isn&apos;t installed, try another or Other.
            </p>
          </>
        )}
      </Sheet>

      <Sheet
        open={Boolean(pendingReturn)}
        onClose={() => {
          dismissReturn();
          setBusyId(null);
        }}
        title="Did the payment go through?"
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              disabled={Boolean(busyId)}
              data-testid="settle-up-success"
              onClick={() => void handlePaymentSuccess()}
            >
              Payment successful
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={Boolean(busyId)}
              data-testid="settle-up-failed"
              onClick={() => void handlePaymentFailed()}
            >
              Failed or cancelled
            </Button>
          </div>
        }
      >
        <p className="text-body text-ink">
          UPI apps don&apos;t tell this app the result. Choose what happened so we can mark it
          correctly.
        </p>
        {pendingReturn && (
          <p className="text-caption text-ink-muted-48 mt-3">
            {formatCurrency(resultAmount, currency)} to {pendingReturn.intent.payeeName} (
            {pendingReturn.intent.payeeUpi})
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
