-- Create monthly_metrics table (mirrors weekly_metrics structure)
CREATE TABLE public.monthly_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_start DATE NOT NULL UNIQUE,
  spend_by_channel JSONB DEFAULT '{}'::jsonb,
  clicks_by_channel JSONB DEFAULT '{}'::jsonb,
  ftds_by_channel JSONB DEFAULT '{}'::jsonb,
  cpa_by_channel JSONB DEFAULT '{}'::jsonb,
  affiliate_metrics JSONB DEFAULT '{}'::jsonb,
  total_installs INTEGER NOT NULL DEFAULT 0,
  total_signups INTEGER NOT NULL DEFAULT 0,
  total_ftds INTEGER NOT NULL DEFAULT 0,
  total_stds INTEGER NOT NULL DEFAULT 0,
  total_ad_spend NUMERIC NOT NULL DEFAULT 0,
  total_affiliate_spend NUMERIC NOT NULL DEFAULT 0,
  total_spend NUMERIC NOT NULL DEFAULT 0,
  blended_cac NUMERIC DEFAULT 0,
  blended_cpa NUMERIC DEFAULT 0,
  cvr_install_to_signup NUMERIC DEFAULT 0,
  cvr_signup_to_ftd NUMERIC DEFAULT 0,
  cvr_ftd_to_std NUMERIC DEFAULT 0,
  cvr_install_to_std NUMERIC DEFAULT 0,
  ftd_cohort_deposits NUMERIC DEFAULT 0,
  avg_deposit_per_ftd NUMERIC DEFAULT 0,
  ad_spend_per_1k_deposit NUMERIC DEFAULT 0,
  net_deposits_new_users NUMERIC DEFAULT 0,
  new_users_net_deposits NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  avg_rating NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage monthly metrics" 
  ON public.monthly_metrics 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view monthly metrics" 
  ON public.monthly_metrics 
  FOR SELECT 
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_monthly_metrics_updated_at
  BEFORE UPDATE ON public.monthly_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();