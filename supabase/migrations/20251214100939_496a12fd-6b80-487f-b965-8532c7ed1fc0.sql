-- Update get_report_ftd_count to count events instead of unique users
CREATE OR REPLACE FUNCTION public.get_report_ftd_count(start_date date, end_date date)
 RETURNS TABLE(value bigint, previous_value bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COUNT(*)::bigint as value,
    0::bigint as previous_value
  FROM mixpanel_events
  WHERE event_name = 'first_time_deposit'
    AND event_time >= start_date::timestamp
    AND event_time < (end_date + 1)::timestamp;
$function$;

-- Update get_report_blended_cpa to count events instead of unique users
CREATE OR REPLACE FUNCTION public.get_report_blended_cpa(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftds AS (
    SELECT COUNT(*) as count
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftds) > 0 
      THEN (SELECT total FROM spend) / (SELECT count FROM ftds)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;