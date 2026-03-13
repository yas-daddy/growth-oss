ALTER TABLE public.email_campaign_settings
ADD COLUMN custom_mock_attributes jsonb DEFAULT '[]'::jsonb;