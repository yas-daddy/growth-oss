-- Add unique constraints for incremental syncing with UPSERT

-- For AppsFlyer campaigns incremental sync
ALTER TABLE appsflyer_campaigns 
ADD CONSTRAINT appsflyer_campaigns_unique_key 
UNIQUE (user_id, platform, media_source, campaign_name, date_start);

-- For AppsFlyer events incremental sync  
ALTER TABLE appsflyer_events
ADD CONSTRAINT appsflyer_events_unique_key
UNIQUE (user_id, platform, media_source, campaign_name, event_name, event_date);

-- For daily affiliate spend incremental sync
ALTER TABLE daily_affiliate_spend
ADD CONSTRAINT daily_affiliate_spend_unique_key
UNIQUE (user_id, affiliate_id, date);

-- For Mixpanel events incremental sync
ALTER TABLE mixpanel_events
ADD CONSTRAINT mixpanel_events_unique_key
UNIQUE (user_id, distinct_id, event_name, event_time);

-- For Mixpanel user LTV incremental sync (appsflyer_id should be unique per user)
ALTER TABLE mixpanel_user_ltv
ADD CONSTRAINT mixpanel_user_ltv_unique_key
UNIQUE (user_id, appsflyer_id);