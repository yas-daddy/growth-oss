-- Create table for customizable brand score explanations
CREATE TABLE public.brand_score_explanations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_score_explanations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Authenticated users can read explanations"
ON public.brand_score_explanations
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to update (organization-wide setting)
CREATE POLICY "Authenticated users can update explanations"
ON public.brand_score_explanations
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to insert if none exist
CREATE POLICY "Authenticated users can insert explanations"
ON public.brand_score_explanations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_brand_score_explanations_updated_at
BEFORE UPDATE ON public.brand_score_explanations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default values
INSERT INTO public.brand_score_explanations (component_key, label, explanation) VALUES
('memorability', 'Memorability', 'Memorability measures your share of category search volume — when people think of your category, do they think of you? This is the closest accessible proxy to what Byron Sharp calls "mental availability." If 100 people search for terms in your category and 5 of those searches are for your brand specifically, you have 5% share of search. You can calculate this using Google Trends or Mangools.'),
('visibility', 'Visibility', 'Visibility captures monthly branded searches — how many people are actively looking for your brand name. This is a direct signal of awareness and interest. Find it in Google Search Console under Performance > Queries.'),
('reach', 'Reach', 'Reach measures your engaged audience. We don''t just count impressions (easy to inflate) or engagement (easy to game with low-reach, high-engagement tactics). Instead, we calculate a composite that requires both scale and genuine interaction. You need reach that resonates, not vanity metrics.'),
('trust', 'Trust', 'Trust looks at new positive reviews per month. This is third-party validation — real customers vouching for you publicly on platforms like Trustpilot, G2, App Store, or Google Reviews. Reviews compound over time and carry more weight than any claim you can make about yourself.'),
('community', 'Community', 'Community counts your owned audience — newsletter subscribers, app installs, community members. This is your moat. Platform algorithms change, ad costs fluctuate, but an email list you control is yours.');