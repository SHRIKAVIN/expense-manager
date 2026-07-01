import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseEnabled(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** Shared Supabase client — throws if env vars are missing. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local",
    );
  }
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
