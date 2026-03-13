-- Add partial indexes for specific event types
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_ftd_lookup ON public.mixpanel_events(event_name, event_time) WHERE event_name = 'first_time_deposit';
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_deposits ON public.mixpanel_events(event_name, event_time) WHERE event_name = 'deposit_success';
CREATE INDEX IF NOT EXISTS idx_mixpanel_events_withdrawals ON public.mixpanel_events(event_name, event_time) WHERE event_name = 'withdrawal_success';