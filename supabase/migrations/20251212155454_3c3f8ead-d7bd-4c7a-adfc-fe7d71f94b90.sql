-- Phase 1: Fix daily_affiliate_spend constraints (remove user_id)
ALTER TABLE daily_affiliate_spend 
DROP CONSTRAINT IF EXISTS daily_affiliate_spend_unique_key;

ALTER TABLE daily_affiliate_spend 
DROP CONSTRAINT IF EXISTS daily_affiliate_spend_user_id_affiliate_id_date_key;

ALTER TABLE daily_affiliate_spend 
ADD CONSTRAINT daily_affiliate_spend_unique_key 
UNIQUE (affiliate_id, date);

-- Phase 2: Fix attributed_users constraint (remove user_id)
ALTER TABLE attributed_users 
DROP CONSTRAINT IF EXISTS attributed_users_user_id_appsflyer_id_key;

ALTER TABLE attributed_users 
ADD CONSTRAINT attributed_users_unique_key 
UNIQUE (appsflyer_id);