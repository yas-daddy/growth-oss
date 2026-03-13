-- ===========================================
-- INDEX CLEANUP: Remove 4 redundant indexes
-- Saves ~57 MB storage, improves write performance
-- ===========================================

-- ROLLBACK SCRIPTS (save before executing):
-- CREATE INDEX idx_mixpanel_events_name_time ON mixpanel_events(event_name, event_time);
-- CREATE INDEX idx_mixpanel_events_event_name ON mixpanel_events(event_name);
-- CREATE INDEX idx_mixpanel_events_distinct_id ON mixpanel_events(distinct_id);
-- CREATE INDEX idx_mixpanel_events_mixpanel_user_id ON mixpanel_events(mixpanel_user_id);

-- 1. Drop duplicate composite index (34 MB) - ZERO RISK
-- Identical to idx_mixpanel_events_event_time_name
DROP INDEX IF EXISTS idx_mixpanel_events_name_time;

-- 2. Drop single-column event_name index (5.8 MB) - VERY LOW RISK
-- Fully covered by idx_mixpanel_events_event_time_name (event_name, event_time)
DROP INDEX IF EXISTS idx_mixpanel_events_event_name;

-- 3. Drop single-column distinct_id index (8.7 MB) - LOW RISK
-- Covered by idx_mixpanel_events_user_ids (mixpanel_user_id, distinct_id)
DROP INDEX IF EXISTS idx_mixpanel_events_distinct_id;

-- 4. Drop single-column mixpanel_user_id index (8.5 MB) - LOW RISK
-- Covered by idx_mixpanel_events_user_ids
DROP INDEX IF EXISTS idx_mixpanel_events_mixpanel_user_id;

-- Update statistics after dropping indexes
ANALYZE mixpanel_events;