-- Step 1: Fix mixpanel_events table
-- Add mixpanel_user_id column
ALTER TABLE mixpanel_events ADD COLUMN IF NOT EXISTS mixpanel_user_id TEXT;

-- Backfill from properties JSON
UPDATE mixpanel_events 
SET mixpanel_user_id = properties->>'user_id'
WHERE mixpanel_user_id IS NULL AND properties->>'user_id' IS NOT NULL;

-- Add amount column for deposits/withdrawals
ALTER TABLE mixpanel_events ADD COLUMN IF NOT EXISTS amount NUMERIC;

-- Drop the incorrect user_id UUID column
ALTER TABLE mixpanel_events DROP COLUMN IF EXISTS user_id;

-- Add index for efficient querying by user
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_mixpanel_user_id ON mixpanel_events(mixpanel_user_id);

-- Step 2: Fix mixpanel_user_ltv table
-- Add mixpanel_user_id column
ALTER TABLE mixpanel_user_ltv ADD COLUMN IF NOT EXISTS mixpanel_user_id TEXT;

-- Backfill from appsflyer_id (use it as identifier for now)
UPDATE mixpanel_user_ltv 
SET mixpanel_user_id = appsflyer_id
WHERE mixpanel_user_id IS NULL;

-- Add new columns for withdrawal tracking
ALTER TABLE mixpanel_user_ltv ADD COLUMN IF NOT EXISTS total_withdrawals NUMERIC DEFAULT 0;
ALTER TABLE mixpanel_user_ltv ADD COLUMN IF NOT EXISTS total_withdrawal_count INTEGER DEFAULT 0;
ALTER TABLE mixpanel_user_ltv ADD COLUMN IF NOT EXISTS total_deposit_count INTEGER DEFAULT 0;
ALTER TABLE mixpanel_user_ltv ADD COLUMN IF NOT EXISTS first_signup_at TIMESTAMPTZ;

-- Drop the incorrect user_id UUID column
ALTER TABLE mixpanel_user_ltv DROP COLUMN IF EXISTS user_id;

-- Add unique constraint on mixpanel_user_id (after ensuring no nulls/duplicates)
CREATE INDEX IF NOT EXISTS idx_mixpanel_user_ltv_mixpanel_user_id ON mixpanel_user_ltv(mixpanel_user_id);

-- Step 3: Fix user_identity_map table
-- Add mixpanel_user_id column
ALTER TABLE user_identity_map ADD COLUMN IF NOT EXISTS mixpanel_user_id TEXT;

-- Backfill from distinct_id
UPDATE user_identity_map 
SET mixpanel_user_id = distinct_id
WHERE mixpanel_user_id IS NULL;

-- Drop the incorrect user_id UUID column
ALTER TABLE user_identity_map DROP COLUMN IF EXISTS user_id;

-- Add index
CREATE INDEX IF NOT EXISTS idx_user_identity_map_mixpanel_user_id ON user_identity_map(mixpanel_user_id);