-- Create a table for App Store reviews
CREATE TABLE public.app_store_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  stars INTEGER NOT NULL,
  title TEXT,
  text TEXT,
  author_name TEXT,
  app_version TEXT,
  territory TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.app_store_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own app store reviews" 
ON public.app_store_reviews 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own app store reviews" 
ON public.app_store_reviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app store reviews" 
ON public.app_store_reviews 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own app store reviews" 
ON public.app_store_reviews 
FOR DELETE 
USING (auth.uid() = user_id);