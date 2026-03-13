
-- Create email_campaign_schedules table
CREATE TABLE public.email_campaign_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  email_title TEXT NOT NULL,
  pre_header TEXT,
  header_title TEXT,
  body_copy TEXT,
  cta_text TEXT,
  cta_url TEXT,
  offer_validity_hours NUMERIC,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  braze_schedule_id TEXT,
  braze_response JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_schedules FORCE ROW LEVEL SECURITY;

-- All authenticated can SELECT
CREATE POLICY "Authenticated users can view email campaign schedules"
  ON public.email_campaign_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can INSERT
CREATE POLICY "Admins can insert email campaign schedules"
  ON public.email_campaign_schedules FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can UPDATE
CREATE POLICY "Admins can update email campaign schedules"
  ON public.email_campaign_schedules FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create email_campaign_settings table
CREATE TABLE public.email_campaign_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  html_template TEXT,
  canvas_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_settings FORCE ROW LEVEL SECURITY;

-- All authenticated can SELECT
CREATE POLICY "Authenticated users can view email campaign settings"
  ON public.email_campaign_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can ALL
CREATE POLICY "Admins can manage email campaign settings"
  ON public.email_campaign_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create email-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);

-- Public read access
CREATE POLICY "Email assets are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-assets');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload email assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'email-assets' AND auth.uid() IS NOT NULL);

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update email assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'email-assets' AND auth.uid() IS NOT NULL);

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete email assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'email-assets' AND auth.uid() IS NOT NULL);
