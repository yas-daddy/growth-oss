-- First, delete duplicate rows keeping only the first one
DELETE FROM mixpanel_events a
USING mixpanel_events b
WHERE a.id > b.id 
  AND a.insert_id = b.insert_id
  AND a.user_id = b.user_id;

-- Create unique index for proper upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS mixpanel_events_user_insert_unique 
ON mixpanel_events(user_id, insert_id);