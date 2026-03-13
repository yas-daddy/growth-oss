-- Create dashboard_configs table to store which reports appear on each dashboard
CREATE TABLE public.dashboard_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_slug text NOT NULL UNIQUE,
  report_slugs text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

-- Anyone can view dashboard configs
CREATE POLICY "Anyone can view dashboard configs"
ON public.dashboard_configs
FOR SELECT
USING (true);

-- Only admins can manage dashboard configs
CREATE POLICY "Admins can manage dashboard configs"
ON public.dashboard_configs
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_dashboard_configs_updated_at
BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configurations for existing dashboards
INSERT INTO public.dashboard_configs (dashboard_slug, report_slugs) VALUES
('acquisition', ARRAY['total_spend', 'ftd_count', 'blended_cpa', 'ftds_by_channel', 'spend_by_channel']),
('revenue', ARRAY['ftd_cohort_deposits', 'new_users_net_deposits', 'avg_net_per_ftd']),
('channels', ARRAY['blended_roas', 'payback_period', 'cpa_by_channel']);