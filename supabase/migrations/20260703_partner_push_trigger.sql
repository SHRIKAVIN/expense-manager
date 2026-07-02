-- Server-side Web Push: fires when a partner_notifications row is inserted.
-- Works even when the sender's app is closed (unlike client-only invoke).
--
-- After running this migration:
-- 1. Edge Functions → Secrets → PARTNER_PUSH_WEBHOOK_SECRET = (long random string)
-- 2. SQL Editor → run (same secret as step 1):
--    insert into public.partner_push_config (id, webhook_secret)
--    values (1, 'your-secret-here')
--    on conflict (id) do update set webhook_secret = excluded.webhook_secret;
-- 3. Deploy: supabase functions deploy send-partner-push

create extension if not exists pg_net with schema extensions;

-- Singleton config row (RLS on, no policies — only security definer functions read this).
create table if not exists public.partner_push_config (
  id int primary key default 1,
  webhook_secret text not null default '',
  constraint partner_push_config_singleton check (id = 1)
);

alter table public.partner_push_config enable row level security;

insert into public.partner_push_config (id, webhook_secret)
values (1, '')
on conflict (id) do nothing;

create or replace function public.handle_partner_notification_push()
returns trigger
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
    return NEW;
  end if;

  select net.http_post(
    url := 'https://hjhysmcablfoyhwrehsc.supabase.co/functions/v1/send-partner-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'recipient_email', NEW.recipient_email,
      'title', NEW.title,
      'body', NEW.body
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists partner_notification_push on public.partner_notifications;
create trigger partner_notification_push
  after insert on public.partner_notifications
  for each row
  execute function public.handle_partner_notification_push();

notify pgrst, 'reload schema';
