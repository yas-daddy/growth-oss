ALTER TABLE public.push_notification_schedules 
ADD COLUMN IF NOT EXISTS braze_response jsonb;