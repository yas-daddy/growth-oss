-- Create table for daily blended install data from AppsFlyer
CREATE TABLE public.daily_appsflyer_installs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  media_source TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  installs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, platform, media_source, campaign_name)
);

-- Enable Row Level Security
ALTER TABLE public.daily_appsflyer_installs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can create daily appsflyer installs"
ON public.daily_appsflyer_installs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update daily appsflyer installs"
ON public.daily_appsflyer_installs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete daily appsflyer installs"
ON public.daily_appsflyer_installs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view all daily appsflyer installs"
ON public.daily_appsflyer_installs
FOR SELECT
USING (true);

-- Create index for efficient date range queries
CREATE INDEX idx_daily_appsflyer_installs_date ON public.daily_appsflyer_installs(date);