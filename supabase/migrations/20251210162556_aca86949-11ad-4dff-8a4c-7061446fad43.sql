-- Create a unified daily spend table for all ad platforms
CREATE TABLE public.daily_ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- 'meta', 'apple', 'moloco'
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, campaign_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_ad_spend ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own daily spend" 
ON public.daily_ad_spend 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily spend" 
ON public.daily_ad_spend 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily spend" 
ON public.daily_ad_spend 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily spend" 
ON public.daily_ad_spend 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_daily_ad_spend_user_date ON public.daily_ad_spend(user_id, date);
CREATE INDEX idx_daily_ad_spend_platform ON public.daily_ad_spend(platform);