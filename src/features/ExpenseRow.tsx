import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { CategoryGlyph, EditIcon, TrashIcon } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import { useAppData } from "@/data/AppDataProvider";
import type { Category, Expense } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/motion";
import { Lightbox } from "@/components/Lightbox";

interface ExpenseRowProps {
  expense: Expense;
  category?: Category;
  currency: string;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}

export function ExpenseRow({ expense, category, currency, onEdit, onDelete }: ExpenseRowProps) {
  const { can, repo } = useAppData();
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-80, -20], [1, 0]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const openReceipt = async () => {
    if (!expense.receiptId) return;
    const r = await repo.getReceipt(expense.receiptId);
    if (r) setLightbox(r.dataUrl);
  };

  const rowInner = (
    <div className="flex items-center gap-3 bg-canvas px-4 py-3">
      <div className="h-10 w-10 rounded-sm bg-canvas-parchment flex items-center justify-center text-ink shrink-0">
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
        <p className="text-body-strong text-ink truncate">{expense.merchant}</p>
        <p className="text-caption text-ink-muted-48 truncate">
          {category?.name ?? "Uncategorized"}
          {expense.paymentMethod ? ` · ${expense.paymentMethod}` : ""}
          {expense.recurringId ? " · recurring" : ""}
        </p>
      </div>

      <span className="text-body-strong text-ink tabular-nums shrink-0">
        −{formatCurrency(expense.amount, currency)}
      </span>

      {can.writeExpenses && (
        <div className="hidden lg:flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            aria-label="Edit"
            onClick={() => onEdit(expense)}
            className="h-9 w-9 rounded-full flex items-center justify-center text-primary outline-none"
          >
            <EditIcon size={18} />
          </button>
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
        {/* Swipe-to-delete reveal (mobile, write roles only) */}
        {can.writeExpenses && (
          <motion.div
            style={{ opacity: revealOpacity }}
            className="lg:hidden absolute inset-y-0 right-0 w-20 flex items-center justify-center text-ink-muted-48"
          >
            <TrashIcon size={22} />
          </motion.div>
        )}

        {can.writeExpenses ? (
          <motion.div
            drag={reduced ? false : "x"}
            dragConstraints={{ left: -96, right: 0 }}
            dragElastic={0.1}
            style={{ x }}
            onClick={() => onEdit(expense)}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) onDelete(expense);
              else x.set(0);
            }}
            className="cursor-pointer lg:cursor-default"
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
