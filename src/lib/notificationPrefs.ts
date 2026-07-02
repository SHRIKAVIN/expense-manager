import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

export async function syncRecurringRemindersEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const { error } = await getSupabase()
    .from("profiles")
    .update({ recurring_reminders_enabled: enabled })
    .eq("id", userId);
  if (error) console.warn("Could not sync recurring reminders pref:", error.message);
}

export async function syncPartnerAlertsEnabledDb(
  userId: string,
  enabled: boolean,
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const { error } = await getSupabase()
    .from("profiles")
    .update({ partner_alerts_enabled: enabled })
    .eq("id", userId);
  if (error) console.warn("Could not sync partner alerts pref:", error.message);
}

export async function loadNotificationPrefsFromDb(userId: string): Promise<{
  recurringReminders: boolean;
  partnerAlerts: boolean;
}> {
  if (!isSupabaseEnabled()) {
    return { recurringReminders: false, partnerAlerts: false };
  }
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("recurring_reminders_enabled, partner_alerts_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return { recurringReminders: false, partnerAlerts: false };
  }
  return {
    recurringReminders: Boolean(data.recurring_reminders_enabled),
    partnerAlerts: Boolean(data.partner_alerts_enabled),
  };
}
