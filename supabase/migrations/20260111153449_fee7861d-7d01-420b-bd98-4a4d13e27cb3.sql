-- Create table for AI creative fatigue predictions
CREATE TABLE public.ai_creative_fatigue_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creative_id TEXT NOT NULL,
  creative_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'moloco')),
  fatigue_status TEXT NOT NULL CHECK (fatigue_status IN ('healthy', 'early_warning', 'fatiguing', 'fatigued')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  days_until_fatigue INTEGER,
  reasoning TEXT NOT NULL,
  trend_data JSONB,
  recommended_action TEXT,
  metrics_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'rotated')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_creative_fatigue_predictions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all fatigue predictions"
ON public.ai_creative_fatigue_predictions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert fatigue predictions"
ON public.ai_creative_fatigue_predictions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update fatigue predictions"
ON public.ai_creative_fatigue_predictions
FOR UPDATE
TO authenticated
USING (true);

-- Index for efficient queries
CREATE INDEX idx_creative_fatigue_platform_status ON public.ai_creative_fatigue_predictions(platform, status);
CREATE INDEX idx_creative_fatigue_creative_id ON public.ai_creative_fatigue_predictions(creative_id);