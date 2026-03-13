
-- Add composite index to speed up mixpanel_events queries
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_event_time_name 
ON mixpanel_events (event_name, event_time);

-- Add index on user identifiers for faster lookups
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_user_ids 
ON mixpanel_events (mixpanel_user_id, distinct_id);
