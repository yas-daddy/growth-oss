-- Drop the daily_metrics_cache table
DROP TABLE IF EXISTS public.daily_metrics_cache;

-- Drop the get_cached_metrics_for_range RPC function
DROP FUNCTION IF EXISTS public.get_cached_metrics_for_range(date, date);