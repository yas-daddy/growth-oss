-- Create weekly_metrics table to store aggregated weekly data
CREATE TABLE public.weekly_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL UNIQUE, -- Monday of the week (W/C date)
  
  -- Ad channel metrics (JSONB for flexibility: {channel_name: value})
  spend_by_channel JSONB DEFAULT '{}'::jsonb,
  clicks_by_channel JSONB DEFAULT '{}'::jsonb,
  ftds_by_channel JSONB DEFAULT '{}'::jsonb,
  cpa_by_channel JSONB DEFAULT '{}'::jsonb,
  
  -- Affiliate metrics (JSONB: {affiliate_id: {name, spend, ftds}})
  affiliate_metrics JSONB DEFAULT '{}'::jsonb,
  
  -- Totals from AppsFlyer
  total_installs INTEGER NOT NULL DEFAULT 0,
  
  -- Totals from Mixpanel
  total_signups INTEGER NOT NULL DEFAULT 0,
  total_ftds INTEGER NOT NULL DEFAULT 0,
  total_stds INTEGER NOT NULL DEFAULT 0,
  
  -- Spend totals
  total_ad_spend NUMERIC NOT NULL DEFAULT 0,
  total_affiliate_spend NUMERIC NOT NULL DEFAULT 0,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  
  -- Blended metrics
  blended_cac NUMERIC DEFAULT 0, -- all spend / signups
  blended_cpa NUMERIC DEFAULT 0, -- all spend / FTDs
  
  -- Conversion rates (stored as decimals, e.g., 0.15 = 15%)
  cvr_install_to_signup NUMERIC DEFAULT 0,
  cvr_signup_to_ftd NUMERIC DEFAULT 0,
  cvr_ftd_to_std NUMERIC DEFAULT 0,
  cvr_install_to_std NUMERIC DEFAULT 0,
  
  -- Revenue metrics (FTD cohort)
  ftd_cohort_deposits NUMERIC DEFAULT 0,
  avg_deposit_per_ftd NUMERIC DEFAULT 0,
  ad_spend_per_1k_deposit NUMERIC DEFAULT 0,
  
  -- AppsFlyer LTV revenue
  net_deposits_new_users NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  
  -- Ratings
  avg_rating NUMERIC DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weekly_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view weekly metrics"
ON public.weekly_metrics
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage weekly metrics"
ON public.weekly_metrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_weekly_metrics_updated_at
BEFORE UPDATE ON public.weekly_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast week lookups
CREATE INDEX idx_weekly_metrics_week_start ON public.weekly_metrics(week_start DESC);