-- Create table for Meta ad-level data
CREATE TABLE public.meta_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  preview_url TEXT,
  thumbnail_url TEXT,
  creative_type TEXT,
  status TEXT,
  created_time TIMESTAMP WITH TIME ZONE,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  date_start DATE,
  date_stop DATE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE(ad_id)
);

-- Create table for daily ad-level spend
CREATE TABLE public.daily_meta_ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE(ad_id, date)
);

-- Enable RLS
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_meta_ad_spend ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_ads
CREATE POLICY "Users can view meta ads" 
ON public.meta_ads 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert meta ads" 
ON public.meta_ads 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update meta ads" 
ON public.meta_ads 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS policies for daily_meta_ad_spend
CREATE POLICY "Users can view daily meta ad spend" 
ON public.daily_meta_ad_spend 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert daily meta ad spend" 
ON public.daily_meta_ad_spend 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update daily meta ad spend" 
ON public.daily_meta_ad_spend 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Add indexes for performance
CREATE INDEX idx_meta_ads_created_time ON public.meta_ads(created_time);
CREATE INDEX idx_meta_ads_spend ON public.meta_ads(spend DESC);
CREATE INDEX idx_daily_meta_ad_spend_date ON public.daily_meta_ad_spend(date);
CREATE INDEX idx_daily_meta_ad_spend_ad_id ON public.daily_meta_ad_spend(ad_id);

-- Create trigger for updated_at
CREATE TRIGGER update_meta_ads_updated_at
BEFORE UPDATE ON public.meta_ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();