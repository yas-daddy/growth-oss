-- Step 1: Create user FTD lookup table
CREATE TABLE IF NOT EXISTS user_ftd_dates (
  user_id TEXT PRIMARY KEY,
  ftd_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_ftd_dates_ftd_date ON user_ftd_dates(ftd_date);

-- Step 2: Create populate function for the lookup table
CREATE OR REPLACE FUNCTION populate_user_ftd_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Insert users who have FTD but are not yet in the lookup table
  -- We take the EARLIEST FTD date per user (in case of duplicates)
  WITH new_ftd_users AS (
    SELECT 
      COALESCE(mixpanel_user_id, distinct_id) as user_id,
      MIN(event_time::date) as ftd_date
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND COALESCE(mixpanel_user_id, distinct_id) NOT IN (SELECT user_id FROM user_ftd_dates)
    GROUP BY COALESCE(mixpanel_user_id, distinct_id)
  )
  INSERT INTO user_ftd_dates (user_id, ftd_date)
  SELECT user_id, ftd_date FROM new_ftd_users;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Step 3: Update report functions to use the lookup table

-- FTD Cohort Deposits - uses lookup table for fast cohort identification
CREATE OR REPLACE FUNCTION get_report_ftd_cohort_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  )
  SELECT 
    COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as value,
    0::numeric as previous_value
  FROM mixpanel_events me
  WHERE COALESCE(me.mixpanel_user_id, me.distinct_id) IN (SELECT user_id FROM cohort_users)
    AND me.event_name = 'deposit_success'
    AND me.event_time::date >= start_date 
    AND me.event_time::date <= end_date;
$$;

-- New Users Net Deposits - uses lookup table
CREATE OR REPLACE FUNCTION get_report_new_users_net_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  ),
  totals AS (
    SELECT 
      COALESCE(SUM(CASE WHEN event_name = 'deposit_success' THEN (properties->>'deposit_amount')::numeric ELSE 0 END), 0) as deposits,
      COALESCE(SUM(CASE WHEN event_name = 'withdrawal_success' THEN (properties->>'withdrawal_amount')::numeric ELSE 0 END), 0) as withdrawals
    FROM mixpanel_events me
    WHERE COALESCE(me.mixpanel_user_id, me.distinct_id) IN (SELECT user_id FROM cohort_users)
      AND me.event_name IN ('deposit_success', 'withdrawal_success')
      AND me.event_time::date >= start_date 
      AND me.event_time::date <= end_date
  )
  SELECT 
    deposits - withdrawals as value,
    0::numeric as previous_value
  FROM totals;
$$;

-- Avg Net per FTD - uses lookup table
CREATE OR REPLACE FUNCTION get_report_avg_net_per_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  ),
  ftd_count AS (
    SELECT COUNT(*)::numeric as cnt FROM cohort_users
  ),
  totals AS (
    SELECT 
      COALESCE(SUM(CASE WHEN event_name = 'deposit_success' THEN (properties->>'deposit_amount')::numeric ELSE 0 END), 0) as deposits,
      COALESCE(SUM(CASE WHEN event_name = 'withdrawal_success' THEN (properties->>'withdrawal_amount')::numeric ELSE 0 END), 0) as withdrawals
    FROM mixpanel_events me
    WHERE COALESCE(me.mixpanel_user_id, me.distinct_id) IN (SELECT user_id FROM cohort_users)
      AND me.event_name IN ('deposit_success', 'withdrawal_success')
      AND me.event_time::date >= start_date 
      AND me.event_time::date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT cnt FROM ftd_count) > 0 
      THEN (deposits - withdrawals) / (SELECT cnt FROM ftd_count)
      ELSE 0 
    END as value,
    0::numeric as previous_value
  FROM totals;
$$;

-- Update report definitions to use direct functions (no cache needed)
UPDATE report_definitions 
SET data_source = 'get_report_ftd_cohort_deposits'
WHERE slug = 'ftd_cohort_deposits';

UPDATE report_definitions 
SET data_source = 'get_report_new_users_net_deposits'
WHERE slug = 'new_users_net_deposits';

UPDATE report_definitions 
SET data_source = 'get_report_avg_net_per_ftd'
WHERE slug = 'avg_net_per_ftd';