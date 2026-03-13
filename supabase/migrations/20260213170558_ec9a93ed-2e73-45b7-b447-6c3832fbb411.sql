ALTER TABLE public.email_campaign_settings
ADD COLUMN custom_content_blocks jsonb DEFAULT '[]'::jsonb;