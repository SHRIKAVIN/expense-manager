-- Fix: Supabase hosted projects cannot use ALTER DATABASE SET for custom params.
-- Replaces trigger to read secret from partner_push_config table.

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

notify pgrst, 'reload schema';
