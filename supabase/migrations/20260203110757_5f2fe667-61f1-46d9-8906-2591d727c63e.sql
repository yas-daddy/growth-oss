-- ============================================================
-- Layer 1: Add covering index for second_time_deposit events
-- This matches the existing FTD and signup covering indexes
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) as we're in a transaction
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_std_covering 
ON public.mixpanel_events (event_name, event_time) 
INCLUDE (mixpanel_user_id, distinct_id) 
WHERE (event_name = 'second_time_deposit');

-- ============================================================
-- Layer 5: Create alert table for monitoring missing metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funnel_metric_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_date date NOT NULL,
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  auto_fixed boolean DEFAULT false,
  error_message text
);

-- Enable RLS (allow all authenticated users to view)
ALTER TABLE public.funnel_metric_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view funnel metric alerts"
  ON public.funnel_metric_alerts
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert funnel metric alerts"
  ON public.funnel_metric_alerts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update funnel metric alerts"
  ON public.funnel_metric_alerts
  FOR UPDATE
  USING (true);

-- ============================================================
-- Create single-day RPC function for more reliable processing
-- This allows retry logic at the day level instead of full range
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_daily_funnel_metrics_single_day(target_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
AS $$
DECLARE
  signup_count integer;
  ftd_count integer;
  std_count integer;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  -- Calculate timestamp range for the target date
  start_ts := target_date::timestamptz;
  end_ts := (target_date + interval '1 day')::timestamptz;
  
  -- Count unique signups for this day
  SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))
  INTO signup_count
  FROM mixpanel_events
  WHERE event_name = 'signup_completed'
    AND event_time >= start_ts
    AND event_time < end_ts;
  
  -- Count unique FTDs for this day
  SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))
  INTO ftd_count
  FROM mixpanel_events
  WHERE event_name = 'first_time_deposit'
    AND event_time >= start_ts
    AND event_time < end_ts;
  
  -- Count unique STDs for this day
  SELECT COUNT(DISTINCT COALESCE(mixpanel_user_id, distinct_id))
  INTO std_count
  FROM mixpanel_events
  WHERE event_name = 'second_time_deposit'
    AND event_time >= start_ts
    AND event_time < end_ts;
  
  -- Upsert the metrics for this date
  INSERT INTO daily_funnel_metrics (date, unique_signups, unique_ftds, unique_stds, calculated_at)
  VALUES (target_date, signup_count, ftd_count, std_count, now())
  ON CONFLICT (date) DO UPDATE SET
    unique_signups = EXCLUDED.unique_signups,
    unique_ftds = EXCLUDED.unique_ftds,
    unique_stds = EXCLUDED.unique_stds,
    calculated_at = now();
  
  RETURN jsonb_build_object(
    'date', target_date,
    'unique_signups', signup_count,
    'unique_ftds', ftd_count,
    'unique_stds', std_count
  );
END;
$$;