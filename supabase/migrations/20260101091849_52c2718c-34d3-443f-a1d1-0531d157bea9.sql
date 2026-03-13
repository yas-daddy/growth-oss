-- Create ad_defaults table for storing default ad copy settings
CREATE TABLE public.ad_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action TEXT DEFAULT 'INSTALL_MOBILE_APP',
  destination_url TEXT,
  url_parameters TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad_drafts table for storing ad creation drafts
CREATE TABLE public.ad_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  campaign_id TEXT,
  adset_ids TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action TEXT DEFAULT 'INSTALL_MOBILE_APP',
  destination_url TEXT,
  url_parameters TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_ad_ids TEXT[] DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.ad_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_drafts ENABLE ROW LEVEL SECURITY;

-- Force RLS for all users
ALTER TABLE public.ad_defaults FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ad_drafts FORCE ROW LEVEL SECURITY;

-- Revoke public access
REVOKE ALL ON public.ad_defaults FROM anon, public;
REVOKE ALL ON public.ad_drafts FROM anon, public;

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_defaults TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_drafts TO authenticated;

-- RLS policies for ad_defaults (admins only)
CREATE POLICY "Admins can manage ad defaults"
  ON public.ad_defaults
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ad_drafts (admins only)
CREATE POLICY "Admins can manage ad drafts"
  ON public.ad_drafts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for ad media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-media',
  'ad-media',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime']
);

-- Storage RLS policies for ad-media bucket
CREATE POLICY "Admins can upload ad media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ad-media' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can view ad media"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ad-media' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete ad media"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'ad-media' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Create updated_at trigger for ad_defaults
CREATE TRIGGER update_ad_defaults_updated_at
  BEFORE UPDATE ON public.ad_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for ad_drafts
CREATE TRIGGER update_ad_drafts_updated_at
  BEFORE UPDATE ON public.ad_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();