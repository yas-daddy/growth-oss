
ALTER TABLE public.email_campaign_settings
  ADD COLUMN custom_payload_fields jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.email_campaign_schedules
  ADD COLUMN extra_properties jsonb DEFAULT '{}'::jsonb;
