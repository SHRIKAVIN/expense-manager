import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextField, TextArea } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { CategoryGlyph, CameraIcon, TrashIcon } from "@/lib/icons";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { getReimbursementPartner } from "@/auth/quickSwitch";
import { useToast } from "@/components/Toast";
import { Lightbox } from "@/components/Lightbox";
import { compressImage } from "@/lib/image";
import { todayISO } from "@/lib/format";
import type { Expense } from "@/lib/types";

interface ExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the sheet is in edit mode. */
  editing?: Expense | null;
}

export function ExpenseSheet({ open, onClose, editing }: ExpenseSheetProps) {
  const { categories, addExpense, editExpense, repo, reimbursementByExpenseId } = useAppData();
  const { user } = useAuth();
  const { show } = useToast();
  const reimbursementPartner = user ? getReimbursementPartner(user.email) : null;
  const activeCategories = categories.filter((c) => !c.archived);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [requestReimbursement, setRequestReimbursement] = useState(false);
  const [receiptId, setReceiptId] = useState<string | undefined>(undefined);
  /** New receipt not yet uploaded — preview locally, persist on save. */
  const [pendingReceipt, setPendingReceipt] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
  const [saving, setSaving] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [receiptLightbox, setReceiptLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingReimbursement = editing ? reimbursementByExpenseId[editing.id] : undefined;
  const reimbursementLocked = existingReimbursement?.status === "awaiting_confirmation";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount));
      setMerchant(editing.merchant);
      setCategoryId(editing.categoryId);
      setDate(editing.date);
      setPaymentMethod(editing.paymentMethod ?? "");
      setNotes(editing.notes ?? "");
      setReceiptId(editing.receiptId);
      setPendingReceipt(null);
      const activeReimb = reimbursementByExpenseId[editing.id];
      setRequestReimbursement(Boolean(activeReimb));
      if (editing.receiptId) {
        repo.getReceipt(editing.receiptId).then((r) => setReceiptPreview(r?.dataUrl ?? null));
      } else {
        setReceiptPreview(null);
      }
    } else {
      setAmount("");
      setMerchant("");
      setCategoryId(activeCategories[0]?.id ?? "");
      setDate(todayISO());
      setPaymentMethod("");
      setNotes("");
      setRequestReimbursement(false);
      setReceiptId(undefined);
      setPendingReceipt(null);
      setReceiptPreview(null);
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, reimbursementByExpenseId]);

  const clearReceipt = () => {
    if (receiptPreview?.startsWith("blob:")) URL.revokeObjectURL(receiptPreview);
    setReceiptId(undefined);
    setPendingReceipt(null);
    setReceiptPreview(null);
  };

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttaching(true);
    const blobUrl = URL.createObjectURL(file);
    setReceiptPreview(blobUrl);
    try {
      const dataUrl = await compressImage(file);
      URL.revokeObjectURL(blobUrl);
      setPendingReceipt(dataUrl);
      setReceiptPreview(dataUrl);
      setReceiptId(undefined);
      show("Receipt attached — tap Add expense to save");
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setPendingReceipt(null);
      setReceiptPreview(null);
      show(err instanceof Error ? err.message : "Could not attach receipt");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    const next: typeof errors = {};
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) next.amount = "Enter an amount greater than 0";
    if (!categoryId) next.category = "Pick a category";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      let finalReceiptId = receiptId;
      if (pendingReceipt) {
        const receipt = await repo.saveReceipt(pendingReceipt);
        finalReceiptId = receipt.id;
      } else if (!receiptPreview) {
        finalReceiptId = undefined;
      }

      const reimbPayload =
        requestReimbursement && reimbursementPartner
          ? {
              payerEmail: reimbursementPartner.email,
              payerName: reimbursementPartner.name,
              requesterName: user?.displayName || user?.email.split("@")[0] || "User",
            }
          : undefined;

      const payload = {
        amount: amt,
        merchant: merchant.trim() || "Untitled",
        categoryId,
        date,
        paymentMethod: paymentMethod.trim() || undefined,
        notes: notes.trim() || undefined,
        receiptId: finalReceiptId,
        requestReimbursement: !editing ? reimbPayload : reimbPayload && !existingReimbursement ? reimbPayload : undefined,
        clearReimbursement:
          Boolean(editing && existingReimbursement?.status === "pending" && !requestReimbursement),
      };
      if (editing) {
        await editExpense(editing.id, payload);
        if (reimbPayload && !existingReimbursement) {
          show(`Expense updated — ${reimbursementPartner!.name} will be notified to reimburse`);
        } else {
          show("Expense updated");
        }
      } else {
        await addExpense(payload);
        show(
          requestReimbursement && reimbursementPartner
            ? `Expense added — ${reimbursementPartner.name} will be notified to reimburse`
            : "Expense added",
        );
      }
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit expense" : "Add expense"}
      footer={
        <Button
          variant="primary"
          fullWidth
          onClick={submit}
          disabled={saving || attaching}
          data-testid={editing ? "expense-save" : "expense-submit"}
        >
          {editing ? "Save changes" : "Add expense"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6" data-testid="expense-form">
        <TextField
          label="Amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          autoFocus
          data-testid="expense-amount"
        />
        <TextField
          label="Merchant / description"
          placeholder="e.g. Blue Bottle Coffee"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          data-testid="expense-merchant"
        />

        <div className="flex flex-col gap-2" data-testid="expense-categories">
          <span className="text-caption-strong text-ink-muted-80">Category</span>
          <div className="flex flex-wrap gap-2">
            {activeCategories.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === categoryId}
                onClick={() => setCategoryId(c.id)}
                leftIcon={<CategoryGlyph icon={c.icon} size={16} />}
              >
                {c.name}
              </Chip>
            ))}
          </div>
          {errors.category && (
            <span className="text-caption text-ink-muted-48">{errors.category}</span>
          )}
        </div>

        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="expense-date"
        />
        <TextField
          label="Payment method (optional)"
          placeholder="e.g. Visa •• 4242"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          data-testid="expense-payment"
        />
        <TextArea
          label="Notes (optional)"
          rows={3}
          placeholder="Anything worth remembering"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="expense-notes"
        />

        {reimbursementPartner && (
          <label
            className={`flex items-start gap-3 rounded-md border border-hairline px-4 py-3 ${
              reimbursementLocked ? "opacity-80 cursor-default" : "cursor-pointer"
            }`}
            data-testid="expense-reimbursement-toggle"
          >
            <input
              type="checkbox"
              checked={requestReimbursement}
              disabled={reimbursementLocked}
              onChange={(e) => setRequestReimbursement(e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary disabled:opacity-50"
            />
            <span>
              <span className="text-body-strong text-ink block">Request reimbursement</span>
              <span className="text-caption text-ink-muted-48">
                {reimbursementLocked
                  ? `${existingReimbursement!.payerName} marked this paid — confirm on the dashboard.`
                  : `Ask ${reimbursementPartner.name} to pay you back. After they mark paid, you confirm receipt and the expense is removed.`}
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col gap-2" data-testid="expense-receipt">
          <span className="text-caption-strong text-ink-muted-80">Receipt (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={handleReceipt}
          />
          {receiptPreview ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="View receipt"
                onClick={() => setReceiptLightbox(receiptPreview)}
                className="shrink-0 outline-none"
              >
                <img
                  src={receiptPreview}
                  alt="Receipt"
                  className="h-20 w-20 rounded-sm object-cover shadow-product"
                />
              </button>
              <Button variant="secondary" onClick={clearReceipt}>
                <TrashIcon size={18} /> Remove
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              disabled={attaching}
              onClick={() => fileRef.current?.click()}
              data-testid="expense-receipt-add"
            >
              <CameraIcon size={18} /> {attaching ? "Processing…" : "Add receipt"}
            </Button>
          )}
        </div>
      </div>
      <Lightbox src={receiptLightbox} onClose={() => setReceiptLightbox(null)} />
    </Sheet>
  );
}
