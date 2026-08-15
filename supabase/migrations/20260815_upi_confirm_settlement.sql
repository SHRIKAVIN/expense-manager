-- UPI Settlement Confirmation RPC
-- Allows payer to confirm a settlement moved from "initiated" to "payer_confirmed"
-- This happens when user confirms they sent the UPI payment via deep link

create or replace function public.confirm_settlement_paid(settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sett public.settlements;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into sett from public.settlements
  where id = settlement_id
  for update;

  if not found then raise exception 'Settlement not found'; end if;
  if sett.payer_id <> auth.uid() then
    raise exception 'Not authorized to confirm this settlement';
  end if;
  if sett.status <> 'initiated' then
    raise exception 'Settlement is not pending confirmation';
  end if;

  update public.settlements
  set status = 'payer_confirmed', settled_at = now()
  where id = settlement_id;
end;
$$;

grant execute on function public.confirm_settlement_paid(uuid) to authenticated;
