-- Drop and recreate with non-conflicting parameter names
DROP FUNCTION IF EXISTS public.get_report_avg_deposit_per_ftd_cached(date, date);

CREATE OR REPLACE FUNCTION public.get_report_avg_deposit_per_ftd_cached(p_start_date date, p_end_date date)
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
  IF p_end_date >= CURRENT_DATE THEN
    RETURN QUERY SELECT * FROM get_report_avg_deposit_per_ftd(p_start_date, p_end_date);
    RETURN;
  END IF;
  
  -- Check cache
  SELECT rmc.value INTO cached_value
  FROM range_metrics_cache rmc
  WHERE rmc.start_date = p_start_date
    AND rmc.end_date = p_end_date
    AND rmc.metric_name = 'avg_deposit_per_ftd';
  
  -- Cache hit
  IF FOUND THEN
    RETURN QUERY SELECT cached_value, 0::numeric;
    RETURN;
  END IF;
  
  -- Cache miss: calculate fresh
  SELECT v.value INTO calculated_value
  FROM get_report_avg_deposit_per_ftd(p_start_date, p_end_date) v;
  
  -- Store in cache
  INSERT INTO range_metrics_cache (start_date, end_date, metric_name, value)
  VALUES (p_start_date, p_end_date, 'avg_deposit_per_ftd', COALESCE(calculated_value, 0))
  ON CONFLICT (start_date, end_date, metric_name) 
  DO UPDATE SET value = COALESCE(calculated_value, 0), calculated_at = now();
  
  RETURN QUERY SELECT COALESCE(calculated_value, 0), 0::numeric;
END;
$$;