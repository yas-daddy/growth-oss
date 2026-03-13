
ALTER TABLE public.email_campaign_schedules
  ADD COLUMN push_title text,
  ADD COLUMN push_body text;
