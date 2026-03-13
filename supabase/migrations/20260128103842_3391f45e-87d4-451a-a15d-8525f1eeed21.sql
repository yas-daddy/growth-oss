-- Create CPA threshold settings table (organization-wide, single row)
CREATE TABLE public.cpa_threshold_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_cpa NUMERIC NOT NULL DEFAULT 20,
  max_cpa NUMERIC NOT NULL DEFAULT 55,
  target_cpa NUMERIC NOT NULL DEFAULT 35,
  green_threshold NUMERIC NOT NULL DEFAULT 42,
  orange_threshold NUMERIC NOT NULL DEFAULT 48,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cpa_threshold_settings ENABLE ROW LEVEL SECURITY;

-- Policies - all authenticated users can read/update
CREATE POLICY "Anyone can view CPA settings" 
ON public.cpa_threshold_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can update CPA settings" 
ON public.cpa_threshold_settings 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert CPA settings" 
ON public.cpa_threshold_settings 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default row
INSERT INTO public.cpa_threshold_settings (min_cpa, max_cpa, target_cpa, green_threshold, orange_threshold)
VALUES (20, 55, 35, 42, 48);

-- Add trigger for updated_at
CREATE TRIGGER update_cpa_threshold_settings_updated_at
BEFORE UPDATE ON public.cpa_threshold_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();