
drop policy if exists "reimbursement_update_requester" on public.reimbursement_requests;
create policy "reimbursement_update_requester" on public.reimbursement_requests
  for update
  using (auth.uid() = requester_id and status = 'pending')
  with check (auth.uid() = requester_id and status = 'pending');

-- Needed so Realtime can deliver UPDATE/DELETE events with column filters.
alter table public.reimbursement_requests replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.reimbursement_requests;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
