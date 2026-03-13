-- Add HVP columns to weekly_metrics table
ALTER TABLE public.weekly_metrics 
ADD COLUMN IF NOT EXISTS total_hvps integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_hvp numeric DEFAULT 0;