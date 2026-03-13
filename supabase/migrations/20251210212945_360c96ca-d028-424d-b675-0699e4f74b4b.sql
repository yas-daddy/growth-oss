-- Create user identity map table for linking Mixpanel distinct_id to AppsFlyer ID
CREATE TABLE public.user_identity_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  distinct_id TEXT NOT NULL,
  appsflyer_id TEXT NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one mapping per distinct_id per user
ALTER TABLE public.user_identity_map 
ADD CONSTRAINT user_identity_map_unique_distinct_id UNIQUE (user_id, distinct_id);

-- Index for looking up by appsflyer_id
CREATE INDEX idx_user_identity_map_appsflyer ON public.user_identity_map(user_id, appsflyer_id);

-- Enable RLS
ALTER TABLE public.user_identity_map ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own identity mappings" 
ON public.user_identity_map FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own identity mappings" 
ON public.user_identity_map FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own identity mappings" 
ON public.user_identity_map FOR UPDATE 
USING (auth.uid() = user_id);

-- Add indexes to mixpanel_events for common query patterns
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_event_name ON public.mixpanel_events(user_id, event_name);
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_distinct_id ON public.mixpanel_events(user_id, distinct_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_event_time ON public.mixpanel_events(user_id, event_time DESC);