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

  const handleMarkPaid = async (id: string, name: string, amount: number) => {
    try {
      setBusyId(id);
      await markReimbursementPaid(id);
      setCelebration({
        amountLabel: formatCurrency(amount, currency),
        detail: `Waiting for ${name} to confirm they received it`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not mark reimbursement paid");
    } finally {
      setBusyId(null);
    }
  };

  const openPaySheet = (target: PayTarget) => {
    if (isOffline()) {
      show("You're offline — use Mark paid without UPI when online, or wait for a connection");
      return;
    }
    if (!partnerPay?.upiId) {
      show("Ask them to add their UPI ID in Settings");
      return;
    }
    tapHaptic();
    setPayTarget(target);
  };

  const launchPay = () => {
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
      payNow(ids, {
        payeeUpi: partnerPay.upiId,
        payeeName: partnerPay.displayName || requests[0]!.requesterName,
        amount,
        currency,
        note,
        preferredApp: "generic",
      });
      setBusyId(busy);
      setPayTarget(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not open UPI");
      setBusyId(null);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingReturn || !user || !partnerPay || settlingRef.current) return;
    const { reimbursementIds: ids, intent } = pendingReturn;
    const toSettle = reimbursementsToPay.filter((r) => ids.includes(r.id));
    dismissReturn();
    if (toSettle.length === 0) {
      show("Those reimbursements are no longer pending");
      return;
    }
    settlingRef.current = true;
    setBusyId(ids.length > 1 ? "all" : ids[0]!);
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
          note: intent.note ?? `Settle ${req.merchant}`,
          status: "payer_confirmed",
        });
        await markReimbursementPaid(req.id);
      }
      const total = toSettle.reduce((s, r) => s + r.amount, 0);
      const name = toSettle[0]?.requesterName ?? "partner";
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

  const handlePaymentFailed = async () => {
    if (!pendingReturn || !user || !partnerPay) {
      dismissReturn();
      return;
    }
    const { reimbursementIds: ids, intent } = pendingReturn;
    const toRecord = reimbursementsToPay.filter((r) => ids.includes(r.id));
    dismissReturn();
    setBusyId(null);
    try {
      // Audit only — leave reimbursements pending so they can retry.
      for (const req of toRecord) {
        await createSettlement({
          reimbursementRequestId: req.id,
          payerId: user.id,
          payeeId: partnerPay.id,
          payerName: user.displayName || user.email,
          payeeName: partnerPay.displayName || req.requesterName,
          merchant: req.merchant,
          amount: req.amount,
          method: "upi",
          note: intent.note ?? `Settle ${req.merchant}`,
          status: "cancelled",
        });
      }
    } catch {
      /* history write is best-effort */
    }
    show("Marked as failed — still unpaid. Try Pay again when ready.");
  };

  const totalOwed = reimbursementsToPay.reduce((sum, req) => sum + req.amount, 0);
  const hasPartnerUpi = Boolean(partnerPay?.upiId);
  const upiHint = partnerLoading
    ? "Checking partner UPI…"
    : hasPartnerUpi
      ? `Pays ${partnerPay?.upiId}`
      : "Ask them to add UPI in Settings to enable Pay";

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
          <div>
            <p className="text-tagline text-ink">Reimbursements owed</p>
            <p className="text-caption text-ink-muted-48 mt-1">
              Pay opens your phone&apos;s UPI apps. After you return, tell us if it succeeded or
              failed — they still confirm receipt.
            </p>
            <p className="text-caption text-ink-muted-48 mt-1">{upiHint}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-caption text-ink-muted-48">
                {reimbursementsToPay.length === 1
                  ? "1 pending refund"
                  : `${reimbursementsToPay.length} pending refunds`}
              </p>
              <p className="text-caption-strong text-ink mt-0.5">Total to refund</p>
              <p className="text-tagline text-primary font-semibold mt-1">
                {formatCurrency(totalOwed, currency)}
              </p>
            </div>
            {can.writeExpenses && (
              <Button
                variant="primary"
                className="shrink-0 px-4 py-2"
                disabled={
                  !hasPartnerUpi ||
                  busyId === "all" ||
                  (reimbursementsToPay.length === 1 &&
                    busyId === reimbursementsToPay[0]!.id)
                }
                data-testid="reimbursement-pay-all"
                onClick={() =>
                  openPaySheet(
                    reimbursementsToPay.length === 1
                      ? { mode: "single", req: reimbursementsToPay[0]! }
                      : { mode: "all", requests: [...reimbursementsToPay] },
                  )
                }
              >
                Pay All
              </Button>
            )}
          </div>

          {reimbursementsToPay.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-2 rounded-md border border-hairline bg-canvas-parchment px-4 py-3"
              data-testid={`reimbursement-owed-${req.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-ink truncate">{req.merchant}</p>
                <p className="text-caption text-ink-muted-48">
                  {req.requesterName} · {formatCurrency(req.amount, currency)}
                </p>
              </div>
              {can.writeExpenses && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="primary"
                    className="shrink-0 px-4 py-2"
                    disabled={!hasPartnerUpi || busyId === req.id || busyId === "all"}
                    data-testid={`reimbursement-pay-now-${req.id}`}
                    onClick={() => openPaySheet({ mode: "single", req })}
                  >
                    Pay Now
                  </Button>
                  <button
                    type="button"
                    className="text-caption text-ink-muted-48 underline-offset-2 hover:underline text-left sm:px-2"
                    disabled={busyId === req.id || busyId === "all"}
                    data-testid={`reimbursement-mark-done-${req.id}`}
                    onClick={() => void handleMarkPaid(req.id, req.requesterName, req.amount)}
                  >
                    Mark paid without UPI
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      ) : null}

      <Sheet
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Pay"
        footer={
          <Button
            variant="primary"
            fullWidth
            data-testid="upi-pay-native"
            onClick={launchPay}
          >
            Pay with UPI
          </Button>
        }
      >
        <div className="flex flex-col items-center text-center pt-1 pb-2">
          <div className="mb-5 h-1 w-10 rounded-full bg-ink/15" aria-hidden />
          <p className="text-caption text-ink-muted-48 uppercase tracking-wide">You pay</p>
          <p className="text-[2rem] leading-tight font-semibold text-ink tabular-nums mt-1">
            {formatCurrency(chooserAmount, currency)}
          </p>
          <p className="text-body text-ink mt-3">{payeeLabel}</p>
          {partnerPay?.upiId && (
            <p className="text-caption text-ink-muted-48 mt-1 select-all">{partnerPay.upiId}</p>
          )}
          {paySubtitle && (
            <p className="text-caption text-ink-muted-48 mt-3">{paySubtitle}</p>
          )}
          <p className="text-caption text-ink-muted-48 mt-4 max-w-xs">
            Next, your phone lists every UPI / payment app installed on this device. Pick one to
            pay.
          </p>
        </div>
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
            {formatCurrency(resultAmount, currency)} to{" "}
            {pendingReturn.intent.payeeName} ({pendingReturn.intent.payeeUpi})
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
