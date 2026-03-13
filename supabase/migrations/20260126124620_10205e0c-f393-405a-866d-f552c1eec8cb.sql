-- Part 1: Restore critical indexes for COALESCE pattern
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_distinct_id 
  ON mixpanel_events(distinct_id);

CREATE INDEX IF NOT EXISTS idx_mixpanel_events_mixpanel_user_id 
  ON mixpanel_events(mixpanel_user_id);

-- Part 2: Update CVR functions to use pre-aggregated daily_funnel_metrics table

-- Update get_report_ftd_count to use daily_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_report_ftd_count(start_date date, end_date date)
 RETURNS TABLE(value bigint, previous_value bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(SUM(unique_ftds), 0)::bigint as value,
    0::bigint as previous_value
  FROM daily_funnel_metrics
  WHERE date >= start_date AND date <= end_date;
$function$;

-- Update get_report_blended_cpa to use daily_funnel_metrics
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
    SELECT COALESCE(SUM(unique_ftds), 0) as count
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftds) > 0 
      THEN ROUND((SELECT total FROM spend) / (SELECT count FROM ftds), 2)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Update get_report_cvr_install_signup to use daily_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_report_cvr_install_signup(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH installs AS (
    SELECT COALESCE(SUM(installs), 0) as total
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
  ),
  signups AS (
    SELECT COALESCE(SUM(unique_signups), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT total FROM installs) > 0 
      THEN ((SELECT total FROM signups)::numeric / (SELECT total FROM installs)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Update get_report_cvr_signup_ftd to use daily_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_report_cvr_signup_ftd(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH signups AS (
    SELECT COALESCE(SUM(unique_signups), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  ),
  ftds AS (
    SELECT COALESCE(SUM(unique_ftds), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT total FROM signups) > 0 
      THEN ((SELECT total FROM ftds)::numeric / (SELECT total FROM signups)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Update get_report_cvr_ftd_std to use daily_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_report_cvr_ftd_std(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ftds AS (
    SELECT COALESCE(SUM(unique_ftds), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  ),
  stds AS (
    SELECT COALESCE(SUM(unique_stds), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT total FROM ftds) > 0 
      THEN ((SELECT total FROM stds)::numeric / (SELECT total FROM ftds)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Update get_report_cvr_install_std to use daily_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_report_cvr_install_std(start_date date, end_date date)
 RETURNS TABLE(value numeric, previous_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH installs AS (
    SELECT COALESCE(SUM(installs), 0) as total
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
  ),
  stds AS (
    SELECT COALESCE(SUM(unique_stds), 0) as total
    FROM daily_funnel_metrics
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN (SELECT total FROM installs) > 0 
      THEN ((SELECT total FROM stds)::numeric / (SELECT total FROM installs)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Update populate_daily_funnel_metrics to be more efficient (day-by-day processing)
CREATE OR REPLACE FUNCTION public.populate_daily_funnel_metrics(start_dt date DEFAULT ((CURRENT_DATE - '7 days'::interval))::date, end_dt date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rows_affected integer := 0;
  current_date_val date := start_dt;
  v_signups bigint;
  v_ftds bigint;
  v_stds bigint;
BEGIN
  -- Process each day individually for better performance
  WHILE current_date_val <= end_dt LOOP
    -- Count unique signups for this day
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) INTO v_signups
    FROM mixpanel_events
    WHERE event_name = 'signup_completed'
      AND event_time >= current_date_val::timestamp
      AND event_time < (current_date_val + INTERVAL '1 day')::timestamp;
    
    -- Count unique FTDs for this day
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) INTO v_ftds
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= current_date_val::timestamp
      AND event_time < (current_date_val + INTERVAL '1 day')::timestamp;
    
    -- Count unique STDs for this day
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) INTO v_stds
    FROM mixpanel_events
    WHERE event_name = 'second_time_deposit'
      AND event_time >= current_date_val::timestamp
      AND event_time < (current_date_val + INTERVAL '1 day')::timestamp;
    
    -- Upsert the daily metrics
    INSERT INTO daily_funnel_metrics (date, unique_signups, unique_ftds, unique_stds, calculated_at)
    VALUES (current_date_val, v_signups, v_ftds, v_stds, now())
    ON CONFLICT (date) DO UPDATE SET
      unique_signups = EXCLUDED.unique_signups,
      unique_ftds = EXCLUDED.unique_ftds,
      unique_stds = EXCLUDED.unique_stds,
      calculated_at = EXCLUDED.calculated_at;
    
    rows_affected := rows_affected + 1;
    current_date_val := current_date_val + INTERVAL '1 day';
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rows_affected', rows_affected,
    'start_date', start_dt,
    'end_date', end_dt
  );
END;
$function$;