-- Add missing cron jobs for meta-sync-ads, apple-sync-keywords, and appsflyer-keyword-sync
-- These functions provide creative/keyword-level data that was missing from the nightly sync

-- Meta Ads (creatives) - run at 3:02 AM and 9:02 AM UTC (after meta-sync-campaigns)
SELECT cron.schedule(
  'meta-ads-3am',
  '2 3 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/meta-sync-ads', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);

SELECT cron.schedule(
  'meta-ads-9am',
  '2 9 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/meta-sync-ads', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);

-- Apple Keywords - run at 3:12 AM and 9:12 AM UTC (after apple-sync-campaigns at 3:10/9:10)
SELECT cron.schedule(
  'apple-keywords-3am',
  '12 3 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/apple-sync-keywords', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);

SELECT cron.schedule(
  'apple-keywords-9am',
  '12 9 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/apple-sync-keywords', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);

-- AppsFlyer Keywords - run at 3:17 AM and 9:17 AM UTC (after appsflyer-sync at 3:15/9:15)
SELECT cron.schedule(
  'appsflyer-keywords-3am',
  '17 3 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/appsflyer-keyword-sync', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);

SELECT cron.schedule(
  'appsflyer-keywords-9am',
  '17 9 * * *',
  $$SELECT net.http_post(url:='https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/appsflyer-keyword-sync', headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak"}'::jsonb, body:='{}'::jsonb) as request_id;$$
);