-- Drop and recreate the function to add CPA calculation
DROP FUNCTION IF EXISTS public.get_report_daily_spend_by_channel(date, date);

CREATE OR REPLACE FUNCTION public.get_report_daily_spend_by_channel(start_date date, end_date date)
RETURNS TABLE(date date, channel text, channel_type text, value numeric, daily_cpa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_totals RECORD;
BEGIN
  -- Create temp table with daily totals for CPA calculation
  CREATE TEMP TABLE temp_daily_totals AS
  SELECT 
    d.date as calc_date,
    COALESCE(ad.total_spend, 0) + COALESCE(aff.total_spend, 0) as total_spend,
    COALESCE(aff.total_ftds, 0) as total_ftds
  FROM (
    SELECT DISTINCT date FROM daily_ad_spend WHERE date BETWEEN start_date AND end_date
    UNION
    SELECT DISTINCT date FROM daily_affiliate_spend WHERE date BETWEEN start_date AND end_date
  ) d
  LEFT JOIN (
    SELECT date, SUM(spend) as total_spend FROM daily_ad_spend WHERE date BETWEEN start_date AND end_date GROUP BY date
  ) ad ON ad.date = d.date
  LEFT JOIN (
    SELECT date, SUM(spend) as total_spend, SUM(ftds) as total_ftds 
    FROM daily_affiliate_spend WHERE date BETWEEN start_date AND end_date GROUP BY date
  ) aff ON aff.date = d.date;

  -- Return ad spend by platform with CPA
  RETURN QUERY
  SELECT 
    das.date,
    das.platform as channel,
    'ad'::text as channel_type,
    SUM(das.spend) as value,
    CASE 
      WHEN COALESCE(t.total_ftds, 0) > 0 THEN t.total_spend / t.total_ftds
      ELSE NULL
    END as daily_cpa
  FROM daily_ad_spend das
  LEFT JOIN temp_daily_totals t ON t.calc_date = das.date
  WHERE das.date BETWEEN start_date AND end_date
  GROUP BY das.date, das.platform, t.total_spend, t.total_ftds
  
  UNION ALL
  
  -- Return affiliate spend with CPA
  SELECT 
    dafs.date,
    a.channel,
    'affiliate'::text as channel_type,
    SUM(dafs.spend) as value,
    CASE 
      WHEN COALESCE(t.total_ftds, 0) > 0 THEN t.total_spend / t.total_ftds
      ELSE NULL
    END as daily_cpa
  FROM daily_affiliate_spend dafs
  JOIN affiliates a ON a.id = dafs.affiliate_id
  LEFT JOIN temp_daily_totals t ON t.calc_date = dafs.date
  WHERE dafs.date BETWEEN start_date AND end_date
  GROUP BY dafs.date, a.channel, t.total_spend, t.total_ftds
  
  ORDER BY date, channel;

  DROP TABLE temp_daily_totals;
END;
$$;