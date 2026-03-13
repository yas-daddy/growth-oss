-- Add response fields to trustpilot_reviews
ALTER TABLE public.trustpilot_reviews
ADD COLUMN response_text TEXT,
ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;