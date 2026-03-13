
-- Create push_notification_schedules table
CREATE TABLE public.push_notification_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID NOT NULL REFERENCES public.football_fixtures(id) ON DELETE CASCADE,
  braze_schedule_id TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ai_title TEXT NOT NULL,
  ai_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.push_notification_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can manage push schedules
CREATE POLICY "Authenticated users can view push schedules"
  ON public.push_notification_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert push schedules"
  ON public.push_notification_schedules FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update push schedules"
  ON public.push_notification_schedules FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Add push_notification_prompt to review_settings
ALTER TABLE public.review_settings
  ADD COLUMN IF NOT EXISTS push_notification_prompt TEXT;
