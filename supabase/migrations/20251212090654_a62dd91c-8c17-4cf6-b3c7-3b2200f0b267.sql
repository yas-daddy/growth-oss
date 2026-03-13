-- First, delete duplicate rows keeping only the most recent synced_at for each platform/campaign_id/date
DELETE FROM daily_ad_spend a
USING daily_ad_spend b
WHERE a.platform = b.platform
  AND a.campaign_id = b.campaign_id
  AND a.date = b.date
  AND a.synced_at < b.synced_at;

-- Drop the old unique constraint (it's a constraint, not just an index)
ALTER TABLE daily_ad_spend DROP CONSTRAINT IF EXISTS daily_ad_spend_user_id_platform_campaign_id_date_key;

-- Create new unique constraint without user_id
ALTER TABLE daily_ad_spend ADD CONSTRAINT daily_ad_spend_platform_campaign_date_key 
UNIQUE (platform, campaign_id, date);