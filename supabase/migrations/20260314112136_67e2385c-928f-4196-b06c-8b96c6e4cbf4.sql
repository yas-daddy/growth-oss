-- Add org_id to report_definitions
ALTER TABLE public.report_definitions 
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add org_id to dashboard_configs
ALTER TABLE public.dashboard_configs 
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add unique constraint for org-scoped slugs
ALTER TABLE public.report_definitions 
  ADD CONSTRAINT report_definitions_org_slug_unique UNIQUE (org_id, slug);

ALTER TABLE public.dashboard_configs 
  ADD CONSTRAINT dashboard_configs_org_slug_unique UNIQUE (org_id, dashboard_slug);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Admins can manage report definitions" ON public.report_definitions;
DROP POLICY IF EXISTS "Anyone can view report definitions" ON public.report_definitions;
DROP POLICY IF EXISTS "Admins can manage dashboard configs" ON public.dashboard_configs;
DROP POLICY IF EXISTS "Anyone can view dashboard configs" ON public.dashboard_configs;

-- New org-scoped RLS policies for report_definitions
CREATE POLICY "Org admins can manage report definitions"
  ON public.report_definitions FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org members can view report definitions"
  ON public.report_definitions FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- New org-scoped RLS policies for dashboard_configs
CREATE POLICY "Org admins can manage dashboard configs"
  ON public.dashboard_configs FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org members can view dashboard configs"
  ON public.dashboard_configs FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- Create generic conversion-event-aware report functions

-- Generic: Total conversions (based on org's primary event)
CREATE OR REPLACE FUNCTION public.get_report_conversions(
  p_start_date date,
  p_end_date date,
  p_event_name text DEFAULT 'af_complete_registration'
)
RETURNS TABLE(value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(event_count), 0)::numeric as value
  FROM appsflyer_events
  WHERE event_name = p_event_name
    AND event_date >= p_start_date
    AND event_date <= p_end_date;
$$;

-- Generic: Blended CPA (total spend / conversions for given event)
CREATE OR REPLACE FUNCTION public.get_report_blended_cpa_generic(
  p_start_date date,
  p_end_date date,
  p_event_name text DEFAULT 'af_complete_registration'
)
RETURNS TABLE(value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH total_spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= p_start_date AND date <= p_end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= p_start_date AND date <= p_end_date), 0) as spend
  ),
  total_conversions AS (
    SELECT COALESCE(SUM(event_count), 0) as conversions
    FROM appsflyer_events
    WHERE event_name = p_event_name
      AND event_date >= p_start_date
      AND event_date <= p_end_date
  )
  SELECT 
    CASE 
      WHEN (SELECT conversions FROM total_conversions) > 0 
      THEN ROUND((SELECT spend FROM total_spend) / (SELECT conversions FROM total_conversions), 2)
      ELSE 0
    END as value;
$$;

-- Generic: CPA excluding affiliates
CREATE OR REPLACE FUNCTION public.get_report_cpa_excl_affiliates_generic(
  p_start_date date,
  p_end_date date,
  p_event_name text DEFAULT 'af_complete_registration'
)
RETURNS TABLE(value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ad_spend AS (
    SELECT COALESCE(SUM(spend), 0) as spend
    FROM daily_ad_spend
    WHERE date >= p_start_date AND date <= p_end_date
  ),
  total_conversions AS (
    SELECT COALESCE(SUM(event_count), 0) as conversions
    FROM appsflyer_events
    WHERE event_name = p_event_name
      AND event_date >= p_start_date
      AND event_date <= p_end_date
  )
  SELECT 
    CASE 
      WHEN (SELECT conversions FROM total_conversions) > 0 
      THEN ROUND((SELECT spend FROM ad_spend) / (SELECT conversions FROM total_conversions), 2)
      ELSE 0
    END as value;
$$;

-- Generic: Conversions by channel
CREATE OR REPLACE FUNCTION public.get_report_conversions_by_channel(
  p_start_date date,
  p_end_date date,
  p_event_name text DEFAULT 'af_complete_registration'
)
RETURNS TABLE(channel text, value numeric, channel_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN media_source = 'Facebook Ads' THEN 'Meta Ads'
      WHEN media_source = 'Apple Search Ads' THEN 'Apple Search Ads'
      WHEN media_source ILIKE '%moloco%' THEN 'Moloco Ads'
      ELSE media_source
    END as channel,
    SUM(event_count)::numeric as value,
    'ad'::text as channel_type
  FROM appsflyer_events
  WHERE event_name = p_event_name
    AND event_date >= p_start_date
    AND event_date <= p_end_date
  GROUP BY 1
  HAVING SUM(event_count) > 0
  ORDER BY value DESC;
$$;

-- Generic: CPA by channel
CREATE OR REPLACE FUNCTION public.get_report_cpa_by_channel_generic(
  p_start_date date,
  p_end_date date,
  p_event_name text DEFAULT 'af_complete_registration'
)
RETURNS TABLE(channel text, value numeric, channel_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH spend_by_platform AS (
    SELECT 
      CASE 
        WHEN platform = 'meta' THEN 'Meta Ads'
        WHEN platform = 'apple' THEN 'Apple Search Ads'
        WHEN platform = 'moloco' THEN 'Moloco Ads'
        ELSE platform
      END as channel,
      SUM(spend) as spend
    FROM daily_ad_spend
    WHERE date >= p_start_date AND date <= p_end_date
    GROUP BY 1
  ),
  conversions_by_source AS (
    SELECT 
      CASE 
        WHEN media_source = 'Facebook Ads' THEN 'Meta Ads'
        WHEN media_source = 'Apple Search Ads' THEN 'Apple Search Ads'
        WHEN media_source ILIKE '%moloco%' THEN 'Moloco Ads'
        ELSE media_source
      END as channel,
      SUM(event_count) as conversions
    FROM appsflyer_events
    WHERE event_name = p_event_name
      AND event_date >= p_start_date
      AND event_date <= p_end_date
    GROUP BY 1
  )
  SELECT 
    s.channel,
    CASE 
      WHEN COALESCE(c.conversions, 0) > 0 
      THEN ROUND(s.spend / c.conversions, 2)
      ELSE 0
    END as value,
    'ad'::text as channel_type
  FROM spend_by_platform s
  LEFT JOIN conversions_by_source c ON c.channel = s.channel
  WHERE s.spend > 0
  ORDER BY value DESC;
$$;