import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CategorySheet } from "@/features/CategorySheet";
import { RecurringSheet } from "@/features/RecurringSheet";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { useToast } from "@/components/Toast";
import { usePwaInstall } from "@/lib/usePwaInstall";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import {
  CategoryGlyph,
  DownloadIcon,
  EditIcon,
  LogoutIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "@/lib/icons";
import { formatCurrency, relativeDue } from "@/lib/format";
import { exportExpensesPdf } from "@/lib/exportPdf";
import type { QuickSwitchEmail } from "@/auth/quickSwitch";
import type { Category, Recurring } from "@/lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-caption-strong text-ink-muted-48 uppercase tracking-wide mb-2 px-1">
        {title}
      </p>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { user, logout, updateProfile, canQuickSwitch, quickSwitchUsers, switchQuickUser } = useAuth();
  const { categories, recurring, expenses, categoriesById, can, repo, removeCategory, removeRecurring, refresh } =
    useAppData();
  const { show } = useToast();
  const { canInstall, installed, promptInstall } = usePwaInstall();

  const currency = user?.currency ?? "INR";
  const savedName = user?.displayName ?? "";
  const [name, setName] = useState(savedName);
  const nameDirty = name.trim() !== savedName.trim();
  const canSaveName = nameDirty && name.trim().length > 0;
  const [perm, setPerm] = useState(notificationPermission());
  const [remindersOn, setRemindersOn] = useState(false);

  const [catSheet, setCatSheet] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  });
  const [recSheet, setRecSheet] = useState<{ open: boolean; editing: Recurring | null }>({
    open: false,
    editing: null,
  });
  const [confirmCategory, setConfirmCategory] = useState<Category | null>(null);

  const confirmCategoryExpenseCount = useMemo(() => {
    if (!confirmCategory) return 0;
    return expenses.filter((e) => e.categoryId === confirmCategory.id).length;
  }, [confirmCategory, expenses]);

  const remindersKey = user ? `em.reminders.${user.id}` : "em.reminders";
  useEffect(() => {
    setRemindersOn(localStorage.getItem(remindersKey) === "1");
  }, [remindersKey]);

  useEffect(() => {
    setName(user?.displayName ?? "");
  }, [user?.displayName]);

  const activeCategories = categories.filter((c) => !c.archived);

  const saveName = async () => {
    await updateProfile({ displayName: name.trim() || user?.displayName || "" });
    show("Profile updated");
  };

  const toggleReminders = async () => {
    if (!remindersOn) {
      const p = await requestNotificationPermission();
      setPerm(p);
      if (p === "granted") {
        localStorage.setItem(remindersKey, "1");
        setRemindersOn(true);
        show("Reminders on");
      } else {
        show("Notification permission denied");
      }
    } else {
      localStorage.removeItem(remindersKey);
      setRemindersOn(false);
      show("Reminders off");
    }
  };

  const exportPdf = async () => {
    try {
      await exportExpensesPdf(expenses, {
        title: "Expense Manager — All Transactions",
        currency,
        categoriesById,
        user: {
          name: user?.displayName ?? "User",
          email: user?.email ?? "",
        },
      });
      show("PDF downloaded");
    } catch (err) {
      show(err instanceof Error ? err.message : "Export failed");
    }
  };

  const confirmDeleteCategory = async () => {
    if (!confirmCategory) return;
    const hadExpenses = confirmCategoryExpenseCount > 0;
    await removeCategory(confirmCategory.id);
    show(hadExpenses ? "Category archived" : "Category deleted");
    setConfirmCategory(null);
  };

  const handleQuickSwitch = async (email: QuickSwitchEmail) => {
    if (user?.email.toLowerCase() === email) return;
    const account = quickSwitchUsers.find((u) => u.email === email);
    try {
      await switchQuickUser(email);
      show(`Switched to ${account?.name ?? "user"}`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not switch user");
    }
  };

  const deleteAll = async () => {
    const ok = window.confirm(
      "Delete all your data? This removes every transaction, category and budget for your account. This cannot be undone.",
    );
    if (!ok) return;
    try {
      await repo.wipeUserData();
      await repo.ensureWorkspace();
      await refresh();
      show("All data cleared");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not clear data");
    }
  };

  return (
    <Screen topInset={false} data-testid="settings-screen">
      <ScreenHeader title="Settings" />

      <div className="flex flex-col gap-7">
        {/* Account */}
        <Section title="Account">
          <Card className="flex flex-col gap-5" data-testid="settings-account">
            <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} data-testid="settings-display-name" />
            <div className="flex gap-3">
              <Button variant="primary" onClick={saveName} disabled={!canSaveName} data-testid="settings-save-name">
                Save
              </Button>
              <Button variant="secondary" onClick={logout} data-testid="settings-sign-out">
                <LogoutIcon size={18} /> Sign out
              </Button>
            </div>
          </Card>
        </Section>

        {canQuickSwitch && (
          <Section title="Switch user">
            <Card className="flex flex-col gap-3" data-testid="settings-quick-switch">
              <p className="text-caption text-ink-muted-48">
                Switch between demo accounts without signing in again.
              </p>
              {quickSwitchUsers.map((account) => {
                const active = user?.email.toLowerCase() === account.email;
                return (
                  <Button
                    key={account.email}
                    variant={active ? "primary" : "secondary"}
                    fullWidth
                    disabled={active}
                    data-testid={`settings-switch-${account.name.toLowerCase()}`}
                    onClick={() => void handleQuickSwitch(account.email)}
                  >
                    {active ? `Active: ${account.name}` : `Switch to ${account.name}`}
                  </Button>
                );
              })}
            </Card>
          </Section>
        )}

        {/* Appearance */}
        <Section title="Appearance">
          <Card className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-body text-ink">Theme</span>
            <ThemeToggle />
          </Card>
        </Section>

        {/* Categories */}
        <Section title="Categories">
          <Card padded={false} className="overflow-hidden">
            {activeCategories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-divider-soft last:border-b-0"
              >
                <div className="h-9 w-9 rounded-sm bg-canvas-parchment flex items-center justify-center text-ink shrink-0">
                  <CategoryGlyph icon={c.icon} size={18} />
                </div>
                <span className="text-body text-ink flex-1 truncate">{c.name}</span>
                {c.monthlyBudget ? (
                  <span className="text-caption text-ink-muted-48">
                    {formatCurrency(c.monthlyBudget, currency)}/mo
                  </span>
                ) : null}
                {can.manageConfig && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit category"
                      onClick={() => setCatSheet({ open: true, editing: c })}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-primary outline-none"
                    >
                      <EditIcon size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete category"
                      onClick={() => setConfirmCategory(c)}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted-48 outline-none"
                    >
                      <TrashIcon size={17} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {can.manageConfig && (
              <button
                type="button"
                onClick={() => setCatSheet({ open: true, editing: null })}
                className="w-full flex items-center gap-2 px-5 py-4 text-primary text-body outline-none"
              >
                <PlusIcon size={18} /> Add category
              </button>
            )}
          </Card>
        </Section>

        {/* Recurring */}
        <Section title="Recurring expenses">
          <Card padded={false} className="overflow-hidden">
            {recurring.length === 0 && (
              <p className="px-5 py-4 text-body text-ink-muted-48">No recurring expenses yet.</p>
            )}
            {recurring.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-divider-soft last:border-b-0"
              >
                <div className="h-9 w-9 rounded-sm bg-canvas-parchment flex items-center justify-center text-primary shrink-0">
                  <RepeatIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body text-ink truncate">
                    {r.merchant} · {formatCurrency(r.amount, currency)}
                  </p>
                  <p className="text-caption text-ink-muted-48">
                    {r.frequency} · {relativeDue(r.nextDue)}
                  </p>
                </div>
                {can.manageRecurring && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit recurring"
                      onClick={() => setRecSheet({ open: true, editing: r })}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-primary outline-none"
                    >
                      <EditIcon size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete recurring"
                      onClick={() => removeRecurring(r.id)}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted-48 outline-none"
                    >
                      <TrashIcon size={17} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {can.manageRecurring && (
              <button
                type="button"
                onClick={() => setRecSheet({ open: true, editing: null })}
                className="w-full flex items-center gap-2 px-5 py-4 text-primary text-body outline-none"
              >
                <PlusIcon size={18} /> Add recurring expense
              </button>
            )}
          </Card>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Card className="flex items-center justify-between gap-4">
            <div>
              <p className="text-body text-ink">Recurring reminders</p>
              <p className="text-caption text-ink-muted-48">
                {perm === "unsupported"
                  ? "Not supported on this device"
                  : "Get notified before recurring expenses are due"}
              </p>
            </div>
            <Button
              variant={remindersOn ? "secondary" : "primary"}
              onClick={toggleReminders}
              disabled={perm === "unsupported"}
            >
              {remindersOn ? "On" : "Enable"}
            </Button>
          </Card>
        </Section>

        {/* App install */}
        {!installed && (
          <Section title="App">
            <Card className="flex items-center justify-between gap-4">
              <div>
                <p className="text-body text-ink">Install Expense Manager</p>
                <p className="text-caption text-ink-muted-48">
                  Add to your home screen for offline access
                </p>
              </div>
              <Button variant="primary" onClick={promptInstall} disabled={!canInstall}>
                Install App
              </Button>
            </Card>
          </Section>
        )}

        {/* Data */}
        {can.exportData && (
          <Section title="Data">
            <Card className="flex flex-col gap-3">
              <Button variant="secondary" fullWidth onClick={exportPdf}>
                <DownloadIcon size={18} /> Export PDF
              </Button>
              <Button variant="secondary" fullWidth onClick={deleteAll}>
                <TrashIcon size={18} /> Delete all my data
              </Button>
            </Card>
          </Section>
        )}

      </div>

      <CategorySheet
        open={catSheet.open}
        editing={catSheet.editing}
        onClose={() => setCatSheet({ open: false, editing: null })}
      />
      <RecurringSheet
        open={recSheet.open}
        editing={recSheet.editing}
        onClose={() => setRecSheet({ open: false, editing: null })}
      />
      <ConfirmDialog
        open={!!confirmCategory}
        title="Delete category?"
        message={
          confirmCategory
            ? confirmCategoryExpenseCount > 0
              ? `"${confirmCategory.name}" has ${confirmCategoryExpenseCount} transaction${confirmCategoryExpenseCount === 1 ? "" : "s"}. It will be archived and hidden from new expenses.`
              : `"${confirmCategory.name}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={() => void confirmDeleteCategory()}
        onClose={() => setConfirmCategory(null)}
      />
    </Screen>
  );
}
