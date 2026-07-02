-- Include notification id in webhook push for deduplication in the service worker.

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
      'body', NEW.body,
      'notification_id', NEW.id::text
    )
  ) into request_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

notify pgrst, 'reload schema';
