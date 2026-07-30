import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";

export function ReimbursementsOwedCard({ currency }: { currency: string }) {
  const { reimbursementsToPay, markReimbursementPaid, can } = useAppData();
  const { show } = useToast();
  const [celebration, setCelebration] = useState<{
    amountLabel: string;
    detail: string;
  } | null>(null);

  if (reimbursementsToPay.length === 0 && !celebration) return null;

  const handleMarkPaid = async (id: string, name: string, amount: number) => {
    try {
      await markReimbursementPaid(id);
      setCelebration({
        amountLabel: formatCurrency(amount, currency),
        detail: `Waiting for ${name} to confirm they received it`,
      });
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not mark reimbursement paid");
    }
  };

  const totalOwed = reimbursementsToPay.reduce((sum, req) => sum + req.amount, 0);

  return (
    <>
      {reimbursementsToPay.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-owed">
          <div>
            <p className="text-tagline text-ink">Reimbursements owed</p>
            <p className="text-caption text-ink-muted-48 mt-1">
              Mark as paid after you reimburse — they&apos;ll confirm before it&apos;s removed from
              their account.
            </p>
          </div>

          {/* Total summary banner */}
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
                  data-testid={`reimbursement-mark-done-${req.id}`}
                  onClick={() => void handleMarkPaid(req.id, req.requesterName, req.amount)}
                >
                  Mark paid
                </Button>
              )}
            </div>
          ))}
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
