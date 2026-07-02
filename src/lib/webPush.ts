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
}): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const { error } = await getSupabase().functions.invoke("send-partner-push", {
      body: {
        recipient_email: input.recipientEmail.toLowerCase(),
        title: input.title,
        body: input.body,
      },
    });
    if (error) console.warn("Web push invoke failed:", error.message);
  } catch (err) {
    console.warn("Web push invoke failed:", err);
  }
}
