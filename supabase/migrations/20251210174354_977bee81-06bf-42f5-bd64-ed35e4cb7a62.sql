-- Create a table for storing user review settings/prompts
CREATE TABLE public.review_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ai_prompt TEXT NOT NULL DEFAULT 'You are a professional customer service representative. Generate a helpful, empathetic, and professional response to the following customer review. Keep the response concise (2-3 sentences) and address any specific concerns mentioned. Be genuine and avoid generic responses.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own review settings" 
ON public.review_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own review settings" 
ON public.review_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review settings" 
ON public.review_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_review_settings_updated_at
BEFORE UPDATE ON public.review_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();