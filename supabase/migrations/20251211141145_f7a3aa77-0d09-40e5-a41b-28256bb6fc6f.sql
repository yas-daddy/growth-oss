
-- Drop and recreate with optimized query
DROP FUNCTION IF EXISTS public.get_ftd_cohort_deposits(timestamptz, timestamptz);

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
    -- Get unique FTD users using mixpanel_user_id (primary) or distinct_id (fallback)
    SELECT DISTINCT 
      COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date
      AND event_time <= end_date
  ),
  deposit_sums AS (
    -- Sum deposits for users in the FTD cohort
    SELECT 
      SUM((properties->>'deposit_amount')::numeric) as total_dep
    FROM mixpanel_events d
    WHERE d.event_name = 'deposit_success'
      AND d.event_time >= start_date
      AND d.event_time <= end_date
      AND COALESCE(d.mixpanel_user_id, d.distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    COALESCE((SELECT total_dep FROM deposit_sums), 0) as total_deposits,
    (SELECT COUNT(*) FROM ftd_users) as ftd_user_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM ftd_users) > 0 
      THEN COALESCE((SELECT total_dep FROM deposit_sums), 0) / (SELECT COUNT(*) FROM ftd_users)
      ELSE 0 
    END as avg_per_ftd_user;
$$;
