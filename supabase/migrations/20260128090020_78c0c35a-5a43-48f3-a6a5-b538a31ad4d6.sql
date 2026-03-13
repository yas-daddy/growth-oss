-- Create covering index for FTD events to enable fast unique user counting
CREATE INDEX idx_mixpanel_events_distinct_covering 
ON public.mixpanel_events (event_name, event_time) 
INCLUDE (mixpanel_user_id, distinct_id)
WHERE event_name = 'first_time_deposit';

-- Create covering index for signup events to enable fast unique user counting
CREATE INDEX idx_mixpanel_events_signup_covering 
ON public.mixpanel_events (event_name, event_time) 
INCLUDE (mixpanel_user_id, distinct_id)
WHERE event_name = 'signup_completed';