-- Create base function for avg deposit per FTD (deposits only, not net)
CREATE OR REPLACE FUNCTION public.get_report_avg_deposit_per_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftd_count) > 0 
      THEN (SELECT total FROM deposits) / (SELECT count FROM ftd_count)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- Create cached version using range_metrics_cache
CREATE OR REPLACE FUNCTION public.get_report_avg_deposit_per_ftd_cached(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cached_value numeric;
  calculated_value numeric;
BEGIN
  -- If end_date includes today or future, calculate fresh (no caching)
  IF end_date >= CURRENT_DATE THEN
    RETURN QUERY SELECT * FROM get_report_avg_deposit_per_ftd(start_date, end_date);
    RETURN;
  END IF;
  
  -- Check cache
  SELECT rmc.value INTO cached_value
  FROM range_metrics_cache rmc
  WHERE rmc.start_date = get_report_avg_deposit_per_ftd_cached.start_date
    AND rmc.end_date = get_report_avg_deposit_per_ftd_cached.end_date
    AND rmc.metric_name = 'avg_deposit_per_ftd';
  
  -- Cache hit
  IF FOUND THEN
    RETURN QUERY SELECT cached_value, 0::numeric;
    RETURN;
  END IF;
  
  -- Cache miss: calculate fresh
  SELECT v.value INTO calculated_value
  FROM get_report_avg_deposit_per_ftd(start_date, end_date) v;
  
  -- Store in cache
  INSERT INTO range_metrics_cache (start_date, end_date, metric_name, value)
  VALUES (start_date, end_date, 'avg_deposit_per_ftd', COALESCE(calculated_value, 0))
  ON CONFLICT (start_date, end_date, metric_name) 
  DO UPDATE SET value = COALESCE(calculated_value, 0), calculated_at = now();
  
  RETURN QUERY SELECT COALESCE(calculated_value, 0), 0::numeric;
END;
$$;

-- Insert report definition
INSERT INTO public.report_definitions (slug, name, description, category, report_type, data_source, config)
VALUES (
  'avg-deposit-per-ftd',
  'Avg Deposit per FTD',
  'Average total deposits per FTD cohort user within the selected period',
  'revenue',
  'kpi',
  'get_report_avg_deposit_per_ftd_cached',
  '{"format": "currency", "prefix": "£"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  data_source = EXCLUDED.data_source,
  config = EXCLUDED.config;