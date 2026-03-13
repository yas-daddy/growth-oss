-- Create mixpanel_events table to store raw event data
CREATE TABLE public.mixpanel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_time timestamptz NOT NULL,
  distinct_id text NOT NULL,
  appsflyer_id text,
  properties jsonb,
  revenue numeric DEFAULT 0,
  platform text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mixpanel_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own mixpanel events"
ON public.mixpanel_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mixpanel events"
ON public.mixpanel_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mixpanel events"
ON public.mixpanel_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mixpanel events"
ON public.mixpanel_events FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX idx_mixpanel_events_appsflyer_id ON public.mixpanel_events(appsflyer_id);
CREATE INDEX idx_mixpanel_events_event_name ON public.mixpanel_events(event_name);
CREATE INDEX idx_mixpanel_events_event_time ON public.mixpanel_events(event_time);
CREATE INDEX idx_mixpanel_events_distinct_id ON public.mixpanel_events(distinct_id);

-- Create mixpanel_user_ltv table for aggregated LTV metrics
CREATE TABLE public.mixpanel_user_ltv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  appsflyer_id text NOT NULL,
  distinct_id text,
  total_revenue numeric DEFAULT 0,
  total_deposits numeric DEFAULT 0,
  total_bets integer DEFAULT 0,
  first_deposit_at timestamptz,
  last_activity_at timestamptz,
  cohort_date date,
  media_source text,
  campaign_name text,
  platform text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, appsflyer_id)
);

-- Enable RLS
ALTER TABLE public.mixpanel_user_ltv ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own mixpanel ltv"
ON public.mixpanel_user_ltv FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mixpanel ltv"
ON public.mixpanel_user_ltv FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mixpanel ltv"
ON public.mixpanel_user_ltv FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mixpanel ltv"
ON public.mixpanel_user_ltv FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_mixpanel_user_ltv_appsflyer_id ON public.mixpanel_user_ltv(appsflyer_id);
CREATE INDEX idx_mixpanel_user_ltv_media_source ON public.mixpanel_user_ltv(media_source);
CREATE INDEX idx_mixpanel_user_ltv_cohort_date ON public.mixpanel_user_ltv(cohort_date);