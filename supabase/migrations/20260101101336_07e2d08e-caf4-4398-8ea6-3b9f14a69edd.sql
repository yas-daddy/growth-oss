-- Create ad_launch_history table to track published ads
CREATE TABLE public.ad_launch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ad details
  ad_name TEXT NOT NULL,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  adset_ids TEXT[] NOT NULL DEFAULT '{}',
  adset_names TEXT[] NOT NULL DEFAULT '{}',
  campaign_name TEXT,
  meta_ad_ids TEXT[] DEFAULT '{}',
  
  -- Counts
  ads_count INTEGER NOT NULL DEFAULT 0,
  adsets_count INTEGER NOT NULL DEFAULT 0,
  
  -- Status and timing
  status TEXT NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  error_message TEXT,
  
  -- Creative details for reference
  primary_text TEXT,
  headline TEXT,
  call_to_action TEXT
);

-- Enable Row Level Security
ALTER TABLE public.ad_launch_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage all launch history
CREATE POLICY "Admins can manage ad launch history"
ON public.ad_launch_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Non-affiliates can view launch history
CREATE POLICY "Non-affiliates can view ad launch history"
ON public.ad_launch_history
FOR SELECT
USING (NOT is_affiliate_only(auth.uid()));