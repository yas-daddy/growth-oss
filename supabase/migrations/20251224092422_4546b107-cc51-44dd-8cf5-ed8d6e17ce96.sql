-- Optimize get_report_blended_roas with timeout safety
CREATE OR REPLACE FUNCTION public.get_report_blended_roas(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
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
    CASE WHEN (SELECT total FROM spend) > 0 
      THEN ((SELECT total FROM deposits) - (SELECT total FROM withdrawals)) / (SELECT total FROM spend)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Optimize get_report_payback_period with timeout safety
CREATE OR REPLACE FUNCTION public.get_report_payback_period(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
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
  ),
  net AS (
    SELECT (SELECT total FROM deposits) - (SELECT total FROM withdrawals) as total
  )
  SELECT 
    CASE WHEN (SELECT total FROM net) > 0 
      THEN ((SELECT total FROM spend) / (SELECT total FROM net)) * 30
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;