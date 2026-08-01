-- Settle Up: profile UPI + settlements history

alter table public.profiles
  add column if not exists upi_id text,
  add column if not exists phone text;

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  reimbursement_request_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  payer_id uuid not null references public.profiles (id) on delete cascade,
  payee_id uuid not null references public.profiles (id) on delete cascade,
  payer_name text not null default '',
  payee_name text not null default '',
  merchant text,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'upi' check (method in ('upi', 'cash', 'other')),
  note text,
  status text not null default 'initiated'
    check (status in ('initiated', 'payer_confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists settlements_payer_idx on public.settlements (payer_id, created_at desc);
create index if not exists settlements_payee_idx on public.settlements (payee_id, created_at desc);
create index if not exists settlements_reimb_idx on public.settlements (reimbursement_request_id);

alter table public.settlements enable row level security;

create policy "settlements_select_participant"
  on public.settlements for select
  using (auth.uid() = payer_id or auth.uid() = payee_id);

create policy "settlements_insert_payer"
  on public.settlements for insert
  with check (auth.uid() = payer_id);

create policy "settlements_update_participant"
  on public.settlements for update
  using (auth.uid() = payer_id or auth.uid() = payee_id);

-- Read a partner's payment fields (UPI/phone) by email.
create or replace function public.get_partner_payment_info(partner_email text)
returns table (
  id uuid,
  email text,
  display_name text,
  upi_id text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(partner_email));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select p.id, p.email, p.display_name, p.upi_id, p.phone
    from public.profiles p
    where lower(p.email) = normalized
    limit 1;
end;
$$;

grant execute on function public.get_partner_payment_info(text) to authenticated;
