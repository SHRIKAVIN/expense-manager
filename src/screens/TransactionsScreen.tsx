import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { ExpenseRow } from "@/features/ExpenseRow";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { ExpenseDetailSheet } from "@/features/ExpenseDetailSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { filterByMonth, groupByDay } from "@/lib/analytics";
import { exportExpensesPdf } from "@/lib/exportPdf";
import {
  currentMonthKey,
  formatCurrency,
  formatDayHeading,
  isOverallPeriod,
  monthLabel,
  OVERALL_MONTH_KEY,
  todayISO,
} from "@/lib/format";
import {
  CategoryGlyph,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  ListIcon,
  SearchIcon,
} from "@/lib/icons";
import {
  collectPopularTags,
  expenseHasTag,
  expenseMatchesQuery,
  formatTagLabel,
  normalizeTag,
} from "@/lib/tags";
import type { Expense } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

function monthDateBounds(monthKey: string): { from: string; to: string } {
  if (isOverallPeriod(monthKey)) {
    return { from: "1970-01-01", to: todayISO() };
  }
  const [y, m] = monthKey.split("-").map(Number);
  const from = `${monthKey}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  const today = todayISO();
  if (monthKey === currentMonthKey() && monthEnd > today) {
    return { from, to: today };
  }
  return { from, to: monthEnd };
}

export function TransactionsScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, categories, categoriesById, removeExpense } = useAppData();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [activeTag, setActiveTag] = useState<string | null>(() =>
    normalizeTag(searchParams.get("tag") ?? ""),
  );
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<{
    amountLabel: string;
    detail?: string;
  } | null>(null);

  const minMonth = useMemo(() => {
    if (expenses.length === 0) return undefined;
    return expenses.reduce(
      (min, e) => (e.date.slice(0, 7) < min ? e.date.slice(0, 7) : min),
      currentMonthKey(),
    );
  }, [expenses]);

  const popularTags = useMemo(() => collectPopularTags(expenses), [expenses]);
  const isGlobalSearch = Boolean(search.trim() || activeTag);

  useEffect(() => {
    if (!minMonth) return;
    if (isOverallPeriod(selectedMonth)) return;
    if (selectedMonth < minMonth) setSelectedMonth(minMonth);
  }, [minMonth, selectedMonth]);

  // Deep-link: /transactions?q=…&tag=…&focus=1
  useEffect(() => {
    const q = searchParams.get("q");
    const tag = normalizeTag(searchParams.get("tag") ?? "");
    if (q != null) setSearch(q);
    setActiveTag(tag);
    if (q || tag) setSelectedMonth(OVERALL_MONTH_KEY);
    if (searchParams.get("focus") === "1") {
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    }
    // Only react to inbound URL changes, not every local keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!isGlobalSearch) return;
    if (!isOverallPeriod(selectedMonth)) setSelectedMonth(OVERALL_MONTH_KEY);
  }, [isGlobalSearch, selectedMonth]);

  const activeCategories = categories.filter((c) => !c.archived);
  const monthBounds = useMemo(() => monthDateBounds(selectedMonth), [selectedMonth]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const monthScoped = isGlobalSearch ? expenses : filterByMonth(expenses, selectedMonth);
    return monthScoped.filter((e) => {
      if (activeCat && e.categoryId !== activeCat) return false;
      if (activeTag && !expenseHasTag(e, activeTag)) return false;
      if (!q) return true;
      return expenseMatchesQuery(
        {
          amount: e.amount,
          merchant: e.merchant,
          notes: e.notes,
          paymentMethod: e.paymentMethod,
          tags: e.tags,
          categoryName: categoriesById[e.categoryId]?.name,
        },
        q,
      );
    });
  }, [
    expenses,
    search,
    activeCat,
    activeTag,
    categoriesById,
    selectedMonth,
    isGlobalSearch,
  ]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const onTagToggle = (tag: string) => {
    const nextTag = activeTag === tag ? null : tag;
    setActiveTag(nextTag);
    const next = new URLSearchParams(searchParams);
    if (nextTag) next.set("tag", nextTag);
    else next.delete("tag");
    setSearchParams(next, { replace: true });
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    await removeExpense(target.id);
    setConfirmTarget(null);
    setDeleteSuccess({
      amountLabel: formatCurrency(target.amount, currency),
      detail: target.merchant,
    });
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
        dateRange: monthBounds,
      });
      show("PDF downloaded");
    } catch (err) {
      show(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <Screen topInset={false} data-testid="transactions-screen">
      <ScreenHeader title="Transactions" />

      <div className="mb-4" data-testid="transactions-month-picker">
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          minMonth={minMonth}
          data-testid="transactions-month-select"
        />
        {isGlobalSearch && (
          <p className="text-caption text-ink-muted-48 mt-2 px-1">
            Searching all time — clear search/tags to filter by month again.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 mb-5" data-testid="transactions-filters">
        <TextField
          ref={searchInputRef}
          shape="pill"
          placeholder="Search merchant, notes, amount, #tags…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          clearable
          onClear={() => onSearchChange("")}
          leftAdornment={<SearchIcon size={18} />}
          data-testid="transactions-search"
        />

        {popularTags.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5"
            data-testid="transactions-tag-chips"
          >
            {popularTags.map((tag) => (
              <Chip
                key={tag}
                selected={activeTag === tag}
                onClick={() => onTagToggle(tag)}
                data-testid={`transactions-tag-${tag}`}
              >
                {formatTagLabel(tag)}
              </Chip>
            ))}
          </div>
        )}

        <div
          className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5"
          data-testid="transactions-category-chips"
        >
          <Chip
            selected={activeCat === null}
            onClick={() => setActiveCat(null)}
            data-testid="transactions-chip-all"
          >
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

        <Card padded={false} className="overflow-hidden" data-testid="transactions-export-card">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 outline-none"
            aria-expanded={filtersOpen}
            data-testid="transactions-filter-toggle"
          >
            <span className="text-body-strong text-ink">Export</span>
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
                  <p className="text-caption text-ink-muted-48">
                    Showing {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
                    {isGlobalSearch ? " (all time)" : ` in ${monthLabel(selectedMonth)}`}
                  </p>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={exportPdf}
                    data-testid="transactions-export-pdf"
                  >
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
                : "Try a different search, tag, category, or month."
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
                        onOpen={setViewing}
                        onEdit={setEditing}
                        onDelete={(exp) => setConfirmTarget(exp)}
                        deletePending={confirmTarget?.id === e.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Card>
            </div>
          ))}
        </div>
      )}

      <ExpenseDetailSheet
        expense={viewing}
        category={viewing ? categoriesById[viewing.categoryId] : undefined}
        currency={currency}
        onClose={() => setViewing(null)}
        onEdit={setEditing}
      />
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
      <SuccessOverlay
        open={!!deleteSuccess}
        variant="deleted"
        amountLabel={deleteSuccess?.amountLabel ?? ""}
        detail={deleteSuccess?.detail}
        onClose={() => setDeleteSuccess(null)}
      />
    </Screen>
  );
}
