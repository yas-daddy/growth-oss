
ALTER TABLE public.email_campaign_settings
  ADD COLUMN name text NOT NULL DEFAULT 'Default Campaign';

ALTER TABLE public.email_campaign_schedules
  ADD COLUMN campaign_id uuid REFERENCES public.email_campaign_settings(id);
