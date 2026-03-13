-- Add unique constraints to daily tables

-- Unique constraint on daily_appsflyer_installs
ALTER TABLE daily_appsflyer_installs 
ADD CONSTRAINT daily_appsflyer_installs_unique_key 
UNIQUE (date, media_source, campaign_name, platform);

-- Unique constraint on daily_appsflyer_clicks
ALTER TABLE daily_appsflyer_clicks 
ADD CONSTRAINT daily_appsflyer_clicks_unique_key 
UNIQUE (date, media_source, campaign_name, platform);