
-- Update get_report_campaign_performance to map Apple campaign IDs and hide affiliates
CREATE OR REPLACE FUNCTION public.get_report_campaign_performance(start_date date, end_date date)
 RETURNS TABLE(campaign_name text, media_source text, spend numeric, installs bigint, signups bigint, ftds bigint, cpa numeric, revenue numeric, revenue_per_ftd numeric, avg_net_per_ftd numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Get affiliate channels to exclude
  WITH affiliate_channels AS (
    SELECT DISTINCT channel FROM affiliates
  ),
  -- Create Apple campaign ID to name mapping
  apple_campaign_map AS (
    SELECT DISTINCT campaign_id, campaign_name
    FROM apple_campaigns
  ),
  -- Normalize AppsFlyer install data - map Apple campaign IDs to names
  normalized_installs AS (
    SELECT 
      CASE 
        WHEN dai.media_source = 'Apple Search Ads' THEN COALESCE(acm.campaign_name, dai.campaign_name)
        ELSE dai.campaign_name
      END as campaign_name,
      dai.media_source,
      dai.installs,
      dai.date
    FROM daily_appsflyer_installs dai
    LEFT JOIN apple_campaign_map acm ON dai.media_source = 'Apple Search Ads' AND dai.campaign_name = acm.campaign_id
    WHERE dai.media_source NOT IN (SELECT channel FROM affiliate_channels)
  ),
  -- Normalize AppsFlyer events - map Apple campaign IDs to names
  normalized_events AS (
    SELECT 
      CASE 
        WHEN ae.media_source = 'Apple Search Ads' THEN COALESCE(acm.campaign_name, ae.campaign_name)
        ELSE ae.campaign_name
      END as campaign_name,
      ae.media_source,
      ae.event_name,
      ae.event_count,
      ae.event_revenue,
      ae.event_date
    FROM appsflyer_events ae
    LEFT JOIN apple_campaign_map acm ON ae.media_source = 'Apple Search Ads' AND ae.campaign_name = acm.campaign_id
    WHERE ae.media_source NOT IN (SELECT channel FROM affiliate_channels)
  ),
  campaign_spend AS (
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
    FROM normalized_installs
    WHERE date >= start_date AND date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_signups AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(event_count)::bigint as signups
    FROM normalized_events
    WHERE event_name = 'signup_completed'
      AND event_date >= start_date AND event_date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_ftds AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(event_count)::bigint as ftds
    FROM normalized_events
    WHERE event_name = 'first_time_deposit'
      AND event_date >= start_date AND event_date <= end_date
    GROUP BY campaign_name, media_source
  ),
  campaign_revenue AS (
    SELECT 
      campaign_name,
      media_source,
      SUM(COALESCE(event_revenue, 0)) as revenue
    FROM normalized_events
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
