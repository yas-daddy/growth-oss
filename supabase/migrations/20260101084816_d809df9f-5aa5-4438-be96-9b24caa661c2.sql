
-- Drop and recreate with optimized query and longer timeout
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_net_deposits(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_deposits numeric, total_withdrawals numeric, net_deposits numeric, ftd_user_count bigint, avg_net_per_ftd_user numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
  WITH ftd_users AS (
    SELECT DISTINCT 
      COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date
      AND event_time <= end_date
  ),
  user_transactions AS (
    SELECT 
      COALESCE(SUM(CASE WHEN event_name = 'deposit_success' THEN (properties->>'deposit_amount')::numeric ELSE 0 END), 0) as total_dep,
      COALESCE(SUM(CASE WHEN event_name = 'withdrawal_success' THEN (properties->>'withdrawal_amount')::numeric ELSE 0 END), 0) as total_wd
    FROM mixpanel_events
    WHERE event_name IN ('deposit_success', 'withdrawal_success')
      AND event_time >= start_date
      AND event_time <= end_date
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    (SELECT total_dep FROM user_transactions) as total_deposits,
    (SELECT total_wd FROM user_transactions) as total_withdrawals,
    (SELECT total_dep FROM user_transactions) - (SELECT total_wd FROM user_transactions) as net_deposits,
    (SELECT COUNT(*) FROM ftd_users) as ftd_user_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM ftd_users) > 0 
      THEN ((SELECT total_dep FROM user_transactions) - (SELECT total_wd FROM user_transactions)) / (SELECT COUNT(*) FROM ftd_users)
      ELSE 0 
    END as avg_net_per_ftd_user;
$function$;

-- Also update get_ftd_cohort_deposits with longer timeout
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_deposits(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_deposits numeric, ftd_user_count bigint, avg_per_ftd_user numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
  WITH ftd_users AS (
    SELECT DISTINCT 
      COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date
      AND event_time <= end_date
  ),
  deposit_sums AS (
    SELECT 
      COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total_dep
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date
      AND event_time <= end_date
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    (SELECT total_dep FROM deposit_sums) as total_deposits,
    (SELECT COUNT(*) FROM ftd_users) as ftd_user_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM ftd_users) > 0 
      THEN (SELECT total_dep FROM deposit_sums) / (SELECT COUNT(*) FROM ftd_users)
      ELSE 0 
    END as avg_per_ftd_user;
$function$;
