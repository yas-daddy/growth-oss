-- Create table for AI keyword recommendations
CREATE TABLE public.ai_keyword_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword_id TEXT,
  keyword_text TEXT NOT NULL,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('increase_bid', 'decrease_bid', 'pause', 'scale', 'new_keyword', 'opportunity')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reasoning TEXT NOT NULL,
  suggested_action JSONB,
  metrics_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_keyword_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own recommendations" 
ON public.ai_keyword_recommendations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recommendations" 
ON public.ai_keyword_recommendations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations" 
ON public.ai_keyword_recommendations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations" 
ON public.ai_keyword_recommendations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_keyword_recommendations_updated_at
BEFORE UPDATE ON public.ai_keyword_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_ai_keyword_recommendations_user_id ON public.ai_keyword_recommendations(user_id);
CREATE INDEX idx_ai_keyword_recommendations_status ON public.ai_keyword_recommendations(status);
CREATE INDEX idx_ai_keyword_recommendations_type ON public.ai_keyword_recommendations(recommendation_type);