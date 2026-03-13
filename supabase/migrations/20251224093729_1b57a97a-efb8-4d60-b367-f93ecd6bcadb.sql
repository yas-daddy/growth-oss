
-- Add rejected_at column to pending_responses to track rejected reviews
ALTER TABLE public.pending_responses 
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone DEFAULT NULL;

-- Add index for faster lookup of rejected reviews
CREATE INDEX IF NOT EXISTS idx_pending_responses_rejected 
ON public.pending_responses (review_db_id, rejected_at) 
WHERE rejected_at IS NOT NULL;
