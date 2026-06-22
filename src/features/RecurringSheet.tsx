import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { SegmentedControl, type Segment } from "@/components/SegmentedControl";
import { CategoryGlyph } from "@/lib/icons";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { todayISO } from "@/lib/format";
import type { Recurring, RecurringFrequency } from "@/lib/types";

const FREQ: Segment<RecurringFrequency>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

interface RecurringSheetProps {
  open: boolean;
  onClose: () => void;
  editing?: Recurring | null;
}

export function RecurringSheet({ open, onClose, editing }: RecurringSheetProps) {
  const { categories, addRecurring, editRecurring } = useAppData();
  const { show } = useToast();
  const activeCategories = categories.filter((c) => !c.archived);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [nextDue, setNextDue] = useState(todayISO());
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setAmount(editing ? String(editing.amount) : "");
    setMerchant(editing?.merchant ?? "");
    setCategoryId(editing?.categoryId ?? activeCategories[0]?.id ?? "");
    setFrequency(editing?.frequency ?? "monthly");
    setNextDue(editing?.nextDue ?? todayISO());
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    if (!categoryId) {
      setError("Pick a category");
      return;
    }
    try {
      const payload = {
        amount: amt,
        merchant: merchant.trim() || "Recurring",
        categoryId,
        frequency,
        nextDue,
      };
      if (editing) {
        await editRecurring(editing.id, payload);
        show("Recurring updated");
      } else {
        await addRecurring(payload);
        show("Recurring added");
      }
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit recurring" : "New recurring expense"}
      footer={
        <Button variant="primary" fullWidth onClick={submit}>
          {editing ? "Save changes" : "Add recurring"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <TextField
          label="Amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error}
          autoFocus
        />
        <TextField
          label="Merchant / description"
          placeholder="e.g. Netflix"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
        <div className="flex flex-col gap-2">
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
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-caption-strong text-ink-muted-80">Frequency</span>
          <SegmentedControl
            ariaLabel="Frequency"
            segments={FREQ}
            value={frequency}
            onChange={setFrequency}
          />
        </div>
        <TextField
          label="Next due date"
          type="date"
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
