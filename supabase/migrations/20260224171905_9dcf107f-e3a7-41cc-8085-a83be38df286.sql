ALTER TABLE ad_launch_history ADD COLUMN campaign_names text[] DEFAULT '{}';
UPDATE ad_launch_history SET campaign_names = CASE WHEN campaign_name IS NOT NULL THEN ARRAY[campaign_name] ELSE '{}' END;