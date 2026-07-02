import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret",
};

const QUICK_SWITCH_EMAILS = new Set([
  "shrikavinkbs@gmail.com",
  "sylviamicheal308@gmail.com",
]);

const FULL_RATIO = 0.9;

type Body = {
  mode?: "daily" | "budget";
  user_id?: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  currency: string;
  recurring_reminders_enabled: boolean;
  partner_alerts_enabled: boolean;
};

function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${key}-01`,
    to: `${key}-${String(lastDay).padStart(2, "0")}`,
  };
}

function daysUntil(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

function relativeDue(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `overdue by ${Math.abs(d)}d`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d} days`;
}

function formatCurrency(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}

function partnerEmail(email: string): string | null {
  const normalized = email.toLowerCase();
  if (!QUICK_SWITCH_EMAILS.has(normalized)) return null;
  for (const e of QUICK_SWITCH_EMAILS) {
    if (e !== normalized) return e;
  }
  return null;
}

async function sendPushToUser(
  admin: ReturnType<typeof createClient>,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string,
  userId: string,
  email: string,
  title: string,
  body: string,
  dedupKey: string,
  notificationId?: string,
): Promise<boolean> {
  const { error: dedupErr } = await admin.from("notification_sent").insert({
    user_id: userId,
    dedup_key: dedupKey,
  });
  if (dedupErr?.code === "23505") return false;

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (subsErr || !subs?.length) return false;

  const payload = JSON.stringify({
    id: notificationId ?? dedupKey,
    title,
    body,
    url: "/",
  });

  let sent = 0;
  const stale: string[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(sub.endpoint);
    }
  }

  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return sent > 0;
}

async function runRecurringForUser(admin: ReturnType<typeof createClient>, profile: ProfileRow, vapid: {
  public: string;
  private: string;
  subject: string;
}) {
  if (!profile.recurring_reminders_enabled) return;

  const { data: rules } = await admin
    .from("recurring")
    .select("id, merchant, next_due")
    .eq("user_id", profile.id);

  for (const rule of rules ?? []) {
    const d = daysUntil(rule.next_due as string);
    if (d < 0 || d > 2) continue;
    const dedupKey = `recurring:${rule.id}:${rule.next_due}`;
    await sendPushToUser(
      admin,
      vapid.public,
      vapid.private,
      vapid.subject,
      profile.id,
      profile.email,
      "Upcoming expense",
      `${rule.merchant} ${relativeDue(rule.next_due as string)}`,
      dedupKey,
    );
  }
}

async function runBudgetForUser(admin: ReturnType<typeof createClient>, profile: ProfileRow, vapid: {
  public: string;
  private: string;
  subject: string;
}) {
  const email = profile.email.toLowerCase();
  if (!QUICK_SWITCH_EMAILS.has(email)) return;

  const month = currentMonthKey();
  const { from, to } = monthBounds(month);

  const { data: categories } = await admin
    .from("categories")
    .select("id, name, monthly_budget")
    .eq("user_id", profile.id)
    .eq("archived", false)
    .gt("monthly_budget", 0);

  const { data: expenses } = await admin
    .from("expenses")
    .select("category_id, amount")
    .eq("user_id", profile.id)
    .eq("excluded_from_totals", false)
    .gte("date", from)
    .lte("date", to);

  const spentByCat: Record<string, number> = {};
  for (const e of expenses ?? []) {
    const cid = e.category_id as string;
    spentByCat[cid] = (spentByCat[cid] ?? 0) + Number(e.amount);
  }

  const actorName = profile.display_name?.trim() || profile.email.split("@")[0] || "User";
  const partner = partnerEmail(email);

  for (const cat of categories ?? []) {
    const limit = Number(cat.monthly_budget);
    if (!(limit > 0)) continue;
    const spent = spentByCat[cat.id as string] ?? 0;
    const ratio = spent / limit;
    const spentStr = formatCurrency(spent, profile.currency);
    const limitStr = formatCurrency(limit, profile.currency);

    if (ratio >= 1) {
      const dedupKey = `budget:${cat.id}:${month}:exceeded`;
      const sent = await sendPushToUser(
        admin,
        vapid.public,
        vapid.private,
        vapid.subject,
        profile.id,
        profile.email,
        "Budget exceeded",
        `${cat.name} — ${spentStr} of ${limitStr}`,
        dedupKey,
      );
      if (sent && profile.partner_alerts_enabled && partner) {
        await admin.from("partner_notifications").insert({
          recipient_email: partner,
          actor_name: actorName,
          title: `${actorName} exceeded a budget`,
          body: `${cat.name}: ${spentStr} of ${limitStr}`,
          kind: "budget_alert",
        });
      }
      continue;
    }

    if (ratio >= FULL_RATIO) {
      const dedupKey = `budget:${cat.id}:${month}:full`;
      const sent = await sendPushToUser(
        admin,
        vapid.public,
        vapid.private,
        vapid.subject,
        profile.id,
        profile.email,
        "Budget almost full",
        `${cat.name} — ${spentStr} of ${limitStr}`,
        dedupKey,
      );
      if (sent && profile.partner_alerts_enabled && partner) {
        await admin.from("partner_notifications").insert({
          recipient_email: partner,
          actor_name: actorName,
          title: `${actorName}'s budget is almost full`,
          body: `${cat.name}: ${spentStr} of ${limitStr}`,
          kind: "budget_alert",
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@expense-manager.local";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookSecret = Deno.env.get("PARTNER_PUSH_WEBHOOK_SECRET");
    const pushSecret = req.headers.get("x-push-secret");
    if (!webhookSecret || pushSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Body;
    const mode = payload.mode ?? "daily";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    const vapid = { public: vapidPublic, private: vapidPrivate, subject: vapidSubject };

    if (mode === "budget" && payload.user_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, email, display_name, currency, recurring_reminders_enabled, partner_alerts_enabled")
        .eq("id", payload.user_id)
        .maybeSingle();

      if (profile) {
        await runBudgetForUser(admin, profile as ProfileRow, vapid);
      }

      return new Response(JSON.stringify({ ok: true, mode: "budget" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, display_name, currency, recurring_reminders_enabled, partner_alerts_enabled");

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      await runRecurringForUser(admin, profile, vapid);
      await runBudgetForUser(admin, profile, vapid);
    }

    return new Response(JSON.stringify({ ok: true, mode: "daily", users: profiles?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
