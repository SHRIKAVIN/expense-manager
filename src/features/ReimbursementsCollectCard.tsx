import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
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
      <div>
        <p className="text-tagline text-ink">Waiting to be paid</p>
        <p className="text-caption text-ink-muted-48 mt-1">
          Remind your partner about reimbursements still unpaid.
        </p>
      </div>
      {reimbursementsAwaitingCollection.map((req) => (
        <div
          key={req.id}
          className="flex flex-col gap-2 rounded-md border border-hairline bg-canvas-parchment px-4 py-3 sm:flex-row sm:items-center"
          data-testid={`reimbursement-collect-${req.id}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-body-strong text-ink truncate">{req.merchant}</p>
            <p className="text-caption text-ink-muted-48">
              {req.payerName} owes · {formatCurrency(req.amount, currency)}
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
      ))}
    </Card>
  );
}
