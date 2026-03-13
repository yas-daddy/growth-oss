-- Phase 1: Fix appsflyer_events constraint (remove user_id)
ALTER TABLE appsflyer_events 
DROP CONSTRAINT IF EXISTS appsflyer_events_unique_key;

ALTER TABLE appsflyer_events 
ADD CONSTRAINT appsflyer_events_unique_key 
UNIQUE (event_date, event_name, media_source, campaign_name, platform);

-- Phase 2: Drop old daily_appsflyer_installs constraint with user_id
ALTER TABLE daily_appsflyer_installs 
DROP CONSTRAINT IF EXISTS daily_appsflyer_installs_user_id_date_platform_media_source_key;

-- Phase 3: Drop redundant daily_appsflyer_clicks constraint
ALTER TABLE daily_appsflyer_clicks 
DROP CONSTRAINT IF EXISTS daily_appsflyer_clicks_platform_media_source_campaign_name__key;