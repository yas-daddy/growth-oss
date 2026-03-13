-- Create RPC function for daily spend by channel
CREATE OR REPLACE FUNCTION public.get_report_daily_spend_by_channel(start_date date, end_date date)
RETURNS TABLE(date date, channel text, channel_type text, value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Ad platform spend by day
  SELECT 
    das.date,
    CASE 
      WHEN das.platform = 'meta' THEN 'Meta Ads'
      WHEN das.platform = 'apple' THEN 'Apple Search Ads'
      WHEN das.platform = 'moloco' THEN 'Moloco Ads'
      ELSE das.platform
    END as channel,
    'ad'::text as channel_type,
    SUM(das.spend) as value
  FROM daily_ad_spend das
  WHERE das.date >= start_date AND das.date <= end_date
  GROUP BY das.date, das.platform
  
  UNION ALL
  
  -- Affiliate spend by day
  SELECT 
    dafs.date,
    a.name as channel,
    'affiliate'::text as channel_type,
    SUM(dafs.spend) as value
  FROM daily_affiliate_spend dafs
  JOIN affiliates a ON a.id = dafs.affiliate_id
  WHERE dafs.date >= start_date AND dafs.date <= end_date
  GROUP BY dafs.date, a.name
  
  ORDER BY date, channel;
$function$;

-- Insert the report definition
INSERT INTO public.report_definitions (slug, name, description, report_type, category, data_source, config)
VALUES (
  'daily_spend_by_channel',
  'Daily Spend by Channel',
  'Daily spend breakdown by advertising channel and affiliates',
  'chart',
  'spend',
  'get_report_daily_spend_by_channel',
  '{"chartType": "stacked_bar", "valueFormat": "currency", "xAxisKey": "date", "stackKey": "channel"}'::jsonb
);