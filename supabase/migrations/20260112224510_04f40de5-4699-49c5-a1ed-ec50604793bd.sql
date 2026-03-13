-- First, remove the existing cron jobs that use anon key
SELECT cron.unschedule('meta-ads-3am');
SELECT cron.unschedule('meta-ads-9am');
SELECT cron.unschedule('apple-keywords-3am');
SELECT cron.unschedule('apple-keywords-9am');
SELECT cron.unschedule('appsflyer-keywords-3am');
SELECT cron.unschedule('appsflyer-keywords-9am');

-- Re-create cron jobs using service_role key instead of anon key
-- Meta Ads (creatives) - run at 3:02 AM and 9:02 AM UTC
SELECT cron.schedule(
  'meta-ads-3am',
  '2 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/meta-sync-ads',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'meta-ads-9am',
  '2 9 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/meta-sync-ads',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

-- Apple Keywords - run at 3:12 AM and 9:12 AM UTC
SELECT cron.schedule(
  'apple-keywords-3am',
  '12 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/apple-sync-keywords',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'apple-keywords-9am',
  '12 9 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/apple-sync-keywords',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

-- AppsFlyer Keywords - run at 3:17 AM and 9:17 AM UTC
SELECT cron.schedule(
  'appsflyer-keywords-3am',
  '17 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/appsflyer-keyword-sync',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'appsflyer-keywords-9am',
  '17 9 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/appsflyer-keyword-sync',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);