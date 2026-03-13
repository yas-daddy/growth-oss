-- Create table to store synced Meta ad rules
CREATE TABLE public.meta_ad_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_rule_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENABLED',
  account_id TEXT,
  evaluation_spec JSONB NOT NULL,
  execution_spec JSONB NOT NULL,
  schedule_spec JSONB,
  created_by_name TEXT,
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_ad_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view meta ad rules"
ON public.meta_ad_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert meta ad rules"
ON public.meta_ad_rules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update meta ad rules"
ON public.meta_ad_rules
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete meta ad rules"
ON public.meta_ad_rules
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_meta_ad_rules_updated_at
BEFORE UPDATE ON public.meta_ad_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_meta_ad_rules_status ON public.meta_ad_rules(status);
CREATE INDEX idx_meta_ad_rules_synced_at ON public.meta_ad_rules(synced_at DESC);