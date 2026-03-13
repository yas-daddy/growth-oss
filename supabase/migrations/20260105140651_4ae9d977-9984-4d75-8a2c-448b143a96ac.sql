-- Create RPC function for weekly CPA per channel chart
CREATE OR REPLACE FUNCTION public.get_report_cpa_per_channel_weekly(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH weekly_spend AS (
    SELECT 
      date_trunc('week', date::date)::date AS week_start,
      CASE 
        WHEN LOWER(platform) = 'meta' THEN 'Facebook Ads'
        WHEN LOWER(platform) = 'apple' THEN 'Apple Search Ads'
        WHEN LOWER(platform) = 'moloco' THEN 'Moloco'
        ELSE platform
      END AS channel,
      SUM(spend) AS spend
    FROM daily_ad_spend
    WHERE date >= p_start_date AND date <= p_end_date
    GROUP BY 1, 2
  ),
  weekly_ftds AS (
    SELECT 
      date_trunc('week', event_date::date)::date AS week_start,
      CASE 
        WHEN LOWER(media_source) = 'facebook ads' THEN 'Facebook Ads'
        WHEN LOWER(media_source) = 'apple search ads' THEN 'Apple Search Ads'
        WHEN LOWER(media_source) = 'moloco' THEN 'Moloco'
        WHEN LOWER(media_source) LIKE '%moloco%' THEN 'Moloco'
        ELSE media_source
      END AS channel,
      SUM(event_count) AS ftds
    FROM appsflyer_events
    WHERE event_name = 'first_time_deposit'
      AND event_date >= p_start_date AND event_date <= p_end_date
    GROUP BY 1, 2
  ),
  combined AS (
    SELECT 
      COALESCE(s.week_start, f.week_start) AS week_start,
      COALESCE(s.channel, f.channel) AS channel,
      COALESCE(s.spend, 0) AS spend,
      COALESCE(f.ftds, 0) AS ftds,
      CASE 
        WHEN COALESCE(f.ftds, 0) > 0 THEN COALESCE(s.spend, 0) / f.ftds
        ELSE NULL
      END AS cpa
    FROM weekly_spend s
    FULL OUTER JOIN weekly_ftds f ON s.week_start = f.week_start AND s.channel = f.channel
    WHERE COALESCE(s.spend, 0) > 0 OR COALESCE(f.ftds, 0) > 0
  )
  SELECT json_agg(
    json_build_object(
      'week_start', week_start,
      'channel', channel,
      'spend', spend,
      'ftds', ftds,
      'cpa', ROUND(cpa::numeric, 2)
    )
    ORDER BY week_start, channel
  )
  INTO result
  FROM combined
  WHERE cpa IS NOT NULL;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Insert report definition for CPA per channel weekly chart
INSERT INTO report_definitions (slug, name, description, category, report_type, data_source, config)
VALUES (
  'cpa_per_channel_weekly',
  'CPA per Channel (Weekly)',
  'Average CPA per ad channel over weeks',
  'acquisition',
  'chart',
  'get_report_cpa_per_channel_weekly',
  '{
    "chartType": "line_multi",
    "valueFormat": "currency",
    "xAxisKey": "week_start",
    "yAxisKey": "cpa",
    "seriesKey": "channel"
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  data_source = EXCLUDED.data_source,
  config = EXCLUDED.config,
  updated_at = now();