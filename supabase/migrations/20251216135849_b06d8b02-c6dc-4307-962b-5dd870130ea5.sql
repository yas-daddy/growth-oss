
-- Create RPC function for campaign performance report
CREATE OR REPLACE FUNCTION public.get_report_campaign_performance(start_date date, end_date date)
RETURNS TABLE(
  campaign_name text,
  media_source text,
  spend numeric,
  installs bigint,
  signups bigint,
  ftds bigint,
  cpa numeric,
  revenue numeric,
  revenue_per_ftd numeric,
  avg_net_per_ftd numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH campaign_spend AS (
    SELECT 
      campaign_name,
      CASE 
        WHEN platform = 'meta' THEN 'Facebook Ads'
        WHEN platform = 'apple' THEN 'Apple Search Ads'
        WHEN platform = 'moloco' THEN 'moloco_int'
        ELSE platform
      END as media_source,
      SUM(spend) as spend
    FROM daily_ad_spend
    WHERE date >= start_date AND date <= end_date
    GROUP BY campaign_name, platform
  ),
  campaign_installs AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(installs)::bigint as installs
    FROM daily_appsflyer_installs
    WHERE date >= start_date AND date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_signups AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(event_count)::bigint as signups
    FROM appsflyer_events
    WHERE event_name = 'signup_completed'
      AND event_date >= start_date AND event_date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_ftds AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(event_count)::bigint as ftds
    FROM appsflyer_events
    WHERE event_name = 'first_time_deposit'
      AND event_date >= start_date AND event_date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_revenue AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(COALESCE(event_revenue, 0)) as revenue
    FROM appsflyer_events
    WHERE event_name = 'net_revenue'
      AND event_date >= start_date AND event_date <= end_date
    GROUP BY campaign_name, media_source
  ),
  all_campaigns AS (
    SELECT DISTINCT campaign_name, media_source FROM campaign_installs
    UNION
    SELECT DISTINCT campaign_name, media_source FROM campaign_ftds
    UNION
    SELECT DISTINCT campaign_name, media_source FROM campaign_spend
  )
  SELECT 
    ac.campaign_name,
    ac.media_source,
    COALESCE(cs.spend, 0) as spend,
    COALESCE(ci.installs, 0) as installs,
    COALESCE(csg.signups, 0) as signups,
    COALESCE(cf.ftds, 0) as ftds,
    CASE WHEN COALESCE(cf.ftds, 0) > 0 THEN COALESCE(cs.spend, 0) / cf.ftds ELSE 0 END as cpa,
    COALESCE(cr.revenue, 0) as revenue,
    CASE WHEN COALESCE(cf.ftds, 0) > 0 THEN COALESCE(cr.revenue, 0) / cf.ftds ELSE 0 END as revenue_per_ftd,
    CASE WHEN COALESCE(cf.ftds, 0) > 0 THEN COALESCE(cr.revenue, 0) / cf.ftds ELSE 0 END as avg_net_per_ftd
  FROM all_campaigns ac
  LEFT JOIN campaign_spend cs ON ac.campaign_name = cs.campaign_name AND ac.media_source = cs.media_source
  LEFT JOIN campaign_installs ci ON ac.campaign_name = ci.campaign_name AND ac.media_source = ci.media_source
  LEFT JOIN campaign_signups csg ON ac.campaign_name = csg.campaign_name AND ac.media_source = csg.media_source
  LEFT JOIN campaign_ftds cf ON ac.campaign_name = cf.campaign_name AND ac.media_source = cf.media_source
  LEFT JOIN campaign_revenue cr ON ac.campaign_name = cr.campaign_name AND ac.media_source = cr.media_source
  WHERE COALESCE(cf.ftds, 0) > 0 OR COALESCE(cs.spend, 0) > 0
  ORDER BY COALESCE(cs.spend, 0) DESC;
$function$;

-- Insert the report definition
INSERT INTO report_definitions (slug, name, category, report_type, data_source, config, description)
VALUES (
  'campaign-performance',
  'Campaign Performance',
  'channels',
  'table',
  'get_report_campaign_performance',
  '{
    "columns": [
      {"key": "campaign_name", "label": "Campaign", "type": "text"},
      {"key": "media_source", "label": "Channel", "type": "badge"},
      {"key": "spend", "label": "Spend", "type": "currency"},
      {"key": "installs", "label": "Installs", "type": "number"},
      {"key": "signups", "label": "Signups", "type": "number"},
      {"key": "ftds", "label": "FTDs", "type": "number"},
      {"key": "cpa", "label": "CPA", "type": "currency"},
      {"key": "revenue", "label": "Revenue", "type": "currency"},
      {"key": "revenue_per_ftd", "label": "Rev/FTD", "type": "currency"},
      {"key": "avg_net_per_ftd", "label": "Quality", "type": "qualityBadge"}
    ]
  }'::jsonb,
  'Campaign-level performance metrics with spend, installs, signups, FTDs, CPA, revenue, and quality ranking'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  data_source = EXCLUDED.data_source,
  description = EXCLUDED.description;
