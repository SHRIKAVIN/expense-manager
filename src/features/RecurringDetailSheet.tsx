import { Sheet } from "@/components/Sheet";
import { CategoryGlyph } from "@/lib/icons";
import { formatCurrency, formatDate, relativeDue } from "@/lib/format";
import type { Category, Recurring } from "@/lib/types";

interface RecurringDetailSheetProps {
  recurring: Recurring | null;
  category?: Category;
  currency: string;
  onClose: () => void;
}

const FREQ_LABEL: Record<Recurring["frequency"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function RecurringDetailSheet({
  recurring,
  category,
  currency,
  onClose,
}: RecurringDetailSheetProps) {
  const open = recurring !== null;

  return (
    <Sheet open={open} onClose={onClose} title={recurring?.merchant ?? "Recurring"}>
      {recurring && (
        <div className="flex flex-col items-center text-center gap-4">
          <div className="text-center">
            <p className="text-display-md text-primary tabular-nums text-center">
              {formatCurrency(recurring.amount, currency)}
            </p>
            <p className="text-caption text-ink-muted-48 mt-1 text-center">
              {relativeDue(recurring.nextDue)}
            </p>
          </div>
          <ul className="flex flex-col gap-3 w-full">
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink-muted-80">Merchant</span>
              <span className="text-body-strong text-ink truncate text-right">
                {recurring.merchant}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink-muted-80">Category</span>
              <span className="flex items-center gap-2 min-w-0">
                {category && (
                  <span className="text-ink-muted-80 shrink-0">
                    <CategoryGlyph icon={category.icon} size={18} />
                  </span>
                )}
                <span className="text-body-strong text-ink truncate">
                  {category?.name ?? "—"}
                </span>
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink-muted-80">Frequency</span>
              <span className="text-body-strong text-ink">
                {FREQ_LABEL[recurring.frequency]}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink-muted-80">Next due</span>
              <span className="text-body-strong text-ink tabular-nums">
                {formatDate(recurring.nextDue)}
              </span>
            </li>
            {recurring.notes?.trim() ? (
              <li className="flex items-start justify-between gap-3">
                <span className="text-body text-ink-muted-80 shrink-0">Notes</span>
                <span className="text-body text-ink text-right">{recurring.notes}</span>
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
