
ALTER TABLE public.email_campaign_settings
  ADD COLUMN cb_hero_without_cta text,
  ADD COLUMN cb_header_title text,
  ADD COLUMN cb_body_copy text,
  ADD COLUMN cb_cta text,
  ADD COLUMN cb_footer text;
