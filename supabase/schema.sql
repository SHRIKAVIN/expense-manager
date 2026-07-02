-- Expense Manager — run this in the Supabase SQL Editor (Dashboard → SQL → New query).

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'Owner' check (role in ('Owner', 'Member', 'Viewer')),
  currency text not null default 'INR',
  theme_preference text not null default 'system' check (theme_preference in ('light', 'dark', 'system')),
  created_at timestamptz not null default now()
);

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text not null default 'other',
  monthly_budget numeric,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Receipts (stored as base64 data URLs)
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  data_url text not null,
  created_at timestamptz not null default now()
);

-- Recurring expense rules
create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  merchant text not null,
  category_id uuid not null references public.categories (id) on delete restrict,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due date not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  merchant text not null,
  category_id uuid not null references public.categories (id) on delete restrict,
  date date not null,
  payment_method text,
  notes text,
  receipt_id uuid references public.receipts (id) on delete set null,
  recurring_id uuid references public.recurring (id) on delete set null,
  recurring_period text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_expenses_user_date on public.expenses (user_id, date desc);
create index if not exists idx_recurring_user on public.recurring (user_id);
create index if not exists idx_receipts_user on public.receipts (user_id);

-- Monthly income entries (multiple per month are summed)
create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_income_user_month on public.income_entries (user_id, month desc);

-- Reimbursement requests between paired demo users (expense removed when payer marks done)
create table if not exists public.reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  payer_email text not null,
  payer_name text not null,
  requester_name text not null,
  amount numeric not null check (amount > 0),
  merchant text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_reimbursement_payer on public.reimbursement_requests (lower(payer_email), status);
create index if not exists idx_reimbursement_requester on public.reimbursement_requests (requester_id, status);

-- Auto-create profile when a user signs up (reads metadata from signUp options.data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, currency)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'Owner'),
    coalesce(new.raw_user_meta_data ->> 'currency', 'INR')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app on sign-in when auth.users exists but profiles row is missing.
-- Runs as SECURITY DEFINER so it bypasses RLS (client INSERT was blocked by policy 42501).
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

create or replace function public.complete_reimbursement(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reimbursement_requests;
  payer_email text;
  exp_receipt uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into payer_email from public.profiles where id = auth.uid();
  if payer_email is null then
    raise exception 'Profile not found';
  end if;

  select * into req from public.reimbursement_requests
  where id = request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Reimbursement request not found';
  end if;

  if lower(req.payer_email) <> lower(payer_email) then
    raise exception 'Not authorized to complete this reimbursement';
  end if;

  select receipt_id into exp_receipt from public.expenses
  where id = req.expense_id and user_id = req.requester_id;

  if exp_receipt is not null then
    delete from public.receipts where id = exp_receipt;
  end if;

  delete from public.expenses where id = req.expense_id and user_id = req.requester_id;

  update public.reimbursement_requests
  set status = 'completed', completed_at = now()
  where id = request_id;
end;
$$;

grant execute on function public.complete_reimbursement(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.receipts enable row level security;
alter table public.income_entries enable row level security;
alter table public.reimbursement_requests enable row level security;
alter table public.recurring enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "categories_all_own" on public.categories for all using (auth.uid() = user_id);
create policy "expenses_all_own" on public.expenses for all using (auth.uid() = user_id);
create policy "receipts_all_own" on public.receipts for all using (auth.uid() = user_id);
create policy "income_all_own" on public.income_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "reimbursement_select" on public.reimbursement_requests for select using (
  auth.uid() = requester_id
  or lower(payer_email) = lower((select email from public.profiles where id = auth.uid()))
);
create policy "reimbursement_insert_requester" on public.reimbursement_requests for insert with check (
  auth.uid() = requester_id
);
create policy "recurring_all_own" on public.recurring for all using (auth.uid() = user_id);
