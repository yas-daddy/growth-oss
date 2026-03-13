-- Create table for Google Play reviews
CREATE TABLE public.google_play_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  review_id TEXT NOT NULL,
  author_name TEXT,
  stars INTEGER NOT NULL,
  text TEXT,
  title TEXT,
  language TEXT,
  device TEXT,
  app_version_code TEXT,
  app_version_name TEXT,
  thumbs_up_count INTEGER DEFAULT 0,
  review_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  review_updated_at TIMESTAMP WITH TIME ZONE,
  developer_reply_text TEXT,
  developer_reply_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, review_id)
);

-- Enable Row Level Security
ALTER TABLE public.google_play_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own google play reviews" 
ON public.google_play_reviews 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own google play reviews" 
ON public.google_play_reviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google play reviews" 
ON public.google_play_reviews 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google play reviews" 
ON public.google_play_reviews 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for efficient date filtering
CREATE INDEX idx_google_play_reviews_user_created ON public.google_play_reviews(user_id, review_created_at);