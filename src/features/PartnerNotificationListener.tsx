import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isQuickSwitchEmail } from "@/auth/quickSwitch";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";
import { notifyPush } from "@/lib/notifications";
import { partnerAlertsEnabled } from "@/lib/partnerNotify";
import { registerWebPushSubscription, webPushSupported } from "@/lib/webPush";
import { useAppData } from "@/data/AppDataProvider";

const SEEN_PREFIX = "em.notifications.seen.";

function seenKey(userId: string) {
  return `${SEEN_PREFIX}${userId}`;
}

function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(userId: string, id: string) {
  try {
    const set = readSeen(userId);
    set.add(id);
    const arr = [...set].slice(-100);
    localStorage.setItem(seenKey(userId), JSON.stringify(arr));
  } catch {
    /* no-op */
  }
}

type PartnerNotificationRow = {
  id: string;
  recipient_email: string;
  actor_name: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
};

/** Subscribes to partner notifications and shows push alerts for the logged-in user. */
export function PartnerNotificationListener() {
  const { user } = useAuth();
  const { refresh } = useAppData();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !isSupabaseEnabled() || !isQuickSwitchEmail(user.email)) return;
    if (!partnerAlertsEnabled(user.id)) return;

    seenRef.current = readSeen(user.id);
    const email = user.email.toLowerCase();
    const sb = getSupabase();

    if (Notification.permission === "granted" && webPushSupported()) {
      void registerWebPushSubscription(user.id).catch(() => {
        /* subscription optional */
      });
    }

    const deliver = (row: PartnerNotificationRow) => {
      if (seenRef.current.has(row.id)) return;
      if (Notification.permission !== "granted") return;
      markSeen(user.id, row.id);
      seenRef.current.add(row.id);
      void notifyPush(row.title, row.body);
      void refresh();
    };

    void (async () => {
      const { data } = await sb
        .from("partner_notifications")
        .select("*")
        .ilike("recipient_email", email)
        .order("created_at", { ascending: false })
        .limit(5);
      for (const row of (data ?? []).reverse()) {
        deliver(row as PartnerNotificationRow);
      }
    })();

    const channel = sb
      .channel(`partner-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partner_notifications",
          filter: `recipient_email=eq.${email}`,
        },
        (payload) => {
          deliver(payload.new as PartnerNotificationRow);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [refresh, user]);

  return null;
}
