-- RPC function for funnel data
CREATE OR REPLACE FUNCTION public.get_report_funnel_data(start_date date, end_date date)
RETURNS TABLE(installs bigint, signups bigint, ftds bigint, stds bigint, install_to_signup numeric, signup_to_ftd numeric, ftd_to_std numeric, install_to_std numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH install_data AS (
    SELECT COALESCE(SUM(installs), 0)::bigint as total
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
  ),
  signup_data AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))::bigint as total
    FROM mixpanel_events
    WHERE event_name = 'signup_completed'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  ftd_data AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))::bigint as total
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  std_data AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))::bigint as total
    FROM mixpanel_events
    WHERE event_name = 'second_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    (SELECT total FROM install_data) as installs,
    (SELECT total FROM signup_data) as signups,
    (SELECT total FROM ftd_data) as ftds,
    (SELECT total FROM std_data) as stds,
    CASE WHEN (SELECT total FROM install_data) > 0 
      THEN ((SELECT total FROM signup_data)::numeric / (SELECT total FROM install_data)) * 100
      ELSE 0 
    END as install_to_signup,
    CASE WHEN (SELECT total FROM signup_data) > 0 
      THEN ((SELECT total FROM ftd_data)::numeric / (SELECT total FROM signup_data)) * 100
      ELSE 0 
    END as signup_to_ftd,
    CASE WHEN (SELECT total FROM ftd_data) > 0 
      THEN ((SELECT total FROM std_data)::numeric / (SELECT total FROM ftd_data)) * 100
      ELSE 0 
    END as ftd_to_std,
    CASE WHEN (SELECT total FROM install_data) > 0 
      THEN ((SELECT total FROM std_data)::numeric / (SELECT total FROM install_data)) * 100
      ELSE 0 
    END as install_to_std;
$$;

-- RPC for Install to Signup CVR KPI
CREATE OR REPLACE FUNCTION public.get_report_cvr_install_signup(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH installs AS (
    SELECT COALESCE(SUM(installs), 0) as total
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
  ),
  signups AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'signup_completed'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT total FROM installs) > 0 
      THEN ((SELECT total FROM signups)::numeric / (SELECT total FROM installs)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- RPC for Signup to FTD CVR KPI
CREATE OR REPLACE FUNCTION public.get_report_cvr_signup_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH signups AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'signup_completed'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  ftds AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT total FROM signups) > 0 
      THEN ((SELECT total FROM ftds)::numeric / (SELECT total FROM signups)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- RPC for FTD to STD CVR KPI
CREATE OR REPLACE FUNCTION public.get_report_cvr_ftd_std(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ftds AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  stds AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'second_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT total FROM ftds) > 0 
      THEN ((SELECT total FROM stds)::numeric / (SELECT total FROM ftds)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- RPC for Install to STD CVR KPI
CREATE OR REPLACE FUNCTION public.get_report_cvr_install_std(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH installs AS (
    SELECT COALESCE(SUM(installs), 0) as total
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
  ),
  stds AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as total
    FROM mixpanel_events
    WHERE event_name = 'second_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT total FROM installs) > 0 
      THEN ((SELECT total FROM stds)::numeric / (SELECT total FROM installs)) * 100
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;