-- Create RPC function for HVP count
CREATE OR REPLACE FUNCTION public.get_report_hvp_count(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
  WITH ftd_users AS (
    -- Get all users with FTD events in the selected date range
    SELECT 
      COALESCE(mixpanel_user_id, distinct_id) as user_id,
      MIN(event_time) as ftd_time
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
    GROUP BY COALESCE(mixpanel_user_id, distinct_id)
  ),
  user_deposits AS (
    -- Sum deposits for each FTD user within 7 days of their FTD
    SELECT 
      f.user_id,
      COALESCE(SUM((d.properties->>'deposit_amount')::numeric), 0) as total_deposits
    FROM ftd_users f
    LEFT JOIN mixpanel_events d ON 
      COALESCE(d.mixpanel_user_id, d.distinct_id) = f.user_id
      AND d.event_name = 'deposit_success'
      AND d.event_time >= f.ftd_time
      AND d.event_time < f.ftd_time + INTERVAL '7 days'
    GROUP BY f.user_id
  )
  SELECT 
    COUNT(CASE WHEN total_deposits > 250 THEN 1 END)::numeric as value,
    0::numeric as previous_value
  FROM user_deposits;
$$;

-- Add report definition
INSERT INTO report_definitions (slug, name, description, category, report_type, config, data_source)
VALUES (
  'hvp-count',
  'HVP Count',
  'Number of High Value Players (£250+ deposits in first 7 days after FTD)',
  'revenue',
  'kpi',
  '{"format": "number", "icon": "Crown", "variant": "accent", "subtitle": "Deposits >£250 in first 7 days"}'::jsonb,
  'get_report_hvp_count'
);