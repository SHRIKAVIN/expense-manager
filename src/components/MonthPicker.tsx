import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { currentMonthKey, listMonthKeys, monthLabel, shiftMonthKey } from "@/lib/format";
import { ChevronDownIcon } from "@/lib/icons";

interface MonthPickerProps {
  value: string;
  onChange: (monthKey: string) => void;
  /** Earliest month available in the list (yyyy-mm). */
  minMonth?: string;
  className?: string;
}

/** Native `<select>` month picker — uses the OS dropdown/wheel on mobile. */
export function MonthPicker({ value, onChange, minMonth, className }: MonthPickerProps) {
  const months = useMemo(() => {
    const to = currentMonthKey();
    const from = minMonth ?? shiftMonthKey(to, -23);
    return listMonthKeys(from, to);
  }, [minMonth]);

  return (
    <div className={cn("relative inline-block", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select month"
        className="appearance-none rounded-md border border-hairline bg-surface-pearl pl-3.5 pr-10 py-2.5 text-body text-ink outline-none focus:ring-2 focus:ring-primary-focus"
      >
        {months.map((key) => (
          <option key={key} value={key}>
            {monthLabel(key)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={18}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted-48"
      />
    </div>
  );
}
