import { getSupabase } from "@/lib/supabase/client";
import { profileToSession } from "@/lib/supabase/mappers";
import type { DbProfile } from "@/lib/supabase/database.types";
import type { SessionUser } from "@/lib/types";

const SETUP_HINT =
  "Open Supabase → SQL Editor, run supabase/backfill-profiles.sql, then sign in again.";

function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    Boolean(
      error.message?.includes("Could not find the function") ||
        error.message?.includes("does not exist"),
    )
  );
}

/**
 * Load or create the profile row. Tries a direct SELECT first, then the
 * `ensure_profile` RPC (SECURITY DEFINER) for users missing a profiles row.
 */
export async function ensureProfile(): Promise<SessionUser> {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: existing, error: selectError } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existing) return profileToSession(existing as DbProfile);

  const { data, error } = await sb.rpc("ensure_profile");
  if (error) {
    throw new Error(isMissingRpc(error) ? SETUP_HINT : error.message);
  }
  if (!data) throw new Error("Could not load profile.");
  return profileToSession(data as DbProfile);
}
