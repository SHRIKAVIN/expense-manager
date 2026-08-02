import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SwipeDeck } from "@/components/SwipeDeck";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { notifyPartnerPaymentRequested } from "@/lib/partnerNotify";
import type { ReimbursementRequest } from "@/lib/types";

export function ReimbursementsCollectCard({ currency }: { currency: string }) {
  const { user } = useAuth();
  const { reimbursementsAwaitingCollection, can } = useAppData();
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (reimbursementsAwaitingCollection.length === 0) return null;

  const totalAwaiting = reimbursementsAwaitingCollection.reduce(
    (sum, req) => sum + req.amount,
    0,
  );

  const remind = async (req: ReimbursementRequest) => {
    if (!user) return;
    setBusyId(req.id);
    try {
      await notifyPartnerPaymentRequested(user, req);
      show("Reminder sent to your partner");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not notify partner");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-collect">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-tagline text-ink">Waiting to be paid</p>
          <p className="text-caption text-ink-muted-48 mt-1">
            {reimbursementsAwaitingCollection.length > 1
              ? "Swipe to browse · tap Remind to nudge your partner"
              : "Remind your partner about reimbursements still unpaid."}
          </p>
        </div>
        {reimbursementsAwaitingCollection.length > 1 && (
          <p className="text-body-strong text-ink tabular-nums shrink-0 pt-0.5">
            {formatCurrency(totalAwaiting, currency)}
          </p>
        )}
      </div>

      <SwipeDeck
        items={reimbursementsAwaitingCollection}
        getKey={(req) => req.id}
        label="Reimbursements waiting to be paid"
      >
        {(req) => (
          <div
            className="flex h-full items-center gap-3 rounded-md border border-hairline bg-canvas-parchment px-4 py-4"
            data-testid={`reimbursement-collect-${req.id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-strong text-ink truncate">{req.merchant}</p>
              <p className="text-caption text-ink-muted-48 mt-0.5">{req.payerName} owes</p>
              <p className="text-tagline text-ink tabular-nums mt-1">
                {formatCurrency(req.amount, currency)}
              </p>
            </div>
            {can.writeExpenses && (
              <Button
                variant="secondary"
                className="shrink-0 px-4 py-2"
                disabled={busyId === req.id}
                data-testid={`reimbursement-request-payment-${req.id}`}
                onClick={() => void remind(req)}
              >
                {busyId === req.id ? "Sending…" : "Remind"}
              </Button>
            )}
          </div>
        )}
      </SwipeDeck>
    </Card>
  );
}
