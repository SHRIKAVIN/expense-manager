import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/features/ExpenseRow";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { groupByDay } from "@/lib/analytics";
import { exportExpensesPdf } from "@/lib/exportPdf";
import { formatDayHeading, todayISO } from "@/lib/format";
import {
  CategoryGlyph,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  ListIcon,
  SearchIcon,
} from "@/lib/icons";
import type { Expense } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TransactionsScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, categories, categoriesById, removeExpense } = useAppData();
  const { show } = useToast();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);

  const activeCategories = categories.filter((c) => !c.archived);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (e.date < dateFrom || e.date > dateTo) return false;
      if (activeCat && e.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        e.merchant.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q) ||
        (e.paymentMethod ?? "").toLowerCase().includes(q) ||
        (categoriesById[e.categoryId]?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, activeCat, categoriesById, dateFrom, dateTo]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    await removeExpense(confirmTarget.id);
    show("Expense deleted");
    setConfirmTarget(null);
  };

  const exportPdf = async () => {
    if (filtered.length === 0) {
      show("Nothing to export for this filter");
      return;
    }
    try {
      await exportExpensesPdf(filtered, {
        title: "Expense Manager — Transactions",
        currency,
        categoriesById,
        user: {
          name: user?.displayName ?? "User",
          email: user?.email ?? "",
        },
        dateRange: { from: dateFrom, to: dateTo },
      });
      show("PDF downloaded");
    } catch (err) {
      show(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <Screen topInset={false} data-testid="transactions-screen">
      <ScreenHeader title="Transactions" />

      <div className="flex flex-col gap-3 mb-5" data-testid="transactions-filters">
        <TextField
          shape="pill"
          placeholder="Search merchants, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          clearable
          onClear={() => setSearch("")}
          leftAdornment={<SearchIcon size={18} />}
          data-testid="transactions-search"
        />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="transactions-category-chips">
          <Chip selected={activeCat === null} onClick={() => setActiveCat(null)} data-testid="transactions-chip-all">
            All
          </Chip>
          {activeCategories.map((c) => (
            <Chip
              key={c.id}
              selected={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              leftIcon={<CategoryGlyph icon={c.icon} size={16} />}
            >
              {c.name}
            </Chip>
          ))}
        </div>

        {/* Collapsible date-range filter + PDF export */}
        <Card padded={false} className="overflow-hidden" data-testid="transactions-export-card">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 outline-none"
            aria-expanded={filtersOpen}
            data-testid="transactions-filter-toggle"
          >
            <span className="text-body-strong text-ink">Filter and Export</span>
            {filtersOpen ? (
              <ChevronUpIcon size={20} className="text-ink-muted-48" />
            ) : (
              <ChevronDownIcon size={20} className="text-ink-muted-48" />
            )}
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1 flex flex-col gap-4 border-t border-divider-soft">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="From"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <TextField
                      label="To"
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <p className="text-caption text-ink-muted-48">
                    Showing {filtered.length} transaction{filtered.length === 1 ? "" : "s"} in
                    this range
                  </p>
                  <Button variant="secondary" fullWidth onClick={exportPdf} data-testid="transactions-export-pdf">
                    <DownloadIcon size={18} /> Download PDF
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListIcon size={48} />}
            headline={expenses.length === 0 ? "No transactions yet" : "Nothing matches"}
            subcopy={
              expenses.length === 0
                ? "Tap the + button to record your first expense."
                : "Try a different search, category, or date range."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.date}>
              <p className="text-caption-strong text-ink-muted-48 uppercase tracking-wide mb-2 px-1">
                {formatDayHeading(group.date)}
              </p>
              <Card padded={false} className="overflow-hidden">
                <AnimatePresence initial={false}>
                  {group.items.map((e, i) => (
                    <motion.div
                      key={e.id}
                      layout
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ delay: i * 0.03 }}
                    >
                      <ExpenseRow
                        expense={e}
                        category={categoriesById[e.categoryId]}
                        currency={currency}
                        onEdit={setEditing}
                        onDelete={(e) => setConfirmTarget(e)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Card>
            </div>
          ))}
        </div>
      )}

      <ExpenseSheet open={!!editing} editing={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete expense?"
        message={
          confirmTarget
            ? `"${confirmTarget.merchant}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setConfirmTarget(null)}
      />
    </Screen>
  );
}
