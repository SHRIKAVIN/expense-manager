-- Deleting the requester's expense removes the linked reimbursement for both parties.

alter table public.reimbursement_requests
  drop constraint if exists reimbursement_requests_expense_id_fkey;

delete from public.reimbursement_requests rr
where not exists (
  select 1 from public.expenses e where e.id = rr.expense_id
);

alter table public.reimbursement_requests
  add constraint reimbursement_requests_expense_id_fkey
  foreign key (expense_id) references public.expenses (id) on delete cascade;

drop policy if exists "reimbursement_delete_requester" on public.reimbursement_requests;
create policy "reimbursement_delete_requester" on public.reimbursement_requests
  for delete using (auth.uid() = requester_id);

notify pgrst, 'reload schema';
