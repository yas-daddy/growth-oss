-- Add new column to weekly_metrics for net deposits
ALTER TABLE public.weekly_metrics 
ADD COLUMN IF NOT EXISTS new_users_net_deposits numeric DEFAULT 0;

-- Create function to calculate new users net deposits (deposits - withdrawals for FTD cohort)
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_net_deposits(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(total_deposits numeric, total_withdrawals numeric, net_deposits numeric, ftd_user_count bigint, avg_net_per_ftd_user numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total_dep
    FROM mixpanel_events d
    WHERE d.event_name = 'deposit_success'
      AND d.event_time >= start_date
      AND d.event_time <= end_date
      AND COALESCE(d.mixpanel_user_id, d.distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawal_sums AS (
    -- Sum withdrawals for users in the FTD cohort
    SELECT 
      COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total_wd
    FROM mixpanel_events w
    WHERE w.event_name = 'withdrawal_success'
      AND w.event_time >= start_date
      AND w.event_time <= end_date
      AND COALESCE(w.mixpanel_user_id, w.distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    (SELECT total_dep FROM deposit_sums) as total_deposits,
    (SELECT total_wd FROM withdrawal_sums) as total_withdrawals,
    (SELECT total_dep FROM deposit_sums) - (SELECT total_wd FROM withdrawal_sums) as net_deposits,
    (SELECT COUNT(*) FROM ftd_users) as ftd_user_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM ftd_users) > 0 
      THEN ((SELECT total_dep FROM deposit_sums) - (SELECT total_wd FROM withdrawal_sums)) / (SELECT COUNT(*) FROM ftd_users)
      ELSE 0 
    END as avg_net_per_ftd_user;
$function$;