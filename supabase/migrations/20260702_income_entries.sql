-- Run in Supabase SQL Editor if income add fails (table missing from an older deploy).

create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_income_user_month on public.income_entries (user_id, month desc);

alter table public.income_entries enable row level security;

drop policy if exists "income_all_own" on public.income_entries;
create policy "income_all_own" on public.income_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
