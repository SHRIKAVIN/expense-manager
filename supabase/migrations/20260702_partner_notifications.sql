-- Partner push notification queue (Realtime + browser notifications).

create table if not exists public.partner_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  actor_name text not null,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_notifications_recipient
  on public.partner_notifications (lower(recipient_email), created_at desc);

alter table public.partner_notifications enable row level security;

drop policy if exists "partner_notifications_select" on public.partner_notifications;
create policy "partner_notifications_select" on public.partner_notifications for select using (
  lower(recipient_email) = lower((select email from public.profiles where id = auth.uid()))
);

drop policy if exists "partner_notifications_insert" on public.partner_notifications;
create policy "partner_notifications_insert" on public.partner_notifications for insert with check (
  auth.uid() is not null
);

-- Enable Supabase Realtime (required for live push while app is open).
alter publication supabase_realtime add table public.partner_notifications;

notify pgrst, 'reload schema';
