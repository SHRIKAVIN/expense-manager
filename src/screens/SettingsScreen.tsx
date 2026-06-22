import { useEffect, useState, type ReactNode } from "react";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RoleBadge } from "@/components/RoleBadge";
import { CategorySheet } from "@/features/CategorySheet";
import { RecurringSheet } from "@/features/RecurringSheet";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/components/Toast";
import { usePwaInstall } from "@/lib/usePwaInstall";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import {
  ArchiveIcon,
  CategoryGlyph,
  DownloadIcon,
  EditIcon,
  LogoutIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "@/lib/icons";
import { formatCurrency, relativeDue } from "@/lib/format";
import type { Category, Recurring } from "@/lib/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD"];

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
  const { user, logout, updateProfile } = useAuth();
  const { resolved } = useTheme();
  const { categories, recurring, can, repo, editCategory, removeCategory, removeRecurring, refresh } =
    useAppData();
  const { show } = useToast();
  const { canInstall, installed, promptInstall } = usePwaInstall();

  const currency = user?.currency ?? "INR";
  const [name, setName] = useState(user?.displayName ?? "");
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

  const remindersKey = user ? `em.reminders.${user.id}` : "em.reminders";
  useEffect(() => {
    setRemindersOn(localStorage.getItem(remindersKey) === "1");
  }, [remindersKey]);

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

  const exportData = async () => {
    try {
      const json = await repo.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      show("Export downloaded");
    } catch (err) {
      show(err instanceof Error ? err.message : "Export failed");
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
    <Screen>
      <ScreenHeader title="Settings" />

      <div className="flex flex-col gap-7">
        {/* Account */}
        <Section title="Account">
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-body-strong text-ink truncate">{user?.email}</p>
                <p className="text-caption text-ink-muted-48">Local account</p>
              </div>
              <RoleBadge role={user?.role ?? "Viewer"} />
            </div>
            <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex flex-col gap-2">
              <span className="text-caption-strong text-ink-muted-80">Currency</span>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((c) => (
                  <Chip
                    key={c}
                    selected={currency === c}
                    onClick={() => updateProfile({ currency: c })}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={saveName}>
                Save
              </Button>
              <Button variant="secondary" onClick={logout}>
                <LogoutIcon size={18} /> Sign out
              </Button>
            </div>
          </Card>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-body text-ink">Theme</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-3">
              <Swatch label="Accent" varName="--color-primary" />
              <Swatch label="Canvas" varName="--color-canvas" border />
              <Swatch label="Ink" varName="--color-ink" />
              <span className="text-caption text-ink-muted-48 ml-auto">Currently {resolved}</span>
            </div>
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
                      aria-label="Archive category"
                      onClick={() => editCategory(c.id, { archived: true })}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted-48 outline-none"
                    >
                      <ArchiveIcon size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete category"
                      onClick={() => removeCategory(c.id)}
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
              <Button variant="secondary" fullWidth onClick={exportData}>
                <DownloadIcon size={18} /> Export data (JSON)
              </Button>
              <Button variant="secondary" fullWidth onClick={deleteAll}>
                <TrashIcon size={18} /> Delete all my data
              </Button>
            </Card>
          </Section>
        )}

        {/* About */}
        <Section title="About">
          <Card>
            <p className="text-body text-ink mb-1">Expense Manager</p>
            <p className="text-fine-print text-ink-muted-48">
              Version 1.0.0 · Local-only workspace. Your data lives on this device, isolated to your
              account, and never leaves it.
            </p>
          </Card>
        </Section>
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
    </Screen>
  );
}

function Swatch({ label, varName, border }: { label: string; varName: string; border?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-10 w-10 rounded-md"
        style={{
          backgroundColor: `var(${varName})`,
          border: border ? "1px solid var(--color-hairline)" : undefined,
        }}
      />
      <span className="text-fine-print text-ink-muted-48">{label}</span>
    </div>
  );
}
