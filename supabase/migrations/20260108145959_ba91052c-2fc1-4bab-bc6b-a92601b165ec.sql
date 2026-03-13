-- Create table for Apple Search Ads keywords with daily metrics
CREATE TABLE public.apple_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  match_type TEXT,
  status TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  adgroup_id TEXT,
  adgroup_name TEXT,
  bid_amount NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  taps INTEGER DEFAULT 0,
  installs INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  avg_cpa NUMERIC,
  avg_cpt NUMERIC,
  ttr NUMERIC,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, keyword_id)
);

-- Create table for daily keyword spend data
CREATE TABLE public.daily_apple_keyword_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  match_type TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  taps INTEGER DEFAULT 0,
  installs INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(keyword_id, date)
);

-- Enable RLS
ALTER TABLE public.apple_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_apple_keyword_spend ENABLE ROW LEVEL SECURITY;

-- RLS policies for apple_keywords
CREATE POLICY "Users can view all apple_keywords"
ON public.apple_keywords
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert apple_keywords"
ON public.apple_keywords
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update apple_keywords"
ON public.apple_keywords
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- RLS policies for daily_apple_keyword_spend
CREATE POLICY "Users can view all daily_apple_keyword_spend"
ON public.daily_apple_keyword_spend
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert daily_apple_keyword_spend"
ON public.daily_apple_keyword_spend
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update daily_apple_keyword_spend"
ON public.daily_apple_keyword_spend
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX idx_apple_keywords_keyword_id ON public.apple_keywords(keyword_id);
CREATE INDEX idx_daily_apple_keyword_spend_date ON public.daily_apple_keyword_spend(date);
CREATE INDEX idx_daily_apple_keyword_spend_keyword_id ON public.daily_apple_keyword_spend(keyword_id);