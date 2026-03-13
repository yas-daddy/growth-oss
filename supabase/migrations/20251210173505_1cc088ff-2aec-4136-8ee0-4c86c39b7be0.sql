-- Add response fields to app_store_reviews
ALTER TABLE public.app_store_reviews 
ADD COLUMN response_text TEXT,
ADD COLUMN response_id TEXT,
ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;

-- Add response fields to google_play_reviews  
ALTER TABLE public.google_play_reviews
ADD COLUMN response_text TEXT,
ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;