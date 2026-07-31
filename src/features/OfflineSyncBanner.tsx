import { useEffect, useState } from "react";
import { useAppData } from "@/data/AppDataProvider";
import { isOffline } from "@/lib/offlineQueue";

/** Subtle banner when expense writes are queued offline. */
export function OfflineSyncBanner() {
  const { pendingSyncCount } = useAppData();
  const [offline, setOffline] = useState(() => isOffline());

  useEffect(() => {
    const sync = () => setOffline(isOffline());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline && pendingSyncCount === 0) return null;

  return (
    <div
      className="lg:hidden shrink-0 px-4 py-2 text-center text-caption bg-amber-500/15 text-amber-800 dark:text-amber-200 border-b border-amber-500/20"
      data-testid="offline-sync-banner"
      role="status"
    >
      {offline
        ? pendingSyncCount > 0
          ? `Offline · ${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} will sync when you’re back online`
          : "You’re offline — new expenses will sync later"
        : `Syncing ${pendingSyncCount} queued change${pendingSyncCount === 1 ? "" : "s"}…`}
    </div>
  );
}
