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

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.receipts enable row level security;
alter table public.recurring enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "categories_all_own" on public.categories for all using (auth.uid() = user_id);
create policy "expenses_all_own" on public.expenses for all using (auth.uid() = user_id);
create policy "receipts_all_own" on public.receipts for all using (auth.uid() = user_id);
create policy "recurring_all_own" on public.recurring for all using (auth.uid() = user_id);
