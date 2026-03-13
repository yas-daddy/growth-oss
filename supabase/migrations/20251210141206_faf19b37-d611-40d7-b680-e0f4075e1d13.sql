-- Create apple_campaigns table for storing Apple Search Ads data
CREATE TABLE public.apple_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  impressions INTEGER NOT NULL DEFAULT 0,
  taps INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  avg_cpa NUMERIC DEFAULT 0,
  avg_cpt NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

-- Enable Row Level Security
ALTER TABLE public.apple_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own apple campaigns"
ON public.apple_campaigns
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own apple campaigns"
ON public.apple_campaigns
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own apple campaigns"
ON public.apple_campaigns
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own apple campaigns"
ON public.apple_campaigns
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_apple_campaigns_updated_at
BEFORE UPDATE ON public.apple_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();