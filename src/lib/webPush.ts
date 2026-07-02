import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function vapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function waitForServiceWorker(timeoutMs = 15000): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Service worker did not load — refresh and try again."));
    }, timeoutMs);

    void navigator.serviceWorker.ready
      .then((reg) => {
        window.clearTimeout(timer);
        resolve(reg);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error("Service worker unavailable."));
      });
  });
}

/** Subscribe this device for Web Push (VAPID) and persist in Supabase. */
export async function registerWebPushSubscription(userId: string): Promise<void> {
  if (!isSupabaseEnabled()) throw new Error("Supabase is not configured.");
  if (!webPushSupported()) {
    throw new Error("Web Push is not available — check VITE_VAPID_PUBLIC_KEY and redeploy.");
  }
  if (Notification.permission !== "granted") {
    throw new Error("Notification permission not granted.");
  }

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos && !isStandalonePwa()) {
    throw new Error(
      "On iPhone, add this app to your Home Screen first, then open it from the icon.",
    );
  }

  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }
  const reg = await waitForServiceWorker();

  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Invalid push subscription from browser.");
  }

  const sb = getSupabase();
  const row = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 240),
    updated_at: new Date().toISOString(),
  };

  const { error: insertErr } = await sb.from("push_subscriptions").insert(row);
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { error: updateErr } = await sb
        .from("push_subscriptions")
        .update({
          user_id: userId,
          p256dh: row.p256dh,
          auth: row.auth,
          user_agent: row.user_agent,
          updated_at: row.updated_at,
        })
        .eq("endpoint", row.endpoint);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      throw new Error(
        insertErr.message.includes("push_subscriptions")
          ? "Database table missing — run push_subscriptions migration in Supabase SQL Editor."
          : insertErr.message,
      );
    }
  }
}

/** Remove this device's push subscription from Supabase and unsubscribe locally. */
export async function unregisterWebPushSubscription(userId: string): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await getSupabase().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
    }
  } catch {
    /* no-op */
  }
}

/** Ask the Edge Function to deliver a Web Push to all of the recipient's devices. */
export async function invokePartnerWebPush(input: {
  recipientEmail: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean; sent?: number; reason?: string; error?: string }> {
  if (!isSupabaseEnabled()) return { ok: false, error: "Supabase not configured" };
  try {
    const { data, error } = await getSupabase().functions.invoke("send-partner-push", {
      body: {
        recipient_email: input.recipientEmail.toLowerCase(),
        title: input.title,
        body: input.body,
      },
    });
    if (error) {
      console.warn("Web push invoke failed:", error.message);
      return { ok: false, error: error.message };
    }
    const result = data as { sent?: number; reason?: string; error?: string } | null;
    if (result?.error) return { ok: false, error: result.error };
    if ((result?.sent ?? 0) > 0) return { ok: true, sent: result!.sent };
    return { ok: false, reason: result?.reason ?? "no devices registered" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Web push failed";
    console.warn("Web push invoke failed:", err);
    return { ok: false, error: message };
  }
}

/** Whether the browser has an active push subscription on this device. */
export async function hasLocalPushSubscription(): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/** Whether this user has at least one push subscription saved in Supabase. */
export async function hasPushSubscription(userId: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;
  const { count, error } = await getSupabase()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export type PushSetupStatus = "ready" | "needs_enable" | "needs_permission" | "needs_pwa" | "needs_vapid" | "needs_register";

export async function getPushSetupStatus(
  userId: string,
  alertsEnabled: boolean,
): Promise<PushSetupStatus> {
  if (!alertsEnabled) return "needs_enable";
  if (!vapidConfigured()) return "needs_vapid";
  if (Notification.permission !== "granted") return "needs_permission";
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos && !isStandalonePwa()) return "needs_pwa";
  const [local, remote] = await Promise.all([hasLocalPushSubscription(), hasPushSubscription(userId)]);
  if (local && remote) return "ready";
  return "needs_register";
}

/** Send a test background push to the current user (verifies Edge Function + VAPID). */
export async function sendTestBackgroundPush(userEmail: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const result = await invokePartnerWebPush({
    recipientEmail: userEmail,
    title: "Expense Manager",
    body: "Background push is working — you can close the app and still get alerts.",
  });
  if (result.ok) return { ok: true, message: "Test sent — close the app to verify the banner." };
  if (result.reason === "no subscriptions") {
    return {
      ok: false,
      message: "No device registered. Toggle partner alerts off/on and allow notifications.",
    };
  }
  if (result.error?.includes("VAPID")) {
    return { ok: false, message: "Edge Function missing VAPID secrets — set them in Supabase dashboard." };
  }
  if (result.error?.includes("Failed to send") || result.error?.includes("404")) {
    return {
      ok: false,
      message: "Edge Function not deployed. Run: supabase functions deploy send-partner-push",
    };
  }
  return { ok: false, message: result.error ?? result.reason ?? "Push failed" };
}
