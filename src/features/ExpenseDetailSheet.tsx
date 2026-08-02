import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Lightbox } from "@/components/Lightbox";
import { useAppData } from "@/data/AppDataProvider";
import { CategoryGlyph, EditIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatTagLabel } from "@/lib/tags";
import { cn } from "@/lib/cn";
import { isReimbursementLogEntry, reimbursementLogTag } from "@/lib/reimbursementDisplay";
import type { Category, Expense } from "@/lib/types";

interface ExpenseDetailSheetProps {
  expense: Expense | null;
  category?: Category;
  currency: string;
  onClose: () => void;
  onEdit: (e: Expense) => void;
}

export function ExpenseDetailSheet({
  expense,
  category,
  currency,
  onClose,
  onEdit,
}: ExpenseDetailSheetProps) {
  const { can, repo, reimbursementByExpenseId, categoriesById } = useAppData();
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  /** Keep last expense while the sheet exit animation plays. */
  const [cached, setCached] = useState<Expense | null>(expense);
  const [cachedCategory, setCachedCategory] = useState<Category | undefined>(category);

  useEffect(() => {
    if (expense) {
      setCached(expense);
      setCachedCategory(category ?? categoriesById[expense.categoryId]);
    }
  }, [expense, category, categoriesById]);

  useEffect(() => {
    const id = cached?.receiptId;
    if (!id) {
      setReceiptSrc(null);
      return;
    }
    let active = true;
    void repo.getReceipt(id).then((r) => {
      if (active) setReceiptSrc(r?.dataUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [cached?.receiptId, repo]);

  const shown = expense ?? cached;
  if (!shown) return null;

  const pending = reimbursementByExpenseId[shown.id];
  const logTag = reimbursementLogTag(shown);
  const isLogEntry = isReimbursementLogEntry(shown);
  const canEdit = can.writeExpenses && !isLogEntry && Boolean(expense);
  const amountClass = logTag === "received" ? "text-emerald-700" : "text-red-600";
  const amountLabel = `−${formatCurrency(shown.amount, currency)}`;
  const cat = cachedCategory;

  const rows: Array<{ label: string; value: string; valueClass?: string }> = [
    { label: "Amount", value: amountLabel, valueClass: amountClass },
    { label: "Merchant", value: shown.merchant },
    { label: "Category", value: cat?.name ?? "Uncategorized" },
    { label: "Date", value: formatDate(shown.date) },
  ];
  if (shown.paymentMethod) {
    rows.push({ label: "Payment", value: shown.paymentMethod });
  }
  if (shown.tags?.length) {
    rows.push({ label: "Tags", value: shown.tags.map(formatTagLabel).join(" ") });
  }
  if (shown.notes) {
    rows.push({ label: "Notes", value: shown.notes });
  }
  if (shown.recurringId) {
    rows.push({ label: "Recurring", value: "Logged from a recurring rule" });
  }
  if (logTag === "received") {
    rows.push({ label: "Status", value: "Reimbursement received (log)" });
  } else if (logTag === "paid") {
    rows.push({ label: "Status", value: "Reimbursement paid (log)" });
  } else if (pending?.status === "awaiting_confirmation") {
    rows.push({
      label: "Reimbursement",
      value: `${pending.payerName} marked paid — waiting for your confirm`,
    });
  } else if (pending?.status === "pending") {
    rows.push({
      label: "Reimbursement",
      value: `Awaiting ${pending.payerName} · ${formatCurrency(pending.amount, currency)}`,
    });
  }

  return (
    <>
      <Sheet
        open={Boolean(expense)}
        onClose={onClose}
        title="Expense details"
        footer={
          canEdit ? (
            <Button
              variant="primary"
              fullWidth
              data-testid="expense-detail-edit"
              onClick={() => {
                onEdit(shown);
                onClose();
              }}
            >
              <EditIcon size={18} /> Edit expense
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5" data-testid="expense-detail">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-sm bg-surface-pearl flex items-center justify-center text-ink shrink-0">
              <CategoryGlyph icon={cat?.icon ?? "other"} size={24} />
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[1.75rem] font-semibold tabular-nums leading-none",
                  amountClass,
                )}
              >
                {amountLabel}
              </p>
              <p className="text-body text-ink mt-1 truncate">{shown.merchant}</p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-divider-soft rounded-md border border-hairline overflow-hidden">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3 bg-canvas">
                <span className="text-caption text-ink-muted-48 shrink-0">{row.label}</span>
                <span
                  className={cn(
                    "text-body text-right break-words",
                    row.valueClass ?? "text-ink",
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {receiptSrc && (
            <div className="flex flex-col gap-2">
              <span className="text-caption-strong text-ink-muted-80">Receipt</span>
              <button
                type="button"
                aria-label="View receipt"
                className="self-start outline-none"
                onClick={() => setLightbox(receiptSrc)}
              >
                <img
                  src={receiptSrc}
                  alt="Receipt"
                  className="h-28 w-28 rounded-sm object-cover shadow-product"
                />
              </button>
            </div>
          )}
        </div>
      </Sheet>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
