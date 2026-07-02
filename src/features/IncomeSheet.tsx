import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { currentMonthKey } from "@/lib/format";

interface IncomeSheetProps {
  open: boolean;
  onClose: () => void;
  defaultMonth?: string;
}

export function IncomeSheet({ open, onClose, defaultMonth }: IncomeSheetProps) {
  const { addIncome } = useAppData();
  const { show } = useToast();
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth ?? currentMonthKey());
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMonth(defaultMonth ?? currentMonthKey());
    setLabel("");
    setError(null);
  }, [open, defaultMonth]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addIncome({ amount: amt, month, label: label.trim() || undefined });
      show("Income added");
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not add income");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add income"
      footer={
        <Button
          variant="primary"
          fullWidth
          data-testid="income-submit"
          onClick={() => void submit()}
          disabled={saving}
        >
          Add income
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
          error={error ?? undefined}
          data-testid="income-amount"
          autoFocus
        />
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          data-testid="income-month"
        />
        <TextField
          label="Source (optional)"
          placeholder="e.g. Salary, freelance"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          data-testid="income-label"
        />
      </div>
    </Sheet>
  );
}
