import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { CategorySlice } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";

interface CategoryDonutProps {
  slices: CategorySlice[];
  currency: string;
  total: number;
  animate?: boolean;
}

/** Monochrome donut: single Action Blue hue, differentiated by opacity (no 2nd color). */
export function CategoryDonut({ slices, currency, total, animate = true }: CategoryDonutProps) {
  const data = slices.length ? slices : [{ categoryId: "none", name: "None", icon: "other", total: 1 }];
  const step = data.length > 1 ? 0.6 / (data.length - 1) : 0;

  return (
    <div className="relative h-48 w-48 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={animate}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={slices.length ? "var(--color-primary)" : "var(--color-divider-soft)"}
                fillOpacity={slices.length ? 1 - i * step : 1}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-caption text-ink-muted-48">Spent</span>
        <span className="text-body-strong text-ink">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
}
