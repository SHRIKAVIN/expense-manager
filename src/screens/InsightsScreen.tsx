import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { SegmentedControl, type Segment } from "@/components/SegmentedControl";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import {
  monthOverMonth,
  monthlyTrend,
  spendByCategory,
  weeklyTrend,
  yearlyTrend,
  filterByMonth,
  sum,
  sumIncome,
} from "@/lib/analytics";
import { Chip } from "@/components/Chip";
import { currentMonthKey, formatCurrency, isOverallPeriod, monthLabel, shiftMonthKey } from "@/lib/format";
import { ChartIcon } from "@/lib/icons";

type Range = "week" | "month" | "year";

const RANGE_SEGMENTS: Segment<Range>[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function InsightsScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, expensesForTotals, income, categoriesById } = useAppData();
  const [range, setRange] = useState<Range>("month");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [whatIfCategoryId, setWhatIfCategoryId] = useState<string | "all">("all");
  const [whatIfCutPct, setWhatIfCutPct] = useState(20);

  const minMonth = useMemo(() => {
    if (expenses.length === 0) return undefined;
    return expenses.reduce(
      (min, e) => (e.date.slice(0, 7) < min ? e.date.slice(0, 7) : min),
      currentMonthKey(),
    );
  }, [expenses]);

  useEffect(() => {
    if (!minMonth) return;
    if (isOverallPeriod(selectedMonth)) return;
    if (selectedMonth < minMonth) setSelectedMonth(minMonth);
  }, [minMonth, selectedMonth]);

  const trend = useMemo(() => {
    if (range === "week") return weeklyTrend(expensesForTotals);
    if (range === "year" || isOverallPeriod(selectedMonth)) {
      return yearlyTrend(expensesForTotals);
    }
    return monthlyTrend(expensesForTotals, selectedMonth);
  }, [expensesForTotals, range, selectedMonth]);

  const monthExpenses = useMemo(
    () => filterByMonth(expensesForTotals, selectedMonth),
    [expensesForTotals, selectedMonth],
  );
  const categoryBars = useMemo(
    () => spendByCategory(monthExpenses, categoriesById),
    [monthExpenses, categoriesById],
  );
  const mom = useMemo(
    () => monthOverMonth(expensesForTotals, selectedMonth),
    [expensesForTotals, selectedMonth],
  );
  const momDelta = mom.current - mom.previous;
  const momPct = mom.previous > 0 ? (momDelta / mom.previous) * 100 : 0;
  const momCurrentKey = isOverallPeriod(selectedMonth)
    ? currentMonthKey()
    : selectedMonth;
  const previousMonthLabel = monthLabel(shiftMonthKey(momCurrentKey, -1));
  const currentPeriodLabel = monthLabel(momCurrentKey);
  const selectedPeriodLabel = monthLabel(selectedMonth);
  const monthIncomeTotal = useMemo(
    () => sumIncome(income, selectedMonth),
    [income, selectedMonth],
  );
  const spentTotal = useMemo(() => sum(monthExpenses), [monthExpenses]);
  const remainingNow = monthIncomeTotal - spentTotal;

  const whatIf = useMemo(() => {
    const cutRatio = whatIfCutPct / 100;
    const categorySpend =
      whatIfCategoryId === "all"
        ? spentTotal
        : sum(monthExpenses.filter((e) => e.categoryId === whatIfCategoryId));
    const saved = categorySpend * cutRatio;
    const newSpent = spentTotal - saved;
    const newRemaining = monthIncomeTotal - newSpent;
    return { saved, newSpent, newRemaining, categorySpend };
  }, [whatIfCutPct, whatIfCategoryId, spentTotal, monthExpenses, monthIncomeTotal]);

  const tooltipFormatter = (value: unknown) => formatCurrency(Number(value), currency);

  if (expenses.length === 0) {
    return (
      <Screen topInset={false}>
        <ScreenHeader title="Insights" />
        <Card>
          <EmptyState
            icon={<ChartIcon size={48} />}
            headline="No insights yet"
            subcopy="Once you log a few expenses, your spending trends and breakdowns appear here."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen topInset={false} data-testid="insights-screen">
      <ScreenHeader title="Insights" />

      <div className="mb-4" data-testid="insights-month-picker">
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          minMonth={minMonth}
          data-testid="insights-month-select"
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <p className="text-tagline text-ink">Spending trend</p>
            <SegmentedControl
              ariaLabel="Trend range"
              segments={RANGE_SEGMENTS}
              value={range}
              onChange={setRange}
            />
          </div>
          <ChartFrame className="h-56 -ml-2">
            {(width, height) => (
              <AreaChart
                width={width}
                height={height}
                data={trend}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="var(--color-divider-soft)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-ink-muted-48)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--color-hairline)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: "var(--color-ink-muted-48)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => formatCurrency(Number(v), currency).replace(/\.00$/, "")}
                />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{
                    background: "var(--color-canvas)",
                    border: "1px solid var(--color-hairline)",
                    borderRadius: 11,
                    color: "var(--color-ink)",
                  }}
                  cursor={{ stroke: "var(--color-hairline)" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="var(--color-primary)"
                  fillOpacity={0.08}
                  isAnimationActive
                />
              </AreaChart>
            )}
          </ChartFrame>
        </Card>

        <Card>
          <p className="text-tagline text-ink mb-1">Month over month</p>
          <p className="text-body text-ink-muted-48 mb-4">
            {momDelta >= 0 ? "Up" : "Down"} {Math.abs(momPct).toFixed(0)}% vs {previousMonthLabel}
          </p>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-caption text-ink-muted-48">{currentPeriodLabel}</p>
              <p className="text-tagline text-ink">{formatCurrency(mom.current, currency)}</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted-48">{previousMonthLabel}</p>
              <p className="text-tagline text-ink-muted-80">
                {formatCurrency(mom.previous, currency)}
              </p>
            </div>
          </div>
        </Card>

        {categoryBars.length > 0 && (
          <Card data-testid="insights-what-if">
            <p className="text-tagline text-ink mb-1">What if…</p>
            <p className="text-body text-ink-muted-48 mb-4">
              Cut spending and see the impact on remaining
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Chip
                selected={whatIfCategoryId === "all"}
                onClick={() => setWhatIfCategoryId("all")}
              >
                All spend
              </Chip>
              {categoryBars.slice(0, 6).map((s) => (
                <Chip
                  key={s.categoryId}
                  selected={whatIfCategoryId === s.categoryId}
                  onClick={() => setWhatIfCategoryId(s.categoryId)}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
            <label className="flex flex-col gap-2 mb-4">
              <span className="text-caption-strong text-ink-muted-80">
                Cut {whatIfCutPct}%
                {whatIfCategoryId !== "all" && categoriesById[whatIfCategoryId]
                  ? ` of ${categoriesById[whatIfCategoryId].name}`
                  : ""}
              </span>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={whatIfCutPct}
                onChange={(e) => setWhatIfCutPct(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
                data-testid="insights-what-if-slider"
              />
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-ink-muted-80">You’d save</span>
                <span className="text-body-strong text-emerald-600 tabular-nums">
                  {formatCurrency(whatIf.saved, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-ink-muted-80">New spent</span>
                <span className="text-body-strong text-ink tabular-nums">
                  {formatCurrency(whatIf.newSpent, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-2">
                <span className="text-body-strong text-ink">Remaining</span>
                <span
                  className={`text-body-strong tabular-nums ${
                    whatIf.newRemaining >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(whatIf.newRemaining, currency)}
                  <span className="text-caption text-ink-muted-48 font-normal ml-2">
                    (now {formatCurrency(remainingNow, currency)})
                  </span>
                </span>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <p className="text-tagline text-ink mb-5">
            Spend by category · {selectedPeriodLabel}
          </p>
          {categoryBars.length === 0 ? (
            <p className="text-body text-ink-muted-48">
              {isOverallPeriod(selectedMonth)
                ? "No spending recorded yet."
                : "No spending this month yet."}
            </p>
          ) : (
            <ChartFrame className="h-64 -ml-2">
              {(width, height) => (
                <BarChart
                  width={width}
                  height={height}
                  data={categoryBars}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid stroke="var(--color-divider-soft)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--color-ink-muted-48)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      formatCurrency(Number(v), currency).replace(/\.00$/, "")
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "var(--color-ink-muted-80)", fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    cursor={{ fill: "var(--color-divider-soft)" }}
                    contentStyle={{
                      background: "var(--color-canvas)",
                      border: "1px solid var(--color-hairline)",
                      borderRadius: 11,
                      color: "var(--color-ink)",
                    }}
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-primary)"
                    radius={[0, 5, 5, 0]}
                    barSize={18}
                    isAnimationActive
                  />
                </BarChart>
              )}
            </ChartFrame>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-body text-ink-muted-80">Total · {selectedPeriodLabel}</p>
            <p className="text-body-strong text-ink">{formatCurrency(sum(monthExpenses), currency)}</p>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
