import {
  readBadgeCount,
  readLastBadgeNotificationId,
  writeBadgeCount,
  writeLastBadgeNotificationId,
} from "./badgeStore";

export function appBadgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

export async function applyAppBadge(count: number): Promise<void> {
  if (!appBadgeSupported()) return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) await nav.setAppBadge!(count);
  else await nav.clearAppBadge!();
}

/** Bump the installed PWA icon badge (deduped by notification id when provided). */
export async function incrementAppBadgeForNotification(notificationId?: string): Promise<number> {
  if (notificationId) {
    const last = await readLastBadgeNotificationId();
    if (last === notificationId) return readBadgeCount();
    await writeLastBadgeNotificationId(notificationId);
  }
  const count = (await readBadgeCount()) + 1;
  await writeBadgeCount(count);
  await applyAppBadge(count);
  return count;
}

export async function clearAppBadge(): Promise<void> {
  await writeBadgeCount(0);
  await writeLastBadgeNotificationId("");
  await applyAppBadge(0);
}

export async function syncAppBadgeFromStore(): Promise<void> {
  const count = await readBadgeCount();
  await applyAppBadge(count);
}
