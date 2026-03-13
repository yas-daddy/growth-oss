-- Create RPC function: get_spend_by_channel (returns breakdown)
CREATE OR REPLACE FUNCTION public.get_report_spend_by_channel(start_date date, end_date date)
RETURNS TABLE(channel text, value numeric, channel_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ad_spend AS (
    SELECT 
      CASE 
        WHEN platform = 'meta' THEN 'Meta Ads'
        WHEN platform = 'apple' THEN 'Apple Search Ads'
        WHEN platform = 'moloco' THEN 'Moloco Ads'
        ELSE platform
      END as channel_name,
      SUM(spend) as spend
    FROM daily_ad_spend
    WHERE date >= start_date AND date <= end_date
    GROUP BY platform
  ),
  affiliate_spend AS (
    SELECT 
      a.name as channel_name,
      SUM(das.spend) as spend
    FROM daily_affiliate_spend das
    JOIN affiliates a ON a.id = das.affiliate_id
    WHERE das.date >= start_date AND das.date <= end_date
    GROUP BY a.name
  )
  SELECT channel_name as channel, spend as value, 'ad'::text as channel_type 
  FROM ad_spend WHERE spend > 0
  UNION ALL
  SELECT channel_name as channel, spend as value, 'affiliate'::text as channel_type 
  FROM affiliate_spend WHERE spend > 0
  ORDER BY value DESC;
$$;

-- Create RPC function: get_ftds_by_channel (returns breakdown from AppsFlyer events)
CREATE OR REPLACE FUNCTION public.get_report_ftds_by_channel(start_date date, end_date date)
RETURNS TABLE(channel text, value numeric, channel_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    media_source as channel,
    SUM(event_count)::numeric as value,
    CASE 
      WHEN media_source IN ('website', 'social_instagram', 'Organic', 'organic', 'none', '') THEN 'earned'
      ELSE 'ad'
    END as channel_type
  FROM appsflyer_events
  WHERE event_name = 'first_time_deposit'
    AND event_date >= start_date 
    AND event_date <= end_date
  GROUP BY media_source
  HAVING SUM(event_count) > 0
  ORDER BY value DESC;
$$;

-- Create RPC function: get_cpa_by_channel (spend / FTDs per channel)
CREATE OR REPLACE FUNCTION public.get_report_cpa_by_channel(start_date date, end_date date)
RETURNS TABLE(channel text, value numeric, channel_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ad_spend AS (
    SELECT 
      CASE 
        WHEN platform = 'meta' THEN 'Facebook Ads'
        WHEN platform = 'apple' THEN 'Apple Search Ads'
        WHEN platform = 'moloco' THEN 'moloco_int'
        ELSE platform
      END as channel_name,
      SUM(spend) as spend
    FROM daily_ad_spend
    WHERE date >= start_date AND date <= end_date
    GROUP BY platform
  ),
  ftd_counts AS (
    SELECT 
      media_source as channel_name,
      SUM(event_count) as ftds
    FROM appsflyer_events
    WHERE event_name = 'first_time_deposit'
      AND event_date >= start_date 
      AND event_date <= end_date
    GROUP BY media_source
  )
  SELECT 
    COALESCE(s.channel_name, f.channel_name) as channel,
    CASE 
      WHEN COALESCE(f.ftds, 0) > 0 THEN COALESCE(s.spend, 0) / f.ftds
      ELSE 0
    END as value,
    'ad'::text as channel_type
  FROM ad_spend s
  FULL OUTER JOIN ftd_counts f ON s.channel_name = f.channel_name
  WHERE COALESCE(s.spend, 0) > 0 OR COALESCE(f.ftds, 0) > 0
  ORDER BY value DESC;
$$;

-- Insert chart report definitions
INSERT INTO public.report_definitions (slug, name, description, category, report_type, config, data_source) VALUES
-- Acquisition chart reports
('spend_by_channel', 'Spend by Channel', 'Total spend breakdown across all ad platforms and affiliates', 'acquisition', 'chart',
  '{"chartType": "bar", "valueFormat": "currency", "showPercentage": true}'::jsonb, 'get_report_spend_by_channel'),
('ftds_by_channel', 'FTDs by Channel', 'First-time deposits by attributed channel', 'acquisition', 'chart',
  '{"chartType": "pie", "valueFormat": "number", "showPercentage": true}'::jsonb, 'get_report_ftds_by_channel'),
('cpa_by_channel', 'CPA by Channel', 'Cost per acquisition by channel', 'channels', 'chart',
  '{"chartType": "bar", "valueFormat": "currency_decimal", "showPercentage": false}'::jsonb, 'get_report_cpa_by_channel');