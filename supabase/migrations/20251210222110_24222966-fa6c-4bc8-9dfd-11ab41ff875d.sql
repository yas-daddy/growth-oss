-- Add budget columns to meta_campaigns
ALTER TABLE public.meta_campaigns 
ADD COLUMN IF NOT EXISTS daily_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_budget numeric DEFAULT 0;

-- Add budget columns to apple_campaigns
ALTER TABLE public.apple_campaigns 
ADD COLUMN IF NOT EXISTS daily_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_amount numeric DEFAULT 0;

-- Add budget columns to moloco_campaigns
ALTER TABLE public.moloco_campaigns 
ADD COLUMN IF NOT EXISTS daily_budget numeric DEFAULT 0;