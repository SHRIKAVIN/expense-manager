import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

/** Keeps reimbursement state in sync when the partner updates requests in real time. */
export function ReimbursementSyncListener() {
  const { user } = useAuth();
  const { refresh } = useAppData();

  useEffect(() => {
    if (!user || !isSupabaseEnabled()) return;

    const sb = getSupabase();
    const userId = user.id;
    const email = user.email.toLowerCase();

    const onChange = () => {
      void refresh();
    };

    const channel = sb
      .channel(`reimbursement-sync-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reimbursement_requests",
          filter: `requester_id=eq.${userId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reimbursement_requests",
          filter: `payer_email=eq.${email}`,
        },
        onChange,
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [refresh, user]);

  return null;
}
