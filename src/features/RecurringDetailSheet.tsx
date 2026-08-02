import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { CategoryGlyph } from "@/lib/icons";
import { formatCurrency, formatDate, relativeDue } from "@/lib/format";
import type { Category, Recurring } from "@/lib/types";

interface RecurringDetailSheetProps {
  recurring: Recurring | null;
  category?: Category;
  currency: string;
  onClose: () => void;
  onLog?: () => void;
  onDismiss?: () => void;
  logging?: boolean;
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
  onLog,
  onDismiss,
  logging,
}: RecurringDetailSheetProps) {
  const [cached, setCached] = useState<Recurring | null>(recurring);
  const [cachedCategory, setCachedCategory] = useState<Category | undefined>(category);

  useEffect(() => {
    if (recurring) {
      setCached(recurring);
      setCachedCategory(category);
    }
  }, [recurring, category]);

  const shown = recurring ?? cached;
  if (!shown) return null;

  return (
    <Sheet
      open={recurring !== null}
      onClose={onClose}
      title={shown.merchant}
      footer={
        onLog || onDismiss ? (
          <div className="flex flex-col gap-2">
            {onLog && (
              <Button variant="primary" fullWidth onClick={onLog} disabled={logging}>
                {logging ? "Logging…" : `Log ${shown.merchant}`}
              </Button>
            )}
            {onDismiss && (
              <Button variant="secondary" fullWidth onClick={onDismiss} disabled={logging}>
                Dismiss
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="text-center">
          <p className="text-display-md text-primary tabular-nums text-center">
            {formatCurrency(shown.amount, currency)}
          </p>
          <p className="text-caption text-ink-muted-48 mt-1 text-center">
            {relativeDue(shown.nextDue)}
          </p>
        </div>
        <ul className="flex flex-col gap-3 w-full">
          <li className="flex items-center justify-between gap-3">
            <span className="text-body text-ink-muted-80">Merchant</span>
            <span className="text-body-strong text-ink truncate text-right">{shown.merchant}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-body text-ink-muted-80">Category</span>
            <span className="flex items-center gap-2 min-w-0">
              {cachedCategory && (
                <span className="text-ink-muted-80 shrink-0">
                  <CategoryGlyph icon={cachedCategory.icon} size={18} />
                </span>
              )}
              <span className="text-body-strong text-ink truncate">
                {cachedCategory?.name ?? "—"}
              </span>
            </span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-body text-ink-muted-80">Frequency</span>
            <span className="text-body-strong text-ink">{FREQ_LABEL[shown.frequency]}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-body text-ink-muted-80">Next due</span>
            <span className="text-body-strong text-ink tabular-nums">
              {formatDate(shown.nextDue)}
            </span>
          </li>
          {shown.notes?.trim() ? (
            <li className="flex items-start justify-between gap-3">
              <span className="text-body text-ink-muted-80 shrink-0">Notes</span>
              <span className="text-body text-ink text-right">{shown.notes}</span>
            </li>
          ) : null}
        </ul>
      </div>
    </Sheet>
  );
}
