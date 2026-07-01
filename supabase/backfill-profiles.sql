-- Run this in Supabase → SQL Editor to fix sign-in for existing auth users.
-- Safe to re-run.

-- 1. Server-side profile bootstrap (bypasses RLS — fixes error 42501 on sign-in)
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users;
  row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.profiles where id = auth.uid();
  if found then
    return row;
  end if;

  select * into u from auth.users where id = auth.uid();

  insert into public.profiles (id, email, display_name, role, currency, theme_preference)
  values (
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
    coalesce(u.raw_user_meta_data ->> 'role', 'Owner'),
    coalesce(u.raw_user_meta_data ->> 'currency', 'INR'),
    'system'
  )
  returning * into row;

  return row;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- Refresh PostgREST schema cache so the RPC is callable immediately
notify pgrst, 'reload schema';

-- 2. Backfill any auth users still missing a profile row
insert into public.profiles (id, email, display_name, role, currency, theme_preference)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data ->> 'role', 'Owner'),
  coalesce(u.raw_user_meta_data ->> 'currency', 'INR'),
  'system'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 3. Allow users to insert their own profile (backup path)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
