-- Add indexes to speed up mixpanel_events queries for cohort reports
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_name_time ON public.mixpanel_events(event_name, event_time);
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_user_id_event ON public.mixpanel_events(COALESCE(mixpanel_user_id, distinct_id), event_name);