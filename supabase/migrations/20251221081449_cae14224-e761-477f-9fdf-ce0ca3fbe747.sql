-- Fix ambiguous column reference by using table alias and renaming return column
DROP FUNCTION IF EXISTS public.get_report_daily_spend_by_channel(date, date);

CREATE OR REPLACE FUNCTION public.get_report_daily_spend_by_channel(start_date date, end_date date)
RETURNS TABLE(report_date date, channel text, channel_type text, value numeric, daily_cpa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_totals AS (
    SELECT 
      d.the_date,
      COALESCE(ad.total_spend, 0) + COALESCE(aff.total_spend, 0) as total_spend,
      COALESCE(aff.total_ftds, 0) as total_ftds
    FROM (
      SELECT DISTINCT das.date as the_date FROM daily_ad_spend das WHERE das.date BETWEEN start_date AND end_date
      UNION
      SELECT DISTINCT dafs.date as the_date FROM daily_affiliate_spend dafs WHERE dafs.date BETWEEN start_date AND end_date
    ) d
    LEFT JOIN (
      SELECT das2.date as the_date, SUM(das2.spend) as total_spend 
      FROM daily_ad_spend das2 WHERE das2.date BETWEEN start_date AND end_date GROUP BY das2.date
    ) ad ON ad.the_date = d.the_date
    LEFT JOIN (
      SELECT dafs2.date as the_date, SUM(dafs2.spend) as total_spend, SUM(dafs2.ftds) as total_ftds 
      FROM daily_affiliate_spend dafs2 WHERE dafs2.date BETWEEN start_date AND end_date GROUP BY dafs2.date
    ) aff ON aff.the_date = d.the_date
  )
  -- Ad platform spend by day
  SELECT 
    das.date as report_date,
    CASE 
      WHEN das.platform = 'meta' THEN 'Meta Ads'
      WHEN das.platform = 'apple' THEN 'Apple Search Ads'
      WHEN das.platform = 'moloco' THEN 'Moloco Ads'
      ELSE das.platform
    END as channel,
    'ad'::text as channel_type,
    SUM(das.spend) as value,
    CASE 
      WHEN COALESCE(dt.total_ftds, 0) > 0 THEN dt.total_spend / dt.total_ftds
      ELSE NULL
    END as daily_cpa
  FROM daily_ad_spend das
  LEFT JOIN daily_totals dt ON dt.the_date = das.date
  WHERE das.date BETWEEN start_date AND end_date
  GROUP BY das.date, das.platform, dt.total_spend, dt.total_ftds
  
  UNION ALL
  
  -- Affiliate spend by day
  SELECT 
    dafs.date as report_date,
    a.name as channel,
    'affiliate'::text as channel_type,
    SUM(dafs.spend) as value,
    CASE 
      WHEN COALESCE(dt.total_ftds, 0) > 0 THEN dt.total_spend / dt.total_ftds
      ELSE NULL
    END as daily_cpa
  FROM daily_affiliate_spend dafs
  JOIN affiliates a ON a.id = dafs.affiliate_id
  LEFT JOIN daily_totals dt ON dt.the_date = dafs.date
  WHERE dafs.date BETWEEN start_date AND end_date
  GROUP BY dafs.date, a.name, dt.total_spend, dt.total_ftds
  
  ORDER BY report_date, channel;
END;
$$;