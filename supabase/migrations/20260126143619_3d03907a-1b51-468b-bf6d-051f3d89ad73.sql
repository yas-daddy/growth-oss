-- Add expression index without the date cast (use event_time directly)
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_user_coalesce 
ON mixpanel_events(COALESCE(mixpanel_user_id, distinct_id), event_name);

-- Update FTD Cohort Deposits with INNER JOIN and longer timeout
CREATE OR REPLACE FUNCTION get_report_ftd_cohort_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
BEGIN
  RETURN QUERY
  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  )
  SELECT 
    COALESCE(SUM((me.properties->>'deposit_amount')::numeric), 0) as value,
    0::numeric as previous_value
  FROM mixpanel_events me
  INNER JOIN cohort_users cu ON COALESCE(me.mixpanel_user_id, me.distinct_id) = cu.user_id
  WHERE me.event_name = 'deposit_success'
    AND me.event_time >= start_date::timestamp
    AND me.event_time < (end_date + 1)::timestamp;
END;
$$;

-- Update New Users Net Deposits with INNER JOIN
CREATE OR REPLACE FUNCTION get_report_new_users_net_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  deposits numeric;
  withdrawals numeric;
BEGIN
  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  )
  SELECT 
    COALESCE(SUM(CASE WHEN me.event_name = 'deposit_success' THEN (me.properties->>'deposit_amount')::numeric ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN me.event_name = 'withdrawal_success' THEN (me.properties->>'withdrawal_amount')::numeric ELSE 0 END), 0)
  INTO deposits, withdrawals
  FROM mixpanel_events me
  INNER JOIN cohort_users cu ON COALESCE(me.mixpanel_user_id, me.distinct_id) = cu.user_id
  WHERE me.event_name IN ('deposit_success', 'withdrawal_success')
    AND me.event_time >= start_date::timestamp
    AND me.event_time < (end_date + 1)::timestamp;
  
  RETURN QUERY SELECT deposits - withdrawals, 0::numeric;
END;
$$;

-- Update Avg Net per FTD with INNER JOIN
CREATE OR REPLACE FUNCTION get_report_avg_net_per_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  deposits numeric;
  withdrawals numeric;
  ftd_count numeric;
BEGIN
  SELECT COUNT(*)::numeric INTO ftd_count
  FROM user_ftd_dates 
  WHERE ftd_date >= start_date AND ftd_date <= end_date;

  WITH cohort_users AS (
    SELECT user_id 
    FROM user_ftd_dates 
    WHERE ftd_date >= start_date AND ftd_date <= end_date
  )
  SELECT 
    COALESCE(SUM(CASE WHEN me.event_name = 'deposit_success' THEN (me.properties->>'deposit_amount')::numeric ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN me.event_name = 'withdrawal_success' THEN (me.properties->>'withdrawal_amount')::numeric ELSE 0 END), 0)
  INTO deposits, withdrawals
  FROM mixpanel_events me
  INNER JOIN cohort_users cu ON COALESCE(me.mixpanel_user_id, me.distinct_id) = cu.user_id
  WHERE me.event_name IN ('deposit_success', 'withdrawal_success')
    AND me.event_time >= start_date::timestamp
    AND me.event_time < (end_date + 1)::timestamp;
  
  RETURN QUERY SELECT 
    CASE WHEN ftd_count > 0 THEN (deposits - withdrawals) / ftd_count ELSE 0 END,
    0::numeric;
END;
$$;