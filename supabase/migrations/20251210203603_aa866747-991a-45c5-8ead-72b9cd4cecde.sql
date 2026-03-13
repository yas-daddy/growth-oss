-- Add unique constraint to mixpanel_events for proper upserts
ALTER TABLE mixpanel_events 
ADD CONSTRAINT mixpanel_events_unique_event 
UNIQUE (user_id, distinct_id, event_name, event_time);