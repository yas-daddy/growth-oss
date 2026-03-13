-- Add keyword_targeting column to keyword_automation_rules table
ALTER TABLE public.keyword_automation_rules
ADD COLUMN IF NOT EXISTS keyword_targeting JSONB DEFAULT NULL;