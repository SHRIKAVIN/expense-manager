-- Profile gender for avatar icons (male / female).

alter table public.profiles
  add column if not exists gender text
  check (gender is null or gender in ('male', 'female'));

-- Seed known quick-switch accounts.
update public.profiles
set gender = 'male'
where lower(email) = 'shrikavinkbs@gmail.com' and (gender is null or gender <> 'male');

update public.profiles
set gender = 'female'
where lower(email) = 'sylviamicheal308@gmail.com' and (gender is null or gender <> 'female');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, currency, gender)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'Owner'),
    coalesce(new.raw_user_meta_data ->> 'currency', 'INR'),
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'gender', '')) in ('male', 'female')
        then lower(new.raw_user_meta_data ->> 'gender')
      else null
    end
  );
  return new;
end;
$$;

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users;
  row public.profiles;
  g text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.profiles where id = auth.uid();
  if found then
    return row;
  end if;

  select * into u from auth.users where id = auth.uid();

  g := lower(coalesce(u.raw_user_meta_data ->> 'gender', ''));
  if g not in ('male', 'female') then
    g := null;
  end if;

  insert into public.profiles (id, email, display_name, role, currency, theme_preference, gender)
  values (
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
    coalesce(u.raw_user_meta_data ->> 'role', 'Owner'),
    coalesce(u.raw_user_meta_data ->> 'currency', 'INR'),
    'system',
    g
  )
  returning * into row;

  return row;
end;
$$;

notify pgrst, 'reload schema';
