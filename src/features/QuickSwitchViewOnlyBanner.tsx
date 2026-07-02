import { useAuth } from "@/auth/AuthProvider";
import {
  getQuickSwitchAccountName,
  getQuickSwitchHomeEmail,
  QUICK_SWITCH_USERS,
} from "@/auth/quickSwitch";
import type { QuickSwitchEmail } from "@/auth/quickSwitch";
import { Button } from "@/components/Button";

/** Banner when viewing a partner account via quick switch (read-only). */
export function QuickSwitchViewOnlyBanner() {
  const { user, isQuickSwitchViewOnly, switchQuickUser } = useAuth();
  if (!isQuickSwitchViewOnly || !user?.email) return null;

  const viewingName = getQuickSwitchAccountName(user.email) ?? user.displayName;
  const homeEmail = getQuickSwitchHomeEmail();
  const homeAccount = QUICK_SWITCH_USERS.find((u) => u.email === homeEmail);

  const switchBack = () => {
    if (homeEmail) void switchQuickUser(homeEmail as QuickSwitchEmail);
  };

  return (
    <div
      className="shrink-0 border-b border-hairline bg-canvas-parchment px-4 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="quick-switch-view-only-banner"
    >
      <p className="text-caption text-ink-muted-80">
        Viewing <span className="text-body-strong text-ink">{viewingName}</span>&apos;s account
        — read only
      </p>
      {homeAccount && (
        <Button variant="secondary" className="py-2 px-4 shrink-0" onClick={switchBack}>
          Back to {homeAccount.name}
        </Button>
      )}
    </div>
  );
}
