-- Create keyword_automation_rules table
CREATE TABLE public.keyword_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'apple' CHECK (platform IN ('apple', 'meta')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions JSONB NOT NULL DEFAULT '{"logic": "AND", "conditions": []}',
  action_type TEXT NOT NULL CHECK (action_type IN ('adjust_bid', 'pause_keyword', 'enable_keyword')),
  action_value JSONB,
  lookback_days INTEGER NOT NULL DEFAULT 7,
  min_spend_threshold NUMERIC,
  min_impressions_threshold INTEGER,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'manual')),
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rule_execution_logs table
CREATE TABLE public.rule_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.keyword_automation_rules(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  keywords_evaluated INTEGER NOT NULL DEFAULT 0,
  keywords_matched INTEGER NOT NULL DEFAULT 0,
  actions_taken JSONB DEFAULT '[]',
  errors JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.keyword_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for keyword_automation_rules (all authenticated users can manage)
CREATE POLICY "Authenticated users can view automation rules"
ON public.keyword_automation_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create automation rules"
ON public.keyword_automation_rules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update automation rules"
ON public.keyword_automation_rules
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete automation rules"
ON public.keyword_automation_rules
FOR DELETE
TO authenticated
USING (true);

-- RLS policies for rule_execution_logs
CREATE POLICY "Authenticated users can view execution logs"
ON public.rule_execution_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create execution logs"
ON public.rule_execution_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_keyword_automation_rules_updated_at
BEFORE UPDATE ON public.keyword_automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_keyword_automation_rules_platform ON public.keyword_automation_rules(platform);
CREATE INDEX idx_keyword_automation_rules_is_active ON public.keyword_automation_rules(is_active);
CREATE INDEX idx_rule_execution_logs_rule_id ON public.rule_execution_logs(rule_id);
CREATE INDEX idx_rule_execution_logs_executed_at ON public.rule_execution_logs(executed_at DESC);