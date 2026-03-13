-- Create table for AppsFlyer keyword-level events
CREATE TABLE public.appsflyer_keyword_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT appsflyer_keyword_events_unique UNIQUE (keyword_id, event_name, event_date, platform)
);

-- Enable RLS
ALTER TABLE public.appsflyer_keyword_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view keyword events"
ON public.appsflyer_keyword_events
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert/update
CREATE POLICY "Service role can manage keyword events"
ON public.appsflyer_keyword_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_appsflyer_keyword_events_date ON public.appsflyer_keyword_events(event_date);
CREATE INDEX idx_appsflyer_keyword_events_keyword ON public.appsflyer_keyword_events(keyword_id);

-- Add trigger for updated_at
CREATE TRIGGER update_appsflyer_keyword_events_updated_at
BEFORE UPDATE ON public.appsflyer_keyword_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();