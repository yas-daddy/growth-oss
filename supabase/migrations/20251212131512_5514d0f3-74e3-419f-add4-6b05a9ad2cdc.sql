-- Create report_definitions table for the report registry
CREATE TABLE public.report_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 'acquisition', 'revenue', 'channels', 'projections'
  report_type text NOT NULL, -- 'kpi' or 'chart'
  config jsonb NOT NULL DEFAULT '{}', -- variant, icon, format, invertColors, subtitle, etc.
  data_source text NOT NULL, -- name of the RPC function to call
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

-- Everyone can view report definitions
CREATE POLICY "Anyone can view report definitions"
ON public.report_definitions
FOR SELECT
USING (true);

-- Only admins can manage report definitions
CREATE POLICY "Admins can manage report definitions"
ON public.report_definitions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RPC function: get_total_spend
CREATE OR REPLACE FUNCTION public.get_report_total_spend(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH current_period AS (
    SELECT 
      COALESCE(SUM(spend), 0) as ad_spend
    FROM daily_ad_spend
    WHERE date >= start_date AND date <= end_date
  ),
  current_affiliate AS (
    SELECT 
      COALESCE(SUM(spend), 0) as aff_spend
    FROM daily_affiliate_spend
    WHERE date >= start_date AND date <= end_date
  )
  SELECT 
    (SELECT ad_spend FROM current_period) + (SELECT aff_spend FROM current_affiliate) as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_ftd_count
CREATE OR REPLACE FUNCTION public.get_report_ftd_count(start_date date, end_date date)
RETURNS TABLE(value bigint, previous_value bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))::bigint as value,
    0::bigint as previous_value
  FROM mixpanel_events
  WHERE event_name = 'first_time_deposit'
    AND event_time >= start_date::timestamp
    AND event_time < (end_date + 1)::timestamp;
$$;

-- Create RPC function: get_blended_cpa
CREATE OR REPLACE FUNCTION public.get_report_blended_cpa(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftds AS (
    SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id)) as count
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftds) > 0 
      THEN (SELECT total FROM spend) / (SELECT count FROM ftds)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_ftd_cohort_deposits_report
CREATE OR REPLACE FUNCTION public.get_report_ftd_cohort_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  )
  SELECT 
    COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as value,
    0::numeric as previous_value
  FROM mixpanel_events
  WHERE event_name = 'deposit_success'
    AND event_time >= start_date::timestamp
    AND event_time < (end_date + 1)::timestamp
    AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users);
$$;

-- Create RPC function: get_new_users_net_deposits
CREATE OR REPLACE FUNCTION public.get_report_new_users_net_deposits(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  deposits AS (
    SELECT COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawals AS (
    SELECT COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'withdrawal_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    (SELECT total FROM deposits) - (SELECT total FROM withdrawals) as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_avg_net_per_ftd
CREATE OR REPLACE FUNCTION public.get_report_avg_net_per_ftd(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  ftd_count AS (
    SELECT COUNT(*) as count FROM ftd_users
  ),
  deposits AS (
    SELECT COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawals AS (
    SELECT COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'withdrawal_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    CASE WHEN (SELECT count FROM ftd_count) > 0 
      THEN ((SELECT total FROM deposits) - (SELECT total FROM withdrawals)) / (SELECT count FROM ftd_count)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_blended_roas
CREATE OR REPLACE FUNCTION public.get_report_blended_roas(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  deposits AS (
    SELECT COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawals AS (
    SELECT COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'withdrawal_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  )
  SELECT 
    CASE WHEN (SELECT total FROM spend) > 0 
      THEN ((SELECT total FROM deposits) - (SELECT total FROM withdrawals)) / (SELECT total FROM spend)
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_payback_period
CREATE OR REPLACE FUNCTION public.get_report_payback_period(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH spend AS (
    SELECT 
      COALESCE((SELECT SUM(spend) FROM daily_ad_spend WHERE date >= start_date AND date <= end_date), 0) +
      COALESCE((SELECT SUM(spend) FROM daily_affiliate_spend WHERE date >= start_date AND date <= end_date), 0) as total
  ),
  ftd_users AS (
    SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
    FROM mixpanel_events
    WHERE event_name = 'first_time_deposit'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
  ),
  deposits AS (
    SELECT COALESCE(SUM((properties->>'deposit_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'deposit_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  withdrawals AS (
    SELECT COALESCE(SUM((properties->>'withdrawal_amount')::numeric), 0) as total
    FROM mixpanel_events
    WHERE event_name = 'withdrawal_success'
      AND event_time >= start_date::timestamp
      AND event_time < (end_date + 1)::timestamp
      AND COALESCE(mixpanel_user_id, distinct_id) IN (SELECT user_id FROM ftd_users)
  ),
  net AS (
    SELECT (SELECT total FROM deposits) - (SELECT total FROM withdrawals) as total
  )
  SELECT 
    CASE WHEN (SELECT total FROM net) > 0 
      THEN ((SELECT total FROM spend) / (SELECT total FROM net)) * 30
      ELSE 0 
    END as value,
    0::numeric as previous_value;
$$;

-- Create RPC function: get_total_installs
CREATE OR REPLACE FUNCTION public.get_report_total_installs(start_date date, end_date date)
RETURNS TABLE(value bigint, previous_value bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(installs), 0)::bigint as value,
    0::bigint as previous_value
  FROM daily_appsflyer_installs
  WHERE date >= start_date AND date <= end_date;
$$;

-- Seed initial report definitions
INSERT INTO public.report_definitions (slug, name, description, category, report_type, config, data_source) VALUES
-- Acquisition reports
('total_spend', 'Total Spend', 'Combined ad platform and affiliate spend', 'acquisition', 'kpi', 
  '{"variant": "primary", "icon": "DollarSign", "format": "currency"}'::jsonb, 'get_report_total_spend'),
('ftd_count', 'FTDs', 'First-time deposit count from Mixpanel', 'acquisition', 'kpi',
  '{"variant": "accent", "icon": "Users", "format": "number"}'::jsonb, 'get_report_ftd_count'),
('blended_cpa', 'Blended CPA', 'Total spend divided by FTD count', 'acquisition', 'kpi',
  '{"variant": "default", "icon": "Zap", "format": "currency_decimal", "invertColors": true}'::jsonb, 'get_report_blended_cpa'),

-- Revenue reports
('ftd_cohort_deposits', 'FTD Cohort Deposits', 'Deposits from users with FTD in period', 'revenue', 'kpi',
  '{"variant": "primary", "icon": "BarChart3", "format": "currency", "subtitle": "Deposits from users with FTD in period"}'::jsonb, 'get_report_ftd_cohort_deposits'),
('new_users_net_deposits', 'New Users Net Deposits', 'Deposits minus withdrawals for FTD cohort', 'revenue', 'kpi',
  '{"variant": "accent", "icon": "ArrowDownUp", "format": "currency", "subtitle": "Deposits - Withdrawals for FTD cohort"}'::jsonb, 'get_report_new_users_net_deposits'),
('avg_net_per_ftd', 'Avg Net Deposit / FTD', 'Net deposits divided by FTD count', 'revenue', 'kpi',
  '{"variant": "default", "icon": "TrendingUp", "format": "currency_decimal", "subtitle": "Net deposits ÷ FTD count"}'::jsonb, 'get_report_avg_net_per_ftd'),

-- Channels reports
('blended_roas', 'Blended ROAS', 'Net deposits divided by total spend', 'channels', 'kpi',
  '{"variant": "primary", "icon": "TrendingUp", "format": "multiplier"}'::jsonb, 'get_report_blended_roas'),
('payback_period', 'Payback Period', 'Days to recover spend from net deposits', 'channels', 'kpi',
  '{"variant": "accent", "icon": "Clock", "format": "days"}'::jsonb, 'get_report_payback_period');

-- Create trigger for updated_at
CREATE TRIGGER update_report_definitions_updated_at
BEFORE UPDATE ON public.report_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();