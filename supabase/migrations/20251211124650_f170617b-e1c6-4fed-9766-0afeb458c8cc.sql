-- Drop old composite unique constraint from user_identity_map
ALTER TABLE user_identity_map DROP CONSTRAINT IF EXISTS user_identity_map_unique_distinct_id;
DROP INDEX IF EXISTS user_identity_map_unique_distinct_id;