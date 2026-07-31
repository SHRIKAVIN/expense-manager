import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  currentMonthKey,
  listMonthKeys,
  monthLabel,
  OVERALL_MONTH_KEY,
  shiftMonthKey,
} from "@/lib/format";
import { ChevronDownIcon } from "@/lib/icons";

interface MonthPickerProps {
  value: string;
  onChange: (monthKey: string) => void;
  /** Earliest month available in the list (yyyy-mm). */
  minMonth?: string;
  /** Include an “Overall” (all-time) option. Defaults to true. */
  includeOverall?: boolean;
  className?: string;
  "data-testid"?: string;
}

/** Native `<select>` month picker — uses the OS dropdown/wheel on mobile. */
export function MonthPicker({
  value,
  onChange,
  minMonth,
  includeOverall = true,
  className,
  "data-testid": testId,
}: MonthPickerProps) {
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
        data-testid={testId}
        className="appearance-none rounded-md border border-hairline bg-surface-pearl pl-3.5 pr-10 py-2.5 text-body text-ink outline-none focus:ring-2 focus:ring-primary-focus"
      >
        {includeOverall && (
          <option value={OVERALL_MONTH_KEY}>Overall</option>
        )}
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
