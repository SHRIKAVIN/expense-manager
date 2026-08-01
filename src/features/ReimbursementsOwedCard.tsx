import { useEffect, useState } from "react";
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

export function ReimbursementsOwedCard({ currency }: { currency: string }) {
  const { user } = useAuth();
  const { reimbursementsToPay, markReimbursementPaid, can } = useAppData();
  const { show } = useToast();
  const { pendingConfirm, payNow, dismissConfirm } = useSettleUpPayment();
  const [partnerPay, setPartnerPay] = useState<PartnerPaymentInfo | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    amountLabel: string;
    detail: string;
  } | null>(null);

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

  if (reimbursementsToPay.length === 0 && !celebration && !pendingConfirm) return null;

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

  const handlePayNow = async (req: ReimbursementRequest) => {
    if (!user) return;
    if (isOffline()) {
      show("You're offline — use Mark paid without UPI when online, or wait for a connection");
      return;
    }
    if (!partnerPay?.upiId) {
      show("Ask them to add their UPI ID in Settings");
      return;
    }
    try {
      setBusyId(req.id);
      await payNow(req.id, {
        payeeUpi: partnerPay.upiId,
        payeeName: partnerPay.displayName || req.requesterName,
        amount: req.amount,
        currency,
        note: `Settle ${req.merchant}`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not open UPI");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmPaid = async () => {
    if (!pendingConfirm || !user || !partnerPay) return;
    const req = reimbursementsToPay.find((r) => r.id === pendingConfirm.reimbursementId);
    if (!req) {
      dismissConfirm();
      show("That reimbursement is no longer pending");
      return;
    }
    try {
      setBusyId(req.id);
      await createSettlement({
        reimbursementRequestId: req.id,
        payerId: user.id,
        payeeId: partnerPay.id,
        payerName: user.displayName || user.email,
        payeeName: partnerPay.displayName || req.requesterName,
        merchant: req.merchant,
        amount: req.amount,
        method: "upi",
        note: pendingConfirm.intent.note,
        status: "payer_confirmed",
      });
      await markReimbursementPaid(req.id);
      dismissConfirm();
      setCelebration({
        amountLabel: formatCurrency(req.amount, currency),
        detail: `Waiting for ${req.requesterName} to confirm they received it`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not record settlement");
    } finally {
      setBusyId(null);
    }
  };

  const totalOwed = reimbursementsToPay.reduce((sum, req) => sum + req.amount, 0);
  const hasPartnerUpi = Boolean(partnerPay?.upiId);
  const upiHint = partnerLoading
    ? "Checking partner UPI…"
    : hasPartnerUpi
      ? `Pay via UPI to ${partnerPay?.upiId}`
      : "Ask them to add UPI in Settings to enable Pay Now";

  return (
    <>
      {reimbursementsToPay.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-owed">
          <div>
            <p className="text-tagline text-ink">Reimbursements owed</p>
            <p className="text-caption text-ink-muted-48 mt-1">
              Pay Now opens UPI, then confirm you paid. They still confirm receipt before it moves
              off their account.
            </p>
            <p className="text-caption text-ink-muted-48 mt-1">{upiHint}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
            <div>
              <p className="text-caption text-ink-muted-48">
                {reimbursementsToPay.length === 1
                  ? "1 pending refund"
                  : `${reimbursementsToPay.length} pending refunds`}
              </p>
              <p className="text-caption-strong text-ink mt-0.5">Total to refund</p>
            </div>
            <p className="text-tagline text-primary font-semibold">
              {formatCurrency(totalOwed, currency)}
            </p>
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
                    disabled={!hasPartnerUpi || busyId === req.id}
                    data-testid={`reimbursement-pay-now-${req.id}`}
                    onClick={() => void handlePayNow(req)}
                  >
                    Pay Now
                  </Button>
                  <button
                    type="button"
                    className="text-caption text-ink-muted-48 underline-offset-2 hover:underline text-left sm:px-2"
                    disabled={busyId === req.id}
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
        open={Boolean(pendingConfirm)}
        onClose={dismissConfirm}
        title="Did the payment complete?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={dismissConfirm}>
              No
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={Boolean(busyId)}
              onClick={() => void handleConfirmPaid()}
              data-testid="settle-up-confirm-yes"
            >
              Yes, mark settled
            </Button>
          </div>
        }
      >
        <p className="text-body text-ink">
          If UPI finished successfully, we&apos;ll mark this reimbursement paid and save it to
          settlement history. Your partner still needs to confirm they received it.
        </p>
        {pendingConfirm && (
          <p className="text-caption text-ink-muted-48 mt-3">
            {formatCurrency(pendingConfirm.intent.amount, currency)} to{" "}
            {pendingConfirm.intent.payeeName} ({pendingConfirm.intent.payeeUpi})
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
