-- Fix CPA calculation to use FTDs from mixpanel_events
DROP FUNCTION IF EXISTS public.get_report_daily_spend_by_channel(date, date);

CREATE OR REPLACE FUNCTION public.get_report_daily_spend_by_channel(start_date date, end_date date)
RETURNS TABLE(report_date date, channel text, channel_type text, value numeric, daily_cpa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_ftds AS (
    -- Get daily FTD count from mixpanel
    SELECT 
      DATE(event_time) as ftd_date,
      COUNT(*)::numeric as ftd_count
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
    GROUP BY DATE(event_time)
  ),
  daily_totals AS (
    -- Get total spend per day
    SELECT 
      d.the_date,
      COALESCE(ad.total_spend, 0) + COALESCE(aff.total_spend, 0) as total_spend
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
      SELECT dafs2.date as the_date, SUM(dafs2.spend) as total_spend
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
      WHEN COALESCE(df.ftd_count, 0) > 0 THEN dt.total_spend / df.ftd_count
      ELSE NULL
    END as daily_cpa
  FROM daily_ad_spend das
  LEFT JOIN daily_totals dt ON dt.the_date = das.date
  LEFT JOIN daily_ftds df ON df.ftd_date = das.date
  WHERE das.date BETWEEN start_date AND end_date
  GROUP BY das.date, das.platform, dt.total_spend, df.ftd_count
  
  UNION ALL
  
  -- Affiliate spend by day
  SELECT 
    dafs.date as report_date,
    a.name as channel,
    'affiliate'::text as channel_type,
    SUM(dafs.spend) as value,
    CASE 
      WHEN COALESCE(df.ftd_count, 0) > 0 THEN dt.total_spend / df.ftd_count
      ELSE NULL
    END as daily_cpa
  FROM daily_affiliate_spend dafs
  JOIN affiliates a ON a.id = dafs.affiliate_id
  LEFT JOIN daily_totals dt ON dt.the_date = dafs.date
  LEFT JOIN daily_ftds df ON df.ftd_date = dafs.date
  WHERE dafs.date BETWEEN start_date AND end_date
  GROUP BY dafs.date, a.name, dt.total_spend, df.ftd_count
  
  ORDER BY report_date, channel;
END;
$$;