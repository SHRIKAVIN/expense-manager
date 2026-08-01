import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Live-sync reimbursements while the app is open.
 * Relies on RLS (no email filters) so the payer always receives events for
 * rows they can SELECT — inserts, amount updates, deletes, status changes.
 *
 * PWAs (especially iOS) often suspend Realtime WebSockets; we resubscribe on
 * resume/errors and poll lightly in standalone mode as a fallback.
 */
export function ReimbursementSyncListener() {
  const { user } = useAuth();
  const { refresh } = useAppData();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!user || !isSupabaseEnabled()) return;

    const sb = getSupabase();
    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    let reconnectAttempt = 0;

    const onChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshRef.current();
      }, 120);
    };

    const removeChannel = () => {
      if (!channel) return;
      const ch = channel;
      channel = null;
      void sb.removeChannel(ch);
    };

    const subscribe = () => {
      if (disposed) return;
      removeChannel();

      const ch = sb
        .channel(`reimbursement-sync-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reimbursement_requests",
          },
          onChange,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            reconnectAttempt = 0;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            window.clearTimeout(reconnectTimer);
            const delay = Math.min(8_000, 800 * 2 ** reconnectAttempt);
            reconnectAttempt += 1;
            reconnectTimer = setTimeout(subscribe, delay);
          }
        });

      channel = ch;
    };

    const wake = () => {
      if (disposed) return;
      void refreshRef.current();
      subscribe();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };

    subscribe();

    // Standalone PWAs frequently miss Realtime events while "open" — soft poll.
    if (isStandalonePwa()) {
      pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshRef.current();
        }
      }, 12_000);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "em-partner-push") {
        void refreshRef.current();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      disposed = true;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      removeChannel();
    };
  }, [user]);

  return null;
}
