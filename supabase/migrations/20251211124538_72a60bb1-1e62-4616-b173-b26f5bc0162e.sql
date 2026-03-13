-- Drop constraints first, then indexes
ALTER TABLE mixpanel_events DROP CONSTRAINT IF EXISTS mixpanel_events_unique_key;
ALTER TABLE mixpanel_events DROP CONSTRAINT IF EXISTS mixpanel_events_unique_insert_id;
ALTER TABLE mixpanel_events DROP CONSTRAINT IF EXISTS mixpanel_events_user_insert_unique;

-- Drop indexes if they still exist
DROP INDEX IF EXISTS mixpanel_events_unique_key;
DROP INDEX IF EXISTS mixpanel_events_unique_insert_id;
DROP INDEX IF EXISTS mixpanel_events_user_insert_unique;

-- Create unique index on insert_id only (partial index for non-null values)
CREATE UNIQUE INDEX mixpanel_events_insert_id_unique 
ON mixpanel_events(insert_id) WHERE insert_id IS NOT NULL;

-- Make user_identity_map.user_id nullable
ALTER TABLE user_identity_map ALTER COLUMN user_id DROP NOT NULL;