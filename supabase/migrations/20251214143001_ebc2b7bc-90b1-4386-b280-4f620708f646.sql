-- Create range_metrics_cache table for cohort-based metrics
CREATE TABLE public.range_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(start_date, end_date, metric_name)
);

-- Index for fast lookups
CREATE INDEX idx_range_metrics_lookup ON public.range_metrics_cache(start_date, end_date, metric_name);

-- RLS policies
ALTER TABLE public.range_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage range metrics cache"
  ON public.range_metrics_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view range metrics cache"
  ON public.range_metrics_cache FOR SELECT
  USING (true);

-- Cached wrapper for FTD Cohort Deposits
CREATE OR REPLACE FUNCTION public.get_report_ftd_cohort_deposits_cached(start_date date, end_date date)
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
    RETURN QUERY SELECT * FROM get_report_ftd_cohort_deposits(start_date, end_date);
    RETURN;
  END IF;
  
  -- Check cache
  SELECT rmc.value INTO cached_value
  FROM range_metrics_cache rmc
  WHERE rmc.start_date = get_report_ftd_cohort_deposits_cached.start_date
    AND rmc.end_date = get_report_ftd_cohort_deposits_cached.end_date
    AND rmc.metric_name = 'ftd_cohort_deposits';
  
  -- Cache hit
  IF FOUND THEN
    RETURN QUERY SELECT cached_value, 0::numeric;
    RETURN;
  END IF;
  
  -- Cache miss: calculate fresh
  SELECT v.value INTO calculated_value
  FROM get_report_ftd_cohort_deposits(start_date, end_date) v;
  
  -- Store in cache
  INSERT INTO range_metrics_cache (start_date, end_date, metric_name, value)
  VALUES (start_date, end_date, 'ftd_cohort_deposits', COALESCE(calculated_value, 0))
  ON CONFLICT (start_date, end_date, metric_name) 
  DO UPDATE SET value = COALESCE(calculated_value, 0), calculated_at = now();
  
  RETURN QUERY SELECT COALESCE(calculated_value, 0), 0::numeric;
END;
$$;

-- Cached wrapper for New Users Net Deposits
CREATE OR REPLACE FUNCTION public.get_report_new_users_net_deposits_cached(start_date date, end_date date)
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
    RETURN QUERY SELECT * FROM get_report_new_users_net_deposits(start_date, end_date);
    RETURN;
  END IF;
  
  -- Check cache
  SELECT rmc.value INTO cached_value
  FROM range_metrics_cache rmc
  WHERE rmc.start_date = get_report_new_users_net_deposits_cached.start_date
    AND rmc.end_date = get_report_new_users_net_deposits_cached.end_date
    AND rmc.metric_name = 'new_users_net_deposits';
  
  -- Cache hit
  IF FOUND THEN
    RETURN QUERY SELECT cached_value, 0::numeric;
    RETURN;
  END IF;
  
  -- Cache miss: calculate fresh
  SELECT v.value INTO calculated_value
  FROM get_report_new_users_net_deposits(start_date, end_date) v;
  
  -- Store in cache
  INSERT INTO range_metrics_cache (start_date, end_date, metric_name, value)
  VALUES (start_date, end_date, 'new_users_net_deposits', COALESCE(calculated_value, 0))
  ON CONFLICT (start_date, end_date, metric_name) 
  DO UPDATE SET value = COALESCE(calculated_value, 0), calculated_at = now();
  
  RETURN QUERY SELECT COALESCE(calculated_value, 0), 0::numeric;
END;
$$;

-- Cached wrapper for Avg Net Per FTD
CREATE OR REPLACE FUNCTION public.get_report_avg_net_per_ftd_cached(start_date date, end_date date)
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
    RETURN QUERY SELECT * FROM get_report_avg_net_per_ftd(start_date, end_date);
    RETURN;
  END IF;
  
  -- Check cache
  SELECT rmc.value INTO cached_value
  FROM range_metrics_cache rmc
  WHERE rmc.start_date = get_report_avg_net_per_ftd_cached.start_date
    AND rmc.end_date = get_report_avg_net_per_ftd_cached.end_date
    AND rmc.metric_name = 'avg_net_per_ftd';
  
  -- Cache hit
  IF FOUND THEN
    RETURN QUERY SELECT cached_value, 0::numeric;
    RETURN;
  END IF;
  
  -- Cache miss: calculate fresh
  SELECT v.value INTO calculated_value
  FROM get_report_avg_net_per_ftd(start_date, end_date) v;
  
  -- Store in cache
  INSERT INTO range_metrics_cache (start_date, end_date, metric_name, value)
  VALUES (start_date, end_date, 'avg_net_per_ftd', COALESCE(calculated_value, 0))
  ON CONFLICT (start_date, end_date, metric_name) 
  DO UPDATE SET value = COALESCE(calculated_value, 0), calculated_at = now();
  
  RETURN QUERY SELECT COALESCE(calculated_value, 0), 0::numeric;
END;
$$;

-- Update report definitions to use cached functions
UPDATE public.report_definitions 
SET data_source = 'get_report_ftd_cohort_deposits_cached'
WHERE slug = 'ftd-cohort-deposits';

UPDATE public.report_definitions 
SET data_source = 'get_report_new_users_net_deposits_cached'
WHERE slug = 'new-users-net-deposits';

UPDATE public.report_definitions 
SET data_source = 'get_report_avg_net_per_ftd_cached'
WHERE slug = 'avg-net-per-ftd';