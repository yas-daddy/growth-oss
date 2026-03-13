-- RPC function for Channel Performance table
CREATE OR REPLACE FUNCTION public.get_report_channel_performance(start_date date, end_date date)
RETURNS TABLE(
  channel text,
  channel_type text,
  spend numeric,
  ftds bigint,
  cpa numeric,
  revenue numeric,
  roi numeric
)
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
  affiliate_spend AS (
    SELECT 
      a.name as channel_name,
      SUM(das.spend) as spend
    FROM daily_affiliate_spend das
    JOIN affiliates a ON a.id = das.affiliate_id
    WHERE das.date >= start_date AND das.date <= end_date
    GROUP BY a.name
  ),
  ftd_counts AS (
    SELECT 
      media_source as channel_name,
      SUM(event_count)::bigint as ftds
    FROM appsflyer_events
    WHERE event_name = 'first_time_deposit'
      AND event_date >= start_date 
      AND event_date <= end_date
    GROUP BY media_source
  ),
  revenue_data AS (
    SELECT 
      media_source as channel_name,
      SUM(COALESCE(event_revenue, 0)) as revenue
    FROM appsflyer_events
    WHERE event_name = 'net_revenue'
      AND event_date >= start_date 
      AND event_date <= end_date
    GROUP BY media_source
  ),
  all_channels AS (
    -- Ad platforms
    SELECT 
      s.channel_name as channel,
      'ad'::text as channel_type,
      s.spend,
      COALESCE(f.ftds, 0) as ftds,
      COALESCE(r.revenue, 0) as revenue
    FROM ad_spend s
    LEFT JOIN ftd_counts f ON s.channel_name = f.channel_name
    LEFT JOIN revenue_data r ON s.channel_name = r.channel_name
    
    UNION ALL
    
    -- Affiliates
    SELECT 
      s.channel_name as channel,
      'affiliate'::text as channel_type,
      s.spend,
      COALESCE(f.ftds, 0) as ftds,
      COALESCE(r.revenue, 0) as revenue
    FROM affiliate_spend s
    LEFT JOIN ftd_counts f ON s.channel_name = f.channel_name
    LEFT JOIN revenue_data r ON s.channel_name = r.channel_name
    
    UNION ALL
    
    -- Earned media (channels with FTDs but no spend)
    SELECT 
      f.channel_name as channel,
      'earned'::text as channel_type,
      0 as spend,
      f.ftds,
      COALESCE(r.revenue, 0) as revenue
    FROM ftd_counts f
    LEFT JOIN revenue_data r ON f.channel_name = r.channel_name
    WHERE f.channel_name NOT IN (SELECT channel_name FROM ad_spend)
      AND f.channel_name NOT IN (SELECT channel_name FROM affiliate_spend)
      AND f.channel_name IN ('website', 'social_instagram', 'Organic', 'organic', 'none', '')
  )
  SELECT 
    channel,
    channel_type,
    spend,
    ftds,
    CASE WHEN ftds > 0 THEN spend / ftds ELSE 0 END as cpa,
    revenue,
    CASE WHEN spend > 0 THEN ((revenue - spend) / spend) * 100 ELSE 0 END as roi
  FROM all_channels
  WHERE spend > 0 OR ftds > 0
  ORDER BY spend DESC;
$$;

-- RPC function for Affiliate Performance table
CREATE OR REPLACE FUNCTION public.get_report_affiliate_performance(start_date date, end_date date)
RETURNS TABLE(
  affiliate_id uuid,
  affiliate_name text,
  channel text,
  ftds bigint,
  revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH affiliate_ftds AS (
    SELECT 
      das.affiliate_id,
      SUM(das.ftds)::bigint as ftds
    FROM daily_affiliate_spend das
    WHERE das.date >= start_date AND das.date <= end_date
    GROUP BY das.affiliate_id
  ),
  affiliate_revenue AS (
    -- Get revenue from AppsFlyer events for affiliate channels
    SELECT 
      a.id as affiliate_id,
      SUM(COALESCE(ae.event_revenue, 0)) as revenue
    FROM affiliates a
    LEFT JOIN appsflyer_events ae ON ae.media_source = a.channel
      AND ae.event_name = 'net_revenue'
      AND ae.event_date >= start_date 
      AND ae.event_date <= end_date
    GROUP BY a.id
  )
  SELECT 
    a.id as affiliate_id,
    a.name as affiliate_name,
    a.channel,
    COALESCE(f.ftds, 0) as ftds,
    COALESCE(r.revenue, 0) as revenue
  FROM affiliates a
  LEFT JOIN affiliate_ftds f ON a.id = f.affiliate_id
  LEFT JOIN affiliate_revenue r ON a.id = r.affiliate_id
  WHERE COALESCE(f.ftds, 0) > 0 OR a.status = 'active'
  ORDER BY COALESCE(f.ftds, 0) DESC;
$$;