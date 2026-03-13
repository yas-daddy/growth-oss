-- Create a table for Trustpilot reviews
CREATE TABLE public.trustpilot_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  review_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  title TEXT,
  text TEXT,
  language TEXT,
  consumer_display_name TEXT,
  consumer_country_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, review_id)
);

-- Enable Row Level Security
ALTER TABLE public.trustpilot_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own trustpilot reviews" 
ON public.trustpilot_reviews 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trustpilot reviews" 
ON public.trustpilot_reviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trustpilot reviews" 
ON public.trustpilot_reviews 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trustpilot reviews" 
ON public.trustpilot_reviews 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_trustpilot_reviews_user_id ON public.trustpilot_reviews(user_id);
CREATE INDEX idx_trustpilot_reviews_stars ON public.trustpilot_reviews(stars);
CREATE INDEX idx_trustpilot_reviews_created_at ON public.trustpilot_reviews(created_at);