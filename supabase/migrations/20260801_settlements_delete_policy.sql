-- Allow settlement participants to delete their own history rows.

create policy "settlements_delete_participant"
  on public.settlements for delete
  using (auth.uid() = payer_id or auth.uid() = payee_id);
