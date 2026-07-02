import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { CategoryGlyph, EditIcon, TrashIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppData } from "@/data/AppDataProvider";
import type { Category, Expense } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/motion";
import { Lightbox } from "@/components/Lightbox";
import { cn } from "@/lib/cn";
import { isReimbursementLogEntry, reimbursementLogTag } from "@/lib/reimbursementDisplay";

interface ExpenseRowProps {
  expense: Expense;
  category?: Category;
  currency: string;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  /** Show the expense date below the category line (e.g. on Dashboard recents). */
  showDate?: boolean;
}

function ReimbursedTag({ variant }: { variant: "received" | "paid" }) {
  const isReceived = variant === "received";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold leading-none",
        isReceived ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
      )}
    >
      Reimbursed
    </span>
  );
}

export function ExpenseRow({
  expense,
  category,
  currency,
  onEdit,
  onDelete,
  showDate,
}: ExpenseRowProps) {
  const { can, repo, reimbursementByExpenseId } = useAppData();
  const pendingReimbursement = reimbursementByExpenseId[expense.id];
  const logTag = reimbursementLogTag(expense);
  const isLogEntry = isReimbursementLogEntry(expense);
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-80, -20], [1, 0]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const canWrite = can.writeExpenses;
  const canEdit = canWrite && !isLogEntry;

  const openReceipt = async () => {
    if (!expense.receiptId) return;
    const r = await repo.getReceipt(expense.receiptId);
    if (r) setLightbox(r.dataUrl);
  };

  const rowInner = (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="h-10 w-10 rounded-sm bg-surface-pearl flex items-center justify-center text-ink shrink-0">
        <CategoryGlyph icon={category?.icon ?? "other"} size={20} />
      </div>

      {expense.receiptId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void openReceipt();
          }}
          className="shrink-0 outline-none"
          aria-label="View receipt"
        >
          <ReceiptThumb receiptId={expense.receiptId} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-body-strong text-ink truncate">{expense.merchant}</p>
          {logTag && <ReimbursedTag variant={logTag} />}
        </div>
        <p className="text-caption text-ink-muted-48 truncate">
          {category?.name ?? "Uncategorized"}
          {expense.paymentMethod ? ` · ${expense.paymentMethod}` : ""}
          {expense.recurringId ? " · recurring" : ""}
          {pendingReimbursement
            ? pendingReimbursement.status === "awaiting_confirmation"
              ? ` · ${pendingReimbursement.payerName} marked paid — confirm`
              : ` · awaiting ${pendingReimbursement.payerName}`
            : ""}
        </p>
        {showDate && (
          <p className="text-fine-print text-ink-muted-48 mt-0.5">{formatDate(expense.date)}</p>
        )}
      </div>

      <span
        className={cn(
          "text-body-strong tabular-nums shrink-0",
          logTag === "received" && "text-emerald-700",
          logTag === "paid" && "text-red-600",
          !logTag && "text-ink",
        )}
      >
        −{formatCurrency(expense.amount, currency)}
      </span>

      {canWrite && (
        <div className="hidden lg:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canEdit && (
            <button
              type="button"
              aria-label="Edit"
              onClick={() => onEdit(expense)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-primary outline-none"
            >
              <EditIcon size={18} />
            </button>
          )}
          <button
            type="button"
            aria-label="Delete"
            onClick={() => onDelete(expense)}
            className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted-48 outline-none"
          >
            <TrashIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="group relative overflow-hidden border-b border-divider-soft last:border-b-0">
        {canWrite && (
          <motion.div
            style={{ opacity: revealOpacity }}
            className="lg:hidden absolute inset-y-0 right-0 w-20 flex items-center justify-center text-ink-muted-48"
          >
            <TrashIcon size={22} />
          </motion.div>
        )}

        {canEdit ? (
          <motion.div
            drag={reduced ? false : "x"}
            dragConstraints={{ left: -96, right: 0 }}
            dragElastic={0.1}
            style={{ x }}
            onClick={() => onEdit(expense)}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) onDelete(expense);
              x.set(0);
            }}
            className="cursor-pointer bg-canvas lg:cursor-default"
          >
            {rowInner}
          </motion.div>
        ) : canWrite ? (
          <motion.div
            drag={reduced ? false : "x"}
            dragConstraints={{ left: -96, right: 0 }}
            dragElastic={0.1}
            style={{ x }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) onDelete(expense);
              x.set(0);
            }}
            className="bg-canvas"
          >
            {rowInner}
          </motion.div>
        ) : (
          rowInner
        )}
      </div>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}

function ReceiptThumb({ receiptId }: { receiptId: string }) {
  const { repo } = useAppData();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    repo.getReceipt(receiptId).then((r) => {
      if (active) setSrc(r?.dataUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [repo, receiptId]);
  if (!src) return null;
  return (
    <img src={src} alt="Receipt" className="h-10 w-10 rounded-sm object-cover shadow-product" />
  );
}
