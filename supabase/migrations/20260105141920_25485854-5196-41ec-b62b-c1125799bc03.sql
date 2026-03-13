CREATE OR REPLACE FUNCTION public.get_report_cpa_per_channel_weekly(p_start_date text, p_end_date text)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH weekly_spend AS (
    SELECT 
      date_trunc('week', date::date)::date AS week_start,
      CASE 
        WHEN platform = 'meta' THEN 'Meta Ads'
        WHEN platform = 'apple' THEN 'Apple Search Ads'
        WHEN platform = 'moloco' THEN 'Moloco Ads'
        ELSE platform
      END AS channel,
      SUM(spend) AS spend
    FROM daily_ad_spend
    WHERE date >= p_start_date::date 
      AND date <= p_end_date::date
      AND platform IN ('meta', 'apple', 'moloco')
    GROUP BY 1, 2
  ),
  weekly_ftds AS (
    SELECT 
      date_trunc('week', event_date::date)::date AS week_start,
      CASE 
        WHEN media_source = 'Facebook Ads' THEN 'Meta Ads'
        WHEN media_source = 'Apple Search Ads' THEN 'Apple Search Ads'
        WHEN media_source = 'moloco_int' THEN 'Moloco Ads'
        ELSE media_source
      END AS channel,
      SUM(event_count) AS ftds
    FROM appsflyer_events
    WHERE event_date >= p_start_date::date 
      AND event_date <= p_end_date::date
      AND event_name = 'first_time_deposit'
      AND media_source IN ('Facebook Ads', 'Apple Search Ads', 'moloco_int')
    GROUP BY 1, 2
  )
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT 
      s.week_start,
      s.channel,
      s.spend,
      COALESCE(f.ftds, 0) AS ftds,
      CASE 
        WHEN COALESCE(f.ftds, 0) > 0 THEN ROUND((s.spend / f.ftds)::numeric, 2)
        ELSE NULL
      END AS cpa
    FROM weekly_spend s
    LEFT JOIN weekly_ftds f ON s.week_start = f.week_start AND s.channel = f.channel
    WHERE s.spend > 0
    ORDER BY s.week_start, s.channel
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;