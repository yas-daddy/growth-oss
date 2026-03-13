-- Optimize the populate function to process one day at a time with a limit
CREATE OR REPLACE FUNCTION populate_daily_revenue_metrics(batch_limit integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  target_date DATE;
  processed_count INTEGER := 0;
BEGIN
  -- Process each day that has FTDs but no revenue metrics (only past days)
  FOR target_date IN 
    SELECT DISTINCT event_time::date as d
    FROM mixpanel_events 
    WHERE event_name = 'first_time_deposit'
      AND event_time::date < CURRENT_DATE
      AND event_time::date NOT IN (SELECT date FROM daily_revenue_metrics)
    ORDER BY d DESC
    LIMIT batch_limit
  LOOP
    -- Calculate metrics for this day's FTD cohort
    INSERT INTO daily_revenue_metrics (date, ftd_cohort_deposits, ftd_cohort_withdrawals, ftd_cohort_net_deposits, ftd_count)
    WITH ftd_users AS (
      SELECT DISTINCT COALESCE(mixpanel_user_id, distinct_id) as user_id
      FROM mixpanel_events
      WHERE event_name = 'first_time_deposit'
        AND event_time::date = target_date
    ),
    transactions AS (
      SELECT 
        COALESCE(SUM(CASE WHEN event_name = 'deposit_success' THEN (properties->>'deposit_amount')::numeric ELSE 0 END), 0) as deposits,
        COALESCE(SUM(CASE WHEN event_name = 'withdrawal_success' THEN (properties->>'withdrawal_amount')::numeric ELSE 0 END), 0) as withdrawals
      FROM mixpanel_events me
      WHERE COALESCE(me.mixpanel_user_id, me.distinct_id) IN (SELECT user_id FROM ftd_users)
        AND me.event_name IN ('deposit_success', 'withdrawal_success')
        AND me.event_time::date = target_date
    )
    SELECT 
      target_date,
      (SELECT deposits FROM transactions),
      (SELECT withdrawals FROM transactions),
      (SELECT deposits - withdrawals FROM transactions),
      (SELECT COUNT(*)::integer FROM ftd_users)
    ON CONFLICT (date) DO UPDATE SET
      ftd_cohort_deposits = EXCLUDED.ftd_cohort_deposits,
      ftd_cohort_withdrawals = EXCLUDED.ftd_cohort_withdrawals,
      ftd_cohort_net_deposits = EXCLUDED.ftd_cohort_net_deposits,
      ftd_count = EXCLUDED.ftd_count,
      calculated_at = now();
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$;