import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
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
import { formatDayHeading } from "@/lib/format";
import { CategoryGlyph, ListIcon, SearchIcon } from "@/lib/icons";
import type { Expense } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

export function TransactionsScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, categories, categoriesById, removeExpense } = useAppData();
  const { show } = useToast();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);

  const activeCategories = categories.filter((c) => !c.archived);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (activeCat && e.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        e.merchant.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q) ||
        (e.paymentMethod ?? "").toLowerCase().includes(q) ||
        (categoriesById[e.categoryId]?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, activeCat, categoriesById]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    await removeExpense(confirmTarget.id);
    show("Expense deleted");
    setConfirmTarget(null);
  };

  return (
    <Screen topInset={false}>
      <ScreenHeader title="Transactions" />

      <div className="flex flex-col gap-3 mb-5">
        <TextField
          shape="pill"
          placeholder="Search merchants, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftAdornment={<SearchIcon size={18} />}
        />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          <Chip selected={activeCat === null} onClick={() => setActiveCat(null)}>
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
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListIcon size={48} />}
            headline={expenses.length === 0 ? "No transactions yet" : "Nothing matches"}
            subcopy={
              expenses.length === 0
                ? "Tap the + button to record your first expense."
                : "Try a different search or category filter."
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
