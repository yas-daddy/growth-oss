-- Create the CPA excluding affiliates RPC function
CREATE OR REPLACE FUNCTION public.get_report_cpa_excl_affiliates(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ad_spend AS (
    SELECT COALESCE(SUM(spend), 0) as total
    FROM daily_ad_spend 
    WHERE date >= start_date AND date <= end_date
  ),
  mixpanel_ftds AS (
    SELECT COUNT(*) as count
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  affiliate_ftds AS (
    SELECT COALESCE(SUM(ftds), 0) as count
    FROM daily_affiliate_spend
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    CASE WHEN ((SELECT count FROM mixpanel_ftds) - (SELECT count FROM affiliate_ftds)) > 0 
      THEN (SELECT total FROM ad_spend) / ((SELECT count FROM mixpanel_ftds) - (SELECT count FROM affiliate_ftds))
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$function$;

-- Insert the report definition
INSERT INTO public.report_definitions (slug, name, description, report_type, category, data_source, config)
VALUES (
  'cpa_excl_affiliates',
  'CPA (excl. Affiliates)',
  'Cost per acquisition excluding affiliate spend and affiliate FTDs',
  'kpi',
  'acquisition',
  'get_report_cpa_excl_affiliates',
  '{"format": "currency_decimal", "invertColors": true}'::jsonb
);