-- Schedule generate-recommendations to run every Monday at 8am UTC
SELECT cron.schedule(
  'generate-recommendations-monday',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/generate-recommendations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule generate-recommendations to run every Friday at 8am UTC
SELECT cron.schedule(
  'generate-recommendations-friday',
  '0 8 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://lkwxgkptgqdnkpzvnlnx.supabase.co/functions/v1/generate-recommendations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3hna3B0Z3FkbmtwenZubG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTkyNzAsImV4cCI6MjA4MDkzNTI3MH0.G3jbsBrlIXrEbtG2nH1OKIEn5lImVQYUVMoz1SxJRak'
    ),
    body := '{}'::jsonb
  );
  $$
);