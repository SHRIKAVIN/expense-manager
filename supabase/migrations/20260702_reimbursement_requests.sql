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
  status text not null default 'pending' check (status in ('pending', 'completed')),
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
