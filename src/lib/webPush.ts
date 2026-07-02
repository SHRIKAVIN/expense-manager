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

/** Subscribe this device for Web Push (VAPID) and persist in Supabase. */
export async function registerWebPushSubscription(userId: string): Promise<void> {
  if (!isSupabaseEnabled() || !webPushSupported()) return;
  if (Notification.permission !== "granted") return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Invalid push subscription.");
  }

  const sb = getSupabase();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 240),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
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
