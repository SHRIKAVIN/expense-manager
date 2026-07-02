-- Run in Supabase SQL Editor to add two-step reimbursement confirmation.

alter table public.reimbursement_requests
  drop constraint if exists reimbursement_requests_status_check;

alter table public.reimbursement_requests
  add constraint reimbursement_requests_status_check
  check (status in ('pending', 'awaiting_confirmation', 'completed'));

create or replace function public.mark_reimbursement_paid(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reimbursement_requests;
  payer_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select email into payer_email from public.profiles where id = auth.uid();
  if payer_email is null then raise exception 'Profile not found'; end if;

  select * into req from public.reimbursement_requests
  where id = request_id and status = 'pending'
  for update;

  if not found then raise exception 'Reimbursement request not found'; end if;
  if lower(req.payer_email) <> lower(payer_email) then
    raise exception 'Not authorized to mark this reimbursement paid';
  end if;

  update public.reimbursement_requests
  set status = 'awaiting_confirmation'
  where id = request_id;
end;
$$;

create or replace function public.confirm_reimbursement(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reimbursement_requests;
  exp_receipt uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into req from public.reimbursement_requests
  where id = request_id and status = 'awaiting_confirmation'
  for update;

  if not found then raise exception 'Reimbursement request not found'; end if;
  if req.requester_id <> auth.uid() then
    raise exception 'Not authorized to confirm this reimbursement';
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

create or replace function public.reject_reimbursement_paid(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reimbursement_requests;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into req from public.reimbursement_requests
  where id = request_id and status = 'awaiting_confirmation'
  for update;

  if not found then raise exception 'Reimbursement request not found'; end if;
  if req.requester_id <> auth.uid() then
    raise exception 'Not authorized to reject this reimbursement';
  end if;

  update public.reimbursement_requests
  set status = 'pending'
  where id = request_id;
end;
$$;

grant execute on function public.mark_reimbursement_paid(uuid) to authenticated;
grant execute on function public.confirm_reimbursement(uuid) to authenticated;
grant execute on function public.reject_reimbursement_paid(uuid) to authenticated;

drop function if exists public.complete_reimbursement(uuid);

notify pgrst, 'reload schema';
