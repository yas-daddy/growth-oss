-- Create daily_funnel_metrics table for pre-aggregated funnel counts
CREATE TABLE public.daily_funnel_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  unique_signups integer NOT NULL DEFAULT 0,
  unique_ftds integer NOT NULL DEFAULT 0,
  unique_stds integer NOT NULL DEFAULT 0,
  calculated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_funnel_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage daily funnel metrics"
ON public.daily_funnel_metrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Non-affiliates can view daily funnel metrics"
ON public.daily_funnel_metrics
FOR SELECT
USING (NOT is_affiliate_only(auth.uid()));

-- Create index for date range queries
CREATE INDEX idx_daily_funnel_metrics_date ON public.daily_funnel_metrics(date);

-- Create the population function
CREATE OR REPLACE FUNCTION public.populate_daily_funnel_metrics(
  start_dt date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  end_dt date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer := 0;
BEGIN
  -- Insert or update daily metrics by counting users whose FIRST event of each type occurred on that date
  INSERT INTO daily_funnel_metrics (date, unique_signups, unique_ftds, unique_stds, calculated_at)
  SELECT 
    d.date,
    COALESCE(s.cnt, 0) as unique_signups,
    COALESCE(f.cnt, 0) as unique_ftds,
    COALESCE(t.cnt, 0) as unique_stds,
    now() as calculated_at
  FROM generate_series(start_dt, end_dt, '1 day'::interval) AS d(date)
  LEFT JOIN (
    -- Count users whose first signup_completed was on each date
    SELECT first_date, COUNT(*) as cnt
    FROM (
      SELECT DATE(MIN(event_time)) as first_date
      FROM mixpanel_events
      WHERE event_name = 'signup_completed'
      GROUP BY COALESCE(mixpanel_user_id, distinct_id)
    ) sub
    WHERE first_date BETWEEN start_dt AND end_dt
    GROUP BY first_date
  ) s ON s.first_date = d.date::date
  LEFT JOIN (
    -- Count users whose first first_time_deposit was on each date
    SELECT first_date, COUNT(*) as cnt
    FROM (
      SELECT DATE(MIN(event_time)) as first_date
      FROM mixpanel_events
      WHERE event_name = 'first_time_deposit'
      GROUP BY COALESCE(mixpanel_user_id, distinct_id)
    ) sub
    WHERE first_date BETWEEN start_dt AND end_dt
    GROUP BY first_date
  ) f ON f.first_date = d.date::date
  LEFT JOIN (
    -- Count users whose first second_time_deposit was on each date
    SELECT first_date, COUNT(*) as cnt
    FROM (
      SELECT DATE(MIN(event_time)) as first_date
      FROM mixpanel_events
      WHERE event_name = 'second_time_deposit'
      GROUP BY COALESCE(mixpanel_user_id, distinct_id)
    ) sub
    WHERE first_date BETWEEN start_dt AND end_dt
    GROUP BY first_date
  ) t ON t.first_date = d.date::date
  ON CONFLICT (date) DO UPDATE SET
    unique_signups = EXCLUDED.unique_signups,
    unique_ftds = EXCLUDED.unique_ftds,
    unique_stds = EXCLUDED.unique_stds,
    calculated_at = EXCLUDED.calculated_at;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'rows_affected', rows_affected,
    'start_date', start_dt,
    'end_date', end_dt
  );
END;
$$;

-- Update get_report_funnel_data to use the pre-aggregated table
CREATE OR REPLACE FUNCTION public.get_report_funnel_data(
  start_date date,
  end_date date
)
RETURNS TABLE (
  installs bigint,
  signups bigint,
  ftds bigint,
  stds bigint,
  install_to_signup numeric,
  signup_to_ftd numeric,
  ftd_to_std numeric,
  install_to_std numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_installs bigint;
  v_signups bigint;
  v_ftds bigint;
  v_stds bigint;
BEGIN
  -- Get installs from daily_appsflyer_installs (existing fast table)
  SELECT COALESCE(SUM(dai.installs), 0)
  INTO v_installs
  FROM daily_appsflyer_installs dai
  WHERE dai.date BETWEEN start_date AND end_date;

  -- Get funnel metrics from pre-aggregated daily_funnel_metrics table
  SELECT 
    COALESCE(SUM(dfm.unique_signups), 0),
    COALESCE(SUM(dfm.unique_ftds), 0),
    COALESCE(SUM(dfm.unique_stds), 0)
  INTO v_signups, v_ftds, v_stds
  FROM daily_funnel_metrics dfm
  WHERE dfm.date BETWEEN start_date AND end_date;

  RETURN QUERY SELECT
    v_installs,
    v_signups,
    v_ftds,
    v_stds,
    CASE WHEN v_installs > 0 THEN ROUND((v_signups::numeric / v_installs) * 100, 2) ELSE 0 END,
    CASE WHEN v_signups > 0 THEN ROUND((v_ftds::numeric / v_signups) * 100, 2) ELSE 0 END,
    CASE WHEN v_ftds > 0 THEN ROUND((v_stds::numeric / v_ftds) * 100, 2) ELSE 0 END,
    CASE WHEN v_installs > 0 THEN ROUND((v_stds::numeric / v_installs) * 100, 2) ELSE 0 END;
END;
$$;