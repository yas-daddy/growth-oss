-- Recreate the FTD cohort deposits function with a higher statement timeout
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_deposits(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_deposits numeric, ftd_user_count bigint, avg_per_ftd_user numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
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
$function$;

-- Recreate the FTD cohort net deposits function with a higher statement timeout
CREATE OR REPLACE FUNCTION public.get_ftd_cohort_net_deposits(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_deposits numeric, total_withdrawals numeric, net_deposits numeric, ftd_user_count bigint, avg_net_per_ftd_user numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
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
    FROM mixpanel_events d
    WHERE d.event_name = 'deposit_success'
      AND d.event_time >= start_date
      AND d.event_time <= end_date
      AND COALESCE(d.mixpanel_user_id, d.distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawal_sums AS (
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