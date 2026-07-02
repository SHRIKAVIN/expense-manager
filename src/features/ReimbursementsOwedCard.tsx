import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";

export function ReimbursementsOwedCard({ currency }: { currency: string }) {
  const { reimbursementsToPay, markReimbursementPaid, can } = useAppData();
  const { show } = useToast();

  if (reimbursementsToPay.length === 0) return null;

  const handleMarkPaid = async (id: string, name: string, amount: number) => {
    try {
      await markReimbursementPaid(id);
      show(`Marked ${formatCurrency(amount, currency)} paid to ${name} — waiting for their confirmation`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not mark reimbursement paid");
    }
  };

  return (
    <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-owed">
      <div>
        <p className="text-tagline text-ink">Reimbursements owed</p>
        <p className="text-caption text-ink-muted-48 mt-1">
          Mark as paid after you reimburse — they&apos;ll confirm before it&apos;s removed from
          their account.
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
  );
}
