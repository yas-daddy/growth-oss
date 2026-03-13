
CREATE OR REPLACE FUNCTION public.get_daily_channel_cpa(p_start_date date, p_end_date date, p_channel text)
RETURNS TABLE(date date, cpa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  safe_end_date date;
BEGIN
  -- Exclude the most recent 2 days to avoid misleading CPA spikes
  -- from incomplete AppsFlyer attribution data (4-24h+ latency)
  safe_end_date := LEAST(p_end_date, CURRENT_DATE - 2);
  
  IF safe_end_date < p_start_date THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH channel_spend AS (
    SELECT 
      das.date AS spend_date,
      SUM(das.spend) AS spend
    FROM daily_ad_spend das
    WHERE das.date >= p_start_date 
      AND das.date <= safe_end_date
      AND das.platform = CASE 
        WHEN p_channel = 'Meta Ads' THEN 'meta'
        WHEN p_channel = 'Apple Search Ads' THEN 'apple'
        WHEN p_channel = 'Moloco Ads' THEN 'moloco'
        ELSE p_channel
      END
    GROUP BY das.date
  ),
  channel_ftds AS (
    SELECT 
      ae.event_date::date AS ftd_date,
      SUM(ae.event_count) AS ftds
    FROM appsflyer_events ae
    WHERE ae.event_name = 'first_time_deposit'
      AND ae.event_date >= p_start_date
      AND ae.event_date <= safe_end_date
      AND ae.media_source = CASE
        WHEN p_channel = 'Meta Ads' THEN 'Facebook Ads'
        WHEN p_channel = 'Apple Search Ads' THEN 'Apple Search Ads'
        WHEN p_channel = 'Moloco Ads' THEN 'moloco_int'
        ELSE p_channel
      END
    GROUP BY ae.event_date::date
  )
  SELECT 
    s.spend_date AS date,
    CASE 
      WHEN COALESCE(f.ftds, 0) > 0 THEN ROUND((s.spend / f.ftds)::numeric, 2)
      ELSE NULL
    END AS cpa
  FROM channel_spend s
  LEFT JOIN channel_ftds f ON s.spend_date = f.ftd_date
  WHERE s.spend > 0
  ORDER BY s.spend_date;
END;
$$;
