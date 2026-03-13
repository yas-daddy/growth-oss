-- Create daily_appsflyer_clicks table for storing daily clicks data
CREATE TABLE public.daily_appsflyer_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  media_source TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  date DATE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(platform, media_source, campaign_name, date)
);

-- Enable Row Level Security
ALTER TABLE public.daily_appsflyer_clicks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies matching other AppsFlyer tables
CREATE POLICY "Admins can create daily appsflyer clicks"
ON public.daily_appsflyer_clicks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update daily appsflyer clicks"
ON public.daily_appsflyer_clicks
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete daily appsflyer clicks"
ON public.daily_appsflyer_clicks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view all daily appsflyer clicks"
ON public.daily_appsflyer_clicks
FOR SELECT
USING (true);