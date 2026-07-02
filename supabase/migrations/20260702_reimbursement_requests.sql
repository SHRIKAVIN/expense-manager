-- Run in Supabase SQL Editor if reimbursement add fails (table missing from an older deploy).

create table if not exists public.reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  payer_email text not null,
  payer_name text not null,
  requester_name text not null,
  amount numeric not null check (amount > 0),
  merchant text not null,
  status text not null default 'pending' check (status in ('pending', 'awaiting_confirmation', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_reimbursement_payer on public.reimbursement_requests (lower(payer_email), status);
create index if not exists idx_reimbursement_requester on public.reimbursement_requests (requester_id, status);

alter table public.reimbursement_requests enable row level security;

drop policy if exists "reimbursement_select" on public.reimbursement_requests;
create policy "reimbursement_select" on public.reimbursement_requests for select using (
  auth.uid() = requester_id
  or lower(payer_email) = lower((select email from public.profiles where id = auth.uid()))
);

drop policy if exists "reimbursement_insert_requester" on public.reimbursement_requests;
create policy "reimbursement_insert_requester" on public.reimbursement_requests for insert with check (
  auth.uid() = requester_id
);

-- See 20260702_reimbursement_confirmation.sql for mark/confirm/reject functions.

notify pgrst, 'reload schema';
