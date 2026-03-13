-- Update cron jobs to use anon key (edge functions handle admin fallback internally)
-- The edge functions check auth, and if user not found, fall back to first admin user

-- Unschedule existing jobs
SELECT cron.unschedule('meta-ads-3am');
SELECT cron.unschedule('meta-ads-9am');
SELECT cron.unschedule('apple-keywords-3am');
SELECT cron.unschedule('apple-keywords-9am');
SELECT cron.unschedule('appsflyer-keywords-3am');
SELECT cron.unschedule('appsflyer-keywords-9am');

-- Reschedule with anon key (functions will fall back to admin user)
SELECT cron.schedule(
  'meta-ads-3am',
  '2 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/meta-sync-ads',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'apple-keywords-3am',
  '12 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/apple-sync-keywords',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'appsflyer-keywords-3am',
  '17 3 * * *',
  $$SELECT net.http_post(
    url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/appsflyer-keyword-sync',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
    ),
    body:='{}'::jsonb
  ) as request_id;$$
);