import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";

export function ReimbursementsConfirmCard({ currency }: { currency: string }) {
  const { reimbursementsToConfirm, confirmReimbursement, rejectReimbursementPaid, can } =
    useAppData();
  const { show } = useToast();

  if (reimbursementsToConfirm.length === 0) return null;

  const handleConfirm = async (id: string, payerName: string, amount: number) => {
    try {
      await confirmReimbursement(id);
      show(`Confirmed ${formatCurrency(amount, currency)} from ${payerName} — expense removed`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not confirm reimbursement");
    }
  };

  const handleReject = async (id: string, payerName: string) => {
    try {
      await rejectReimbursementPaid(id);
      show(`${payerName} will be asked to pay again`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not update reimbursement");
    }
  };

  return (
    <Card className="mb-4 flex flex-col gap-3" data-testid="reimbursements-confirm">
      <div>
        <p className="text-tagline text-ink">Confirm reimbursement</p>
        <p className="text-caption text-ink-muted-48 mt-1">
          Someone marked these as paid. Confirm only if you received the money — the expense will
          then be removed.
        </p>
      </div>
      {reimbursementsToConfirm.map((req) => (
        <div
          key={req.id}
          className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas-parchment px-4 py-3 sm:flex-row sm:items-center"
          data-testid={`reimbursement-confirm-${req.id}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-body-strong text-ink truncate">{req.merchant}</p>
            <p className="text-caption text-ink-muted-48">
              {req.payerName} says paid · {formatCurrency(req.amount, currency)}
            </p>
          </div>
          {can.writeExpenses && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                className="px-4 py-2"
                data-testid={`reimbursement-reject-${req.id}`}
                onClick={() => void handleReject(req.id, req.payerName)}
              >
                Not yet
              </Button>
              <Button
                variant="primary"
                className="px-4 py-2"
                data-testid={`reimbursement-confirm-yes-${req.id}`}
                onClick={() => void handleConfirm(req.id, req.payerName, req.amount)}
              >
                Yes, received
              </Button>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
