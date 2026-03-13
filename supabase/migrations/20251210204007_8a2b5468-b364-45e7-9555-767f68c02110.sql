-- Add insert_id column
ALTER TABLE mixpanel_events ADD COLUMN insert_id TEXT;

-- Drop old unique constraint
ALTER TABLE mixpanel_events DROP CONSTRAINT IF EXISTS mixpanel_events_unique_event;

-- Add new unique constraint using insert_id
ALTER TABLE mixpanel_events ADD CONSTRAINT mixpanel_events_unique_insert_id UNIQUE (user_id, insert_id);