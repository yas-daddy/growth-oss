-- Drop the existing function first to allow changing return type
DROP FUNCTION IF EXISTS get_report_affiliate_performance(date, date);

-- Recreate with spend column
CREATE OR REPLACE FUNCTION get_report_affiliate_performance(start_date date, end_date date)
RETURNS TABLE(
  affiliate_id uuid,
  affiliate_name text,
  channel text,
  ftds bigint,
  spend numeric,
  revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH affiliate_ftds AS (
    SELECT 
      das.affiliate_id,
      SUM(das.ftds)::bigint as ftds,
      SUM(das.spend) as spend
    FROM daily_affiliate_spend das
    WHERE das.date >= start_date AND das.date <= end_date
    GROUP BY das.affiliate_id
  ),
  affiliate_revenue AS (
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
    COALESCE(f.ftds, 0)::bigint as ftds,
    COALESCE(f.spend, 0) as spend,
    COALESCE(r.revenue, 0) as revenue
  FROM affiliates a
  LEFT JOIN affiliate_ftds f ON a.id = f.affiliate_id
  LEFT JOIN affiliate_revenue r ON a.id = r.affiliate_id
  WHERE COALESCE(f.ftds, 0) > 0 OR a.status = 'active'
  ORDER BY COALESCE(f.ftds, 0) DESC;
END;
$$;

-- Update the report definition to include spend column
UPDATE report_definitions 
SET config = jsonb_build_object(
  'columns', jsonb_build_array(
    jsonb_build_object('key', 'affiliate_name', 'header', 'Affiliate', 'type', 'text'),
    jsonb_build_object('key', 'channel', 'header', 'Channel', 'type', 'text'),
    jsonb_build_object('key', 'ftds', 'header', 'FTDs', 'type', 'number'),
    jsonb_build_object('key', 'spend', 'header', 'Spend', 'type', 'currency'),
    jsonb_build_object('key', 'revenue', 'header', 'Revenue', 'type', 'currency'),
    jsonb_build_object('key', 'channel', 'header', 'Quality', 'type', 'qualityBadge')
  )
)
WHERE slug = 'affiliate-performance-table';