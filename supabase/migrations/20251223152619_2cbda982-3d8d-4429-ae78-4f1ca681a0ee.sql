-- Optimize get_report_ftd_cohort_deposits with timeout safety
CREATE OR REPLACE FUNCTION public.get_report_ftd_cohort_deposits(start_date date, end_date date)
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
  )
  SELECT 
    COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as value,
    0::numeric as previous_value
  FROM mixpanel_events
  WHERE event_name = 'deposit_success'
    AND event_time >= start_date::timestamp
    AND event_time < (end_date + 1)::timestamp
    AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users);
$function$;