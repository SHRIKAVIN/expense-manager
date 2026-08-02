import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { SwipeDeck } from "@/components/SwipeDeck";
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
import type { ReimbursementRequest } from "@/lib/types";

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
  const [partnerPay, setPartnerPay] = useState<PartnerPaymentInfo | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    void fetchPartnerPaymentInfo(partnerEmail).then((info) => {
      if (!cancelled) setPartnerPay(info);
    });
    return () => {
      cancelled = true;
    };
  }, [partnerEmail, reimbursementsToPay.length]);

  if (reimbursementsToPay.length === 0 && !celebration) {
    return null;
  }

  const markPaid = async (toSettle: ReimbursementRequest[]) => {
    if (!user) return;
    if (isOffline()) {
      show("You're offline — reconnect to settle up");
      return;
    }
    if (!partnerPay) {
      show("Could not load partner details — try again");
      return;
    }
    if (settlingRef.current || toSettle.length === 0) return;

    const stillPending = reimbursementsToPay.filter((r) =>
      toSettle.some((t) => t.id === r.id),
    );
    if (stillPending.length === 0) {
      show("Those reimbursements are no longer pending");
      return;
    }

    settlingRef.current = true;
    setBusyId(stillPending.length > 1 ? "all" : stillPending[0]!.id);
    tapHaptic();
    try {
      for (const req of stillPending) {
        await createSettlement({
          reimbursementRequestId: req.id,
          payerId: user.id,
          payeeId: partnerPay.id,
          payerName: user.displayName || user.email,
          payeeName: partnerPay.displayName || req.requesterName,
          merchant: req.merchant,
          amount: req.amount,
          method: "other",
          note:
            stillPending.length === 1
              ? `Settle ${req.merchant}`
              : `Settle ${stillPending.length} reimbursements`,
          status: "payer_confirmed",
        });
        await markReimbursementPaid(req.id);
      }
      const total = stillPending.reduce((s, r) => s + r.amount, 0);
      const name = stillPending[0]?.requesterName ?? "partner";
      setCelebration({
        amountLabel: formatCurrency(total, currency),
        detail:
          stillPending.length > 1
            ? `Marked ${stillPending.length} refunds paid — waiting for ${name} to confirm`
            : `Waiting for ${name} to confirm they received it`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not record settlement");
    } finally {
      settlingRef.current = false;
      setBusyId(null);
    }
  };

  const totalOwed = reimbursementsToPay.reduce((sum, req) => sum + req.amount, 0);

  return (
    <>
      {reimbursementsToPay.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-owed">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-tagline text-ink">Reimbursements owed</p>
              <p className="text-caption text-ink-muted-48 mt-1">
                {reimbursementsToPay.length > 1
                  ? "Swipe to browse · tap Pay to mark as settled"
                  : "Tap Pay to mark as settled"}
              </p>
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
                disabled={busyId === "all" || !partnerPay}
                data-testid="reimbursement-pay-all"
                onClick={() => void markPaid([...reimbursementsToPay])}
              >
                {busyId === "all" ? "Paying…" : "Pay All"}
              </Button>
            </div>
          )}

          <SwipeDeck
            items={reimbursementsToPay}
            getKey={(req) => req.id}
            label="Reimbursements you owe"
          >
            {(req) => (
              <div
                className="flex h-full items-center gap-3 rounded-md border border-hairline bg-canvas-parchment px-4 py-4"
                data-testid={`reimbursement-owed-${req.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink truncate">{req.merchant}</p>
                  <p className="text-caption text-ink-muted-48 mt-0.5">{req.requesterName}</p>
                  <p className="text-tagline text-primary tabular-nums mt-1">
                    {formatCurrency(req.amount, currency)}
                  </p>
                </div>
                {can.writeExpenses && (
                  <Button
                    variant="primary"
                    className="shrink-0 px-4 py-2"
                    disabled={busyId === req.id || busyId === "all" || !partnerPay}
                    data-testid={`reimbursement-pay-now-${req.id}`}
                    onClick={() => void markPaid([req])}
                  >
                    {busyId === req.id ? "Paying…" : "Pay"}
                  </Button>
                )}
              </div>
            )}
          </SwipeDeck>
        </Card>
      ) : null}

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
