import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { CategoryGlyph, EditIcon, TrashIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppData } from "@/data/AppDataProvider";
import type { Category, Expense } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/motion";
import { Lightbox } from "@/components/Lightbox";
import { cn } from "@/lib/cn";
import { isReimbursementLogEntry, reimbursementLogTag } from "@/lib/reimbursementDisplay";
import { formatTagLabel } from "@/lib/tags";

const ACTION_WIDTH = 72;
const OPEN_OFFSET = -ACTION_WIDTH * 2;

interface ExpenseRowProps {
  expense: Expense;
  category?: Category;
  currency: string;
  onOpen: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  /** True while the delete confirmation dialog is open for this row. */
  deletePending?: boolean;
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
  onOpen,
  onEdit,
  onDelete,
  deletePending = false,
  showDate,
}: ExpenseRowProps) {
  const { can, repo, reimbursementByExpenseId } = useAppData();
  const pendingReimbursement = reimbursementByExpenseId[expense.id];
  const logTag = reimbursementLogTag(expense);
  const isLogEntry = isReimbursementLogEntry(expense);
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [OPEN_OFFSET + 24, -16], [1, 0]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const canWrite = can.writeExpenses;
  const canEdit = canWrite && !isLogEntry;
  const wasDeletePending = useRef(false);
  /** Ignore the synthetic click that fires right after a drag ends. */
  const skipClick = useRef(false);
  const openOffset = canEdit ? OPEN_OFFSET : -ACTION_WIDTH;

  const resetSwipe = () => {
    setActionsOpen(false);
    skipClick.current = false;
    void animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  const snapOpen = () => {
    setActionsOpen(true);
    void animate(x, openOffset, { type: "spring", stiffness: 500, damping: 40 });
  };

  useEffect(() => {
    if (wasDeletePending.current && !deletePending) {
      resetSwipe();
    }
    wasDeletePending.current = deletePending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletePending]);

  const handleDragStart = () => {
    skipClick.current = false;
  };

  const handleDrag = (_: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > 8) skipClick.current = true;
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const shouldOpen = info.offset.x < openOffset / 2 || info.velocity.x < -400;
    if (shouldOpen) snapOpen();
    else resetSwipe();
  };

  const openReceipt = async () => {
    if (!expense.receiptId) return;
    const r = await repo.getReceipt(expense.receiptId);
    if (r) setLightbox(r.dataUrl);
  };

  const handleRowClick = () => {
    // Consume the post-drag click once, then allow normal taps again.
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (actionsOpen || Math.abs(x.get()) > 8) {
      resetSwipe();
      return;
    }
    onOpen(expense);
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
        {expense.tags && expense.tags.length > 0 ? (
          <p className="text-fine-print text-ink-muted-48 mt-0.5 truncate">
            {expense.tags.map(formatTagLabel).join(" ")}
          </p>
        ) : null}
        {showDate && (
          <p className="text-fine-print text-ink-muted-48 mt-0.5">{formatDate(expense.date)}</p>
        )}
      </div>

      <span
        className={cn(
          "text-body-strong tabular-nums shrink-0",
          logTag === "received" && "text-emerald-700",
          logTag === "paid" && "text-red-600",
          !logTag && "text-red-600",
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
              onClick={(e) => {
                e.stopPropagation();
                onEdit(expense);
              }}
              className="h-9 w-9 rounded-full flex items-center justify-center text-primary outline-none"
            >
              <EditIcon size={18} />
            </button>
          )}
          <button
            type="button"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(expense);
            }}
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
            className="lg:hidden absolute inset-y-0 right-0 flex items-stretch"
          >
            {canEdit && (
              <button
                type="button"
                aria-label="Edit"
                data-testid={`expense-swipe-edit-${expense.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  skipClick.current = false;
                  setActionsOpen(false);
                  x.set(0);
                  onEdit(expense);
                }}
                className="w-[72px] flex flex-col items-center justify-center gap-1 bg-primary text-on-primary outline-none"
              >
                <EditIcon size={20} />
                <span className="text-[11px] font-semibold">Edit</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Delete"
              data-testid={`expense-swipe-delete-${expense.id}`}
              onClick={(e) => {
                e.stopPropagation();
                skipClick.current = false;
                onDelete(expense);
              }}
              className="w-[72px] flex flex-col items-center justify-center gap-1 bg-red-600 text-white outline-none"
            >
              <TrashIcon size={20} />
              <span className="text-[11px] font-semibold">Delete</span>
            </button>
          </motion.div>
        )}

        {canWrite ? (
          <motion.div
            drag={reduced ? false : "x"}
            dragConstraints={{ left: openOffset, right: 0 }}
            dragElastic={0.08}
            style={{ x }}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onClick={handleRowClick}
            className="cursor-pointer bg-canvas relative z-[1] lg:cursor-pointer"
          >
            {rowInner}
          </motion.div>
        ) : (
          <div className="cursor-pointer bg-canvas" onClick={() => onOpen(expense)}>
            {rowInner}
          </div>
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
