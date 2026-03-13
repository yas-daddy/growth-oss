-- Add is_locked column to weekly_metrics
ALTER TABLE public.weekly_metrics 
ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Add is_locked column to monthly_metrics
ALTER TABLE public.monthly_metrics 
ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.weekly_metrics.is_locked IS 'When true, this row will not be overwritten by recalculation. Used for historical data uploads.';
COMMENT ON COLUMN public.monthly_metrics.is_locked IS 'When true, this row will not be overwritten by recalculation. Used for historical data uploads.';