-- Create table for Moloco creatives (using Moloco's terminology)
CREATE TABLE public.moloco_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creative_id TEXT NOT NULL,
  creative_name TEXT NOT NULL,
  creative_type TEXT,
  main_asset_url TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  ad_group_id TEXT,
  ad_group_name TEXT,
  status TEXT DEFAULT 'UNKNOWN',
  total_spend NUMERIC DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_installs INTEGER DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creative_id)
);

-- Create table for daily Moloco creative spend
CREATE TABLE public.daily_moloco_creative_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creative_id TEXT NOT NULL,
  creative_name TEXT NOT NULL,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creative_id, date)
);

-- Enable RLS on both tables
ALTER TABLE public.moloco_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_moloco_creative_spend ENABLE ROW LEVEL SECURITY;

-- Force RLS for all users
ALTER TABLE public.moloco_creatives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_moloco_creative_spend FORCE ROW LEVEL SECURITY;

-- RLS policies for moloco_creatives
CREATE POLICY "Admins can insert moloco creatives"
  ON public.moloco_creatives FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update moloco creatives"
  ON public.moloco_creatives FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Non-affiliates can view moloco creatives"
  ON public.moloco_creatives FOR SELECT
  USING (NOT is_affiliate_only(auth.uid()));

-- RLS policies for daily_moloco_creative_spend
CREATE POLICY "Admins can insert daily moloco creative spend"
  ON public.daily_moloco_creative_spend FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update daily moloco creative spend"
  ON public.daily_moloco_creative_spend FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Non-affiliates can view daily moloco creative spend"
  ON public.daily_moloco_creative_spend FOR SELECT
  USING (NOT is_affiliate_only(auth.uid()));

-- Grant SELECT to authenticated users (RLS policies control actual access)
GRANT SELECT ON public.moloco_creatives TO authenticated;
GRANT SELECT ON public.daily_moloco_creative_spend TO authenticated;

-- Create indexes for better query performance
CREATE INDEX idx_moloco_creatives_creative_id ON public.moloco_creatives(creative_id);
CREATE INDEX idx_daily_moloco_creative_spend_date ON public.daily_moloco_creative_spend(date);
CREATE INDEX idx_daily_moloco_creative_spend_creative_id ON public.daily_moloco_creative_spend(creative_id);