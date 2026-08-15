import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/Button";

export interface UpiConfirmationDialogProps {
  open: boolean;
  amount: number;
  currency: string;
  payeeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Dialog shown after UPI app closes, asking user to confirm if payment succeeded.
 * Since UPI deep links have no callback, this is the lightweight way to know
 * if the money was actually sent.
 */
export function UpiConfirmationDialog({
  open,
  amount,
  currency,
  payeeName,
  onConfirm,
  onCancel,
  isLoading,
}: UpiConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-surface-pearl rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
        <div>
          <p className="text-body-strong text-ink">Did you send the payment?</p>
          <p className="text-caption text-ink-muted-48 mt-1">
            Confirm only if {payeeName} received {formatCurrency(amount, currency)}
          </p>
        </div>

        <div className="bg-surface-pearl-high rounded-md p-4 border border-primary/25">
          <p className="text-caption-strong text-ink-muted-48">Payment details</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-body text-ink">To: {payeeName}</p>
            <p className="text-body-strong text-primary tabular-nums">{formatCurrency(amount, currency)}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            No, cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Confirming…" : "Yes, sent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
