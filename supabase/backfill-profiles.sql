-- Run this ONCE if you signed up before schema.sql or the profile trigger did not run.
-- Creates missing profile rows for existing auth users.

insert into public.profiles (id, email, display_name, role, currency, theme_preference)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data ->> 'role', 'Owner'),
  coalesce(u.raw_user_meta_data ->> 'currency', 'INR'),
  'system'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- Also ensure the insert policy exists (safe to re-run):
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
