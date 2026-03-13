-- Create RPC function for top funnel data (Impressions -> Clicks -> Installs)
CREATE OR REPLACE FUNCTION public.get_report_top_funnel(start_date text, end_date text)
RETURNS TABLE (
  impressions bigint,
  clicks bigint,
  installs bigint,
  ctr numeric,
  install_rate numeric
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ad_metrics AS (
    SELECT 
      COALESCE(SUM(d.impressions), 0) AS total_impressions,
      COALESCE(SUM(d.clicks), 0) AS total_clicks,
      COALESCE(SUM(d.installs), 0) AS total_installs
    FROM daily_ad_spend d
    WHERE d.date >= start_date::date 
      AND d.date <= end_date::date
  )
  SELECT 
    am.total_impressions AS impressions,
    am.total_clicks AS clicks,
    am.total_installs AS installs,
    CASE 
      WHEN am.total_impressions > 0 THEN ROUND((am.total_clicks::numeric / am.total_impressions * 100), 2)
      ELSE 0
    END AS ctr,
    CASE 
      WHEN am.total_clicks > 0 THEN ROUND((am.total_installs::numeric / am.total_clicks * 100), 2)
      ELSE 0
    END AS install_rate
  FROM ad_metrics am;
END;
$$;

-- Insert report definition for Top Funnel
INSERT INTO report_definitions (slug, name, description, category, report_type, data_source, config)
VALUES (
  'top-funnel',
  'Top Funnel',
  'Impressions to clicks to installs with CTR and install rate',
  'funnel',
  'funnel',
  'get_report_top_funnel',
  '{"stages": ["impressions", "clicks", "installs"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  data_source = EXCLUDED.data_source,
  config = EXCLUDED.config,
  updated_at = now();