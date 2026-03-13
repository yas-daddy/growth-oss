-- Create daily_metrics_cache table for storing pre-calculated daily metrics
CREATE TABLE public.daily_metrics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  -- FTD cohort metrics
  ftd_count integer DEFAULT 0,
  ftd_cohort_deposits numeric DEFAULT 0,
  ftd_cohort_withdrawals numeric DEFAULT 0,
  ftd_cohort_net_deposits numeric DEFAULT 0,
  -- Spend metrics  
  total_ad_spend numeric DEFAULT 0,
  total_affiliate_spend numeric DEFAULT 0,
  total_spend numeric DEFAULT 0,
  -- Other metrics
  total_signups integer DEFAULT 0,
  total_stds integer DEFAULT 0,
  total_installs integer DEFAULT 0,
  -- Timestamps
  calculated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index on date for fast lookups
CREATE INDEX idx_daily_metrics_cache_date ON public.daily_metrics_cache(date);

-- Enable RLS
ALTER TABLE public.daily_metrics_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage daily metrics cache"
ON public.daily_metrics_cache
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view daily metrics cache"
ON public.daily_metrics_cache
FOR SELECT
USING (true);

-- Create RPC function to get cached metrics for a date range
CREATE OR REPLACE FUNCTION public.get_cached_metrics_for_range(start_date date, end_date date)
RETURNS TABLE(
  total_ftd_count bigint,
  total_ftd_cohort_deposits numeric,
  total_ftd_cohort_withdrawals numeric,
  total_ftd_cohort_net_deposits numeric,
  total_ad_spend numeric,
  total_affiliate_spend numeric,
  total_spend numeric,
  total_signups bigint,
  total_stds bigint,
  total_installs bigint,
  cached_days bigint,
  total_days bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH date_range AS (
    SELECT generate_series(start_date, end_date, '1 day'::interval)::date as dt
  ),
  cached_data AS (
    SELECT 
      COALESCE(SUM(ftd_count), 0) as ftd_count,
      COALESCE(SUM(ftd_cohort_deposits), 0) as ftd_cohort_deposits,
      COALESCE(SUM(ftd_cohort_withdrawals), 0) as ftd_cohort_withdrawals,
      COALESCE(SUM(ftd_cohort_net_deposits), 0) as ftd_cohort_net_deposits,
      COALESCE(SUM(c.total_ad_spend), 0) as ad_spend,
      COALESCE(SUM(c.total_affiliate_spend), 0) as affiliate_spend,
      COALESCE(SUM(c.total_spend), 0) as spend,
      COALESCE(SUM(c.total_signups), 0) as signups,
      COALESCE(SUM(c.total_stds), 0) as stds,
      COALESCE(SUM(c.total_installs), 0) as installs,
      COUNT(*) as cached_count
    FROM daily_metrics_cache c
    WHERE c.date >= start_date AND c.date <= end_date
  )
  SELECT 
    cd.ftd_count::bigint as total_ftd_count,
    cd.ftd_cohort_deposits as total_ftd_cohort_deposits,
    cd.ftd_cohort_withdrawals as total_ftd_cohort_withdrawals,
    cd.ftd_cohort_net_deposits as total_ftd_cohort_net_deposits,
    cd.ad_spend as total_ad_spend,
    cd.affiliate_spend as total_affiliate_spend,
    cd.spend as total_spend,
    cd.signups::bigint as total_signups,
    cd.stds::bigint as total_stds,
    cd.installs::bigint as total_installs,
    cd.cached_count as cached_days,
    (SELECT COUNT(*) FROM date_range) as total_days
  FROM cached_data cd;
$$;