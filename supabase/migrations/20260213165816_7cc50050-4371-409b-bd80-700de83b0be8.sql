ALTER TABLE public.email_campaign_settings
  ADD COLUMN default_header_title text,
  ADD COLUMN default_body_copy text,
  ADD COLUMN default_cta_text text,
  ADD COLUMN default_cta_url text,
  ADD COLUMN default_offer_hours numeric,
  ADD COLUMN default_push_title text,
  ADD COLUMN default_push_body text;