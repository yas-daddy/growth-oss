
-- Create function to calculate FTD cohort deposits
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_deposits(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  total_deposits numeric,
  ftd_user_count bigint,
  avg_per_ftd_user numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date
      AND event_time <= end_date
  ),
  deposit_totals AS (
    SELECT 
      SUM((d.properties->>'deposit_amount')::numeric) as total_deposits,
      COUNT(DISTINCT COALESCE(d.mixpanel_user_id, d.distinct_id)) as depositor_count
    FROM mixpanel_events d
    JOIN ftd_users f ON COALESCE(d.mixpanel_user_id, d.distinct_id) = f.user_id
    WHERE d.event_name = 'deposit_success'
      AND d.event_time >= start_date
      AND d.event_time <= end_date
  )
  SELECT 
    COALESCE(dt.total_deposits, 0) as total_deposits,
    (SELECT COUNT(*) FROM ftd_users) as ftd_user_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM ftd_users) > 0 
      THEN COALESCE(dt.total_deposits, 0) / (SELECT COUNT(*) FROM ftd_users)
      ELSE 0 
    END as avg_per_ftd_user
  FROM deposit_totals dt;
$$;
