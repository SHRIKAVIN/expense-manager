-- Keep requester expense in logs (excluded from totals) and link payer expense on confirm.

alter table public.expenses
  add column if not exists excluded_from_totals boolean not null default false,
  add column if not exists reimbursement_request_id uuid references public.reimbursement_requests (id) on delete set null;

alter table public.reimbursement_requests
  add column if not exists payer_expense_id uuid;

create or replace function public.confirm_reimbursement(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.reimbursement_requests;
  exp public.expenses;
  payer_id uuid;
  payer_category_id uuid;
  requester_category_name text;
  new_receipt_id uuid;
  new_payer_expense_id uuid;
  transfer_note text;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into req from public.reimbursement_requests
  where id = request_id and status = 'awaiting_confirmation'
  for update;

  if not found then raise exception 'Reimbursement request not found'; end if;
  if req.requester_id <> auth.uid() then
    raise exception 'Not authorized to confirm this reimbursement';
  end if;

  select * into exp from public.expenses
  where id = req.expense_id and user_id = req.requester_id;

  if not found then raise exception 'Expense not found'; end if;

  select id into payer_id from public.profiles
  where lower(email) = lower(req.payer_email);

  if payer_id is null then raise exception 'Payer profile not found'; end if;

  select c.name into requester_category_name
  from public.categories c
  where c.id = exp.category_id;

  select id into payer_category_id
  from public.categories
  where user_id = payer_id
    and lower(name) = lower(requester_category_name)
    and not archived
  limit 1;

  if payer_category_id is null then
    select id into payer_category_id
    from public.categories
    where user_id = payer_id and lower(name) = 'other' and not archived
    limit 1;
  end if;

  if payer_category_id is null then
    select id into payer_category_id
    from public.categories
    where user_id = payer_id and not archived
    order by created_at
    limit 1;
  end if;

  if payer_category_id is null then raise exception 'Payer has no categories'; end if;

  transfer_note := 'Reimbursed from ' || req.requester_name;

  new_receipt_id := null;
  if exp.receipt_id is not null then
    insert into public.receipts (user_id, data_url, created_at)
    select payer_id, r.data_url, now_ts
    from public.receipts r
    where r.id = exp.receipt_id
    returning id into new_receipt_id;
  end if;

  insert into public.expenses (
    user_id,
    amount,
    merchant,
    category_id,
    date,
    payment_method,
    notes,
    receipt_id,
    reimbursement_request_id,
    created_at,
    updated_at
  )
  values (
    payer_id,
    exp.amount,
    exp.merchant,
    payer_category_id,
    exp.date,
    exp.payment_method,
    case
      when exp.notes is null or btrim(exp.notes) = '' then transfer_note
      else exp.notes || ' · ' || transfer_note
    end,
    new_receipt_id,
    request_id,
    now_ts,
    now_ts
  )
  returning id into new_payer_expense_id;

  update public.expenses
  set excluded_from_totals = true, updated_at = now_ts
  where id = req.expense_id and user_id = req.requester_id;

  update public.reimbursement_requests
  set status = 'completed',
      completed_at = now_ts,
      payer_expense_id = new_payer_expense_id
  where id = request_id;
end;
$$;

notify pgrst, 'reload schema';
