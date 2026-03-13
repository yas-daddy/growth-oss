-- Optimize get_report_avg_net_per_ftd with timeout safety
CREATE OR REPLACE FUNCTION public.get_report_avg_net_per_ftd(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  ftd_count AS (
    SELECT COUNT(*) as count FROM ftd_users
  ),
  deposits AS (
    SELECT COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawals AS (
    SELECT COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'withdrawal_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftd_count) > 0 
      THEN ((SELECT total FROM deposits) - (SELECT total FROM withdrawals)) / (SELECT count FROM ftd_count)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;