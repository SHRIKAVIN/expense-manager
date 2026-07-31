import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

/**
 * Live-sync reimbursements while the app is open.
 * Relies on RLS (no email filters) so the payer always receives events for
 * rows they can SELECT — inserts, amount updates, deletes, status changes.
 */
export function ReimbursementSyncListener() {
  const { user } = useAuth();
  const { refresh } = useAppData();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!user || !isSupabaseEnabled()) return;

    const sb = getSupabase();
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const onChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshRef.current();
      }, 120);
    };

    const channel = sb
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
      .subscribe();

    return () => {
      window.clearTimeout(debounceTimer);
      void sb.removeChannel(channel);
    };
  }, [user]);

  return null;
}
