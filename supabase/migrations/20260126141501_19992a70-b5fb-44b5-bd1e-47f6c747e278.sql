-- Step 1: Create Pre-aggregated Revenue Table
CREATE TABLE IF NOT EXISTS daily_revenue_metrics (
  date DATE PRIMARY KEY,
  ftd_cohort_deposits NUMERIC DEFAULT 0,
  ftd_cohort_withdrawals NUMERIC DEFAULT 0,
  ftd_cohort_net_deposits NUMERIC DEFAULT 0,
  ftd_count INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_revenue_metrics_date ON daily_revenue_metrics(date);

-- Enable RLS
ALTER TABLE daily_revenue_metrics ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated users" 
ON daily_revenue_metrics FOR SELECT 
TO authenticated 
USING (true);

-- Step 2: Create Populate Function
CREATE OR REPLACE FUNCTION populate_daily_revenue_metrics()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_date DATE;
BEGIN
  -- Process each day that has FTDs but no revenue metrics (only past days)
  FOR target_date IN 
    SELECT DISTINCT event_time::date as d
    FROM mixpanel_events 
    WHERE event_name = 'first_time_deposit'
      AND event_time::date < CURRENT_DATE
      AND event_time::date NOT IN (SELECT date FROM daily_revenue_metrics)
    ORDER BY d
  LOOP
    -- Calculate metrics for this day's FTD cohort
    INSERT INTO daily_revenue_metrics (date, ftd_cohort_deposits, ftd_cohort_withdrawals, ftd_cohort_net_deposits, ftd_count)
    SELECT 
      target_date,
      COALESCE(SUM(CASE WHEN me.event_name = 'deposit_success' THEN (me.properties->>'deposit_amount')::numeric ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN me.event_name = 'withdrawal_success' THEN (me.properties->>'withdrawal_amount')::numeric ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN me.event_name = 'deposit_success' THEN (me.properties->>'deposit_amount')::numeric ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN me.event_name = 'withdrawal_success' THEN (me.properties->>'withdrawal_amount')::numeric ELSE 0 END), 0),
      (SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) 
       FROM mixpanel_events 
       WHERE event_name = 'first_time_deposit' 
       AND event_time::date = target_date)
    FROM mixpanel_events me
    WHERE COALESCE(me.mixpanel_user_id, me.distinct_id) IN (
      SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id)
      FROM mixpanel_events
      WHERE event_name = 'first_time_deposit'
      AND event_time::date = target_date
    )
    AND me.event_name IN ('deposit_success', 'withdrawal_success')
    AND me.event_time::date = target_date
    ON CONFLICT (date) DO UPDATE SET
      ftd_cohort_deposits = EXCLUDED.ftd_cohort_deposits,
      ftd_cohort_withdrawals = EXCLUDED.ftd_cohort_withdrawals,
      ftd_cohort_net_deposits = EXCLUDED.ftd_cohort_net_deposits,
      ftd_count = EXCLUDED.ftd_count,
      calculated_at = now();
  END LOOP;
END;
$$;

-- Step 3: Update Report Functions to Use Pre-aggregated Data

-- FTD Cohort Deposits - now uses pre-aggregated table
CREATE OR REPLACE FUNCTION get_report_ftd_cohort_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(ftd_cohort_deposits), 0) as value,
    0::numeric as previous_value
  FROM daily_revenue_metrics
  WHERE date >= start_date AND date <= end_date;
$$;

-- New Users Net Deposits - now uses pre-aggregated table
CREATE OR REPLACE FUNCTION get_report_new_users_net_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(ftd_cohort_net_deposits), 0) as value,
    0::numeric as previous_value
  FROM daily_revenue_metrics
  WHERE date >= start_date AND date <= end_date;
$$;

-- Avg Net per FTD - now uses pre-aggregated table
CREATE OR REPLACE FUNCTION get_report_avg_net_per_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH totals AS (
    SELECT 
      COALESCE(SUM(ftd_cohort_net_deposits), 0) as net,
      COALESCE(SUM(ftd_count), 0) as ftds
    FROM daily_revenue_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN ftds > 0 THEN net / ftds ELSE 0 END as value,
    0::numeric as previous_value
  FROM totals;
$$;

-- Step 4: Update Report Definitions to Use Direct Functions (remove _cached suffix)
UPDATE report_definitions 
SET data_source = 'get_report_ftd_cohort_deposits'
WHERE slug = 'ftd_cohort_deposits';

UPDATE report_definitions 
SET data_source = 'get_report_new_users_net_deposits'
WHERE slug = 'new_users_net_deposits';

UPDATE report_definitions 
SET data_source = 'get_report_avg_net_per_ftd'
WHERE slug = 'avg_net_per_ftd';