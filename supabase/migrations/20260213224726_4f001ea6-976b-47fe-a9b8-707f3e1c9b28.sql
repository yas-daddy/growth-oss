
ALTER TABLE public.email_campaign_settings
  ADD COLUMN default_email_title text,
  ADD COLUMN default_pre_header text;
