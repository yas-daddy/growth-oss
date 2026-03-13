-- Create appsflyer_campaigns table for campaign performance + revenue
CREATE TABLE public.appsflyer_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  media_source TEXT NOT NULL, -- e.g., 'googleadwords_int', 'Facebook Ads'
  campaign_name TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  arpu NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpi NUMERIC DEFAULT 0,
  date_start DATE,
  date_end DATE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appsflyer_events table for in-app event attribution
CREATE TABLE public.appsflyer_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  media_source TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  event_revenue NUMERIC DEFAULT 0,
  event_date DATE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.appsflyer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appsflyer_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for appsflyer_campaigns
CREATE POLICY "Users can view their own appsflyer campaigns"
ON public.appsflyer_campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appsflyer campaigns"
ON public.appsflyer_campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appsflyer campaigns"
ON public.appsflyer_campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appsflyer campaigns"
ON public.appsflyer_campaigns FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for appsflyer_events
CREATE POLICY "Users can view their own appsflyer events"
ON public.appsflyer_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appsflyer events"
ON public.appsflyer_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appsflyer events"
ON public.appsflyer_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appsflyer events"
ON public.appsflyer_events FOR DELETE
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_appsflyer_campaigns_updated_at
BEFORE UPDATE ON public.appsflyer_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_appsflyer_campaigns_user_id ON public.appsflyer_campaigns(user_id);
CREATE INDEX idx_appsflyer_campaigns_media_source ON public.appsflyer_campaigns(media_source);
CREATE INDEX idx_appsflyer_events_user_id ON public.appsflyer_events(user_id);
CREATE INDEX idx_appsflyer_events_media_source ON public.appsflyer_events(media_source);
CREATE INDEX idx_appsflyer_events_event_name ON public.appsflyer_events(event_name);