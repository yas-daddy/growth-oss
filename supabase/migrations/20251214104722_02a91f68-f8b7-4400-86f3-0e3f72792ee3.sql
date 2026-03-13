-- Create auto response settings table
CREATE TABLE public.auto_response_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_post_threshold INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings for each platform
INSERT INTO public.auto_response_settings (platform, enabled, auto_post_threshold) VALUES
  ('App Store', false, 4),
  ('Google Play', false, 4),
  ('Trustpilot', false, 4);

-- Enable RLS
ALTER TABLE public.auto_response_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage auto response settings"
ON public.auto_response_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view auto response settings"
ON public.auto_response_settings
FOR SELECT
USING (true);

-- Create pending responses table
CREATE TABLE public.pending_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_db_id UUID NOT NULL,
  review_stars INTEGER NOT NULL,
  review_title TEXT,
  review_text TEXT,
  review_author TEXT,
  ai_response TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  posted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pending_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage pending responses"
ON public.pending_responses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view pending responses"
ON public.pending_responses
FOR SELECT
USING (true);

-- Add unique constraint to prevent duplicate pending responses
CREATE UNIQUE INDEX pending_responses_review_unique ON public.pending_responses (platform, review_id) WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER update_auto_response_settings_updated_at
BEFORE UPDATE ON public.auto_response_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();