import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
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
} from "@/lib/analytics";
import { currentMonthKey, formatCurrency } from "@/lib/format";
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
  const { expenses, categoriesById } = useAppData();
  const [range, setRange] = useState<Range>("month");

  const trend = useMemo(() => {
    if (range === "week") return weeklyTrend(expenses);
    if (range === "year") return yearlyTrend(expenses);
    return monthlyTrend(expenses);
  }, [expenses, range]);

  const monthExpenses = useMemo(() => filterByMonth(expenses, currentMonthKey()), [expenses]);
  const categoryBars = useMemo(
    () => spendByCategory(monthExpenses, categoriesById),
    [monthExpenses, categoriesById],
  );
  const mom = useMemo(() => monthOverMonth(expenses), [expenses]);
  const momDelta = mom.current - mom.previous;
  const momPct = mom.previous > 0 ? (momDelta / mom.previous) * 100 : 0;

  const tooltipFormatter = (value: unknown) => formatCurrency(Number(value), currency);

  if (expenses.length === 0) {
    return (
      <Screen>
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
    <Screen>
      <ScreenHeader title="Insights" />

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
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <p className="text-tagline text-ink mb-1">Month over month</p>
          <p className="text-body text-ink-muted-48 mb-4">
            {momDelta >= 0 ? "Up" : "Down"} {Math.abs(momPct).toFixed(0)}% vs last month
          </p>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-caption text-ink-muted-48">This month</p>
              <p className="text-tagline text-ink">{formatCurrency(mom.current, currency)}</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted-48">Last month</p>
              <p className="text-tagline text-ink-muted-80">
                {formatCurrency(mom.previous, currency)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-tagline text-ink mb-5">Spend by category · this month</p>
          {categoryBars.length === 0 ? (
            <p className="text-body text-ink-muted-48">No spending this month yet.</p>
          ) : (
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
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
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-body text-ink-muted-80">Total this month</p>
            <p className="text-body-strong text-ink">{formatCurrency(sum(monthExpenses), currency)}</p>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
