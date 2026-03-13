-- Create table for AI budget recommendations
CREATE TABLE public.ai_budget_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('channel', 'campaign', 'keyword')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('increase', 'decrease', 'reallocate', 'pause')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reasoning TEXT NOT NULL,
  recommended_action TEXT,
  current_spend NUMERIC,
  suggested_change NUMERIC,
  metrics_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_budget_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-wide access pattern)
CREATE POLICY "Users can view all budget recommendations"
ON public.ai_budget_recommendations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert budget recommendations"
ON public.ai_budget_recommendations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update budget recommendations"
ON public.ai_budget_recommendations
FOR UPDATE
TO authenticated
USING (true);

-- Indexes
CREATE INDEX idx_budget_recs_channel_status ON public.ai_budget_recommendations(channel, status);
CREATE INDEX idx_budget_recs_entity ON public.ai_budget_recommendations(entity_type, entity_id);