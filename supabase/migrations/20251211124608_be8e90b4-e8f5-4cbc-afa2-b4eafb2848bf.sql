-- Drop the partial index since it doesn't work with onConflict
DROP INDEX IF EXISTS mixpanel_events_insert_id_unique;

-- Add a unique constraint on insert_id (this will create an index too)
ALTER TABLE mixpanel_events ADD CONSTRAINT mixpanel_events_insert_id_key UNIQUE (insert_id);