-- RPC function for Affiliate Total FTDs
CREATE OR REPLACE FUNCTION public.get_report_affiliate_ftds(start_date date, end_date date)
RETURNS TABLE(value bigint, previous_value bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(ftds), 0)::bigint as value,
    0::bigint as previous_value
  FROM daily_affiliate_spend
  WHERE date >= start_date AND date <= end_date;
$$;

-- RPC function for Affiliate Total Spend
CREATE OR REPLACE FUNCTION public.get_report_affiliate_spend(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(spend), 0) as value,
    0::numeric as previous_value
  FROM daily_affiliate_spend
  WHERE date >= start_date AND date <= end_date;
$$;

-- RPC function for Active Affiliate Count
CREATE OR REPLACE FUNCTION public.get_report_affiliate_count(start_date date, end_date date)
RETURNS TABLE(value bigint, previous_value bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(DISTINCT affiliate_id)::bigint as value,
    0::bigint as previous_value
  FROM daily_affiliate_spend
  WHERE date >= start_date AND date <= end_date;
$$;