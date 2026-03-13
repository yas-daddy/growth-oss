-- Create unique index on just distinct_id for user_identity_map
CREATE UNIQUE INDEX IF NOT EXISTS user_identity_map_distinct_id_unique 
ON user_identity_map(distinct_id);