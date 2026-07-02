-- Background notification preferences + dedup log + triggers/cron hooks.

alter table public.profiles
  add column if not exists recurring_reminders_enabled boolean not null default false,
  add column if not exists partner_alerts_enabled boolean not null default false;

create table if not exists public.notification_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  dedup_key text not null,
  created_at timestamptz not null default now(),
  constraint notification_sent_unique unique (user_id, dedup_key)
);

create index if not exists idx_notification_sent_user on public.notification_sent (user_id, created_at desc);

alter table public.notification_sent enable row level security;

-- Dedup table is server-only (Edge Functions use service role).
-- No client policies.

create or replace function public.notify_budget_after_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
  webhook_secret text;
  user_email text;
begin
  select lower(p.email) into user_email
  from public.profiles p
  where p.id = NEW.user_id;

  if user_email is null then
    return NEW;
  end if;

  if user_email not in ('shrikavinkbs@gmail.com', 'sylviamicheal308@gmail.com') then
    return NEW;
  end if;

  select c.webhook_secret into webhook_secret
  from public.partner_push_config c
  where c.id = 1;

  if webhook_secret is null or webhook_secret = '' then
    return NEW;
  end if;

  select net.http_post(
    url := 'https://hjhysmcablfoyhwrehsc.supabase.co/functions/v1/scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'mode', 'budget',
      'user_id', NEW.user_id::text
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists expense_budget_push on public.expenses;
create trigger expense_budget_push
  after insert or update of amount, category_id, date, excluded_from_totals
  on public.expenses
  for each row
  execute function public.notify_budget_after_expense();

create or replace function public.run_daily_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
  webhook_secret text;
begin
  select c.webhook_secret into webhook_secret
  from public.partner_push_config c
  where c.id = 1;

  if webhook_secret is null or webhook_secret = '' then
    return;
  end if;

  select net.http_post(
    url := 'https://hjhysmcablfoyhwrehsc.supabase.co/functions/v1/scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', webhook_secret
    ),
    body := jsonb_build_object('mode', 'daily')
  ) into request_id;
exception when others then
  return;
end;
$$;

-- Daily recurring reminders (~9:30 AM IST / 4:00 AM UTC). Requires pg_cron (Supabase Dashboard → Database → Extensions).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('em-daily-notifications');
    perform cron.schedule(
      'em-daily-notifications',
      '0 4 * * *',
      $$select public.run_daily_scheduled_notifications();$$
    );
  end if;
exception when others then
  raise notice 'pg_cron not available — enable it in Supabase to run daily recurring reminders.';
end;
$cron$;

notify pgrst, 'reload schema';
