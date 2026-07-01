import type { User as AuthUser } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { profileToSession } from "@/lib/supabase/mappers";
import type { Role, SessionUser } from "@/lib/types";

/** Load the profile row, creating it from auth metadata if the DB trigger missed signup. */
export async function ensureProfile(authUser: AuthUser): Promise<SessionUser> {
  const sb = getSupabase();

  const { data: existing, error: fetchErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (existing) return profileToSession(existing);

  const meta = authUser.user_metadata ?? {};
  const email = authUser.email ?? "";
  const role = (meta.role as Role | undefined) ?? "Owner";

  const { data, error } = await sb
    .from("profiles")
    .insert({
      id: authUser.id,
      email,
      display_name: (meta.display_name as string | undefined)?.trim() || email.split("@")[0] || "User",
      role,
      currency: (meta.currency as string | undefined) ?? "INR",
      theme_preference: "system",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return profileToSession(data);
}
