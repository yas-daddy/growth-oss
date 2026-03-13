-- Create table for storing calculated weekly brand scores
CREATE TABLE public.weekly_brand_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  nps_score INTEGER NOT NULL DEFAULT 0,
  search_visibility_score INTEGER NOT NULL DEFAULT 0,
  rating_score INTEGER NOT NULL DEFAULT 0,
  organic_installs_score INTEGER NOT NULL DEFAULT 0,
  referrals_score INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient date-based queries
CREATE INDEX idx_weekly_brand_scores_week_start ON public.weekly_brand_scores(week_start DESC);

-- Enable RLS (but allow public read access for dashboard display)
ALTER TABLE public.weekly_brand_scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read brand scores (public dashboard data)
CREATE POLICY "Anyone can view brand scores" 
ON public.weekly_brand_scores 
FOR SELECT 
USING (true);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage brand scores" 
ON public.weekly_brand_scores 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_weekly_brand_scores_updated_at
BEFORE UPDATE ON public.weekly_brand_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();