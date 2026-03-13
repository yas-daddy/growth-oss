-- Create table for channel weights
CREATE TABLE public.channel_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  app_store_weight NUMERIC NOT NULL DEFAULT 1,
  google_play_weight NUMERIC NOT NULL DEFAULT 1,
  trustpilot_weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.channel_weights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own channel weights"
ON public.channel_weights
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own channel weights"
ON public.channel_weights
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channel weights"
ON public.channel_weights
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_channel_weights_updated_at
BEFORE UPDATE ON public.channel_weights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();