-- Add description column to dashboard_configs
ALTER TABLE public.dashboard_configs ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing dashboards with descriptions
UPDATE public.dashboard_configs SET description = 'Your marketing acquisition performance at a glance' WHERE dashboard_slug = 'acquisition';
UPDATE public.dashboard_configs SET description = 'Track revenue and deposit metrics' WHERE dashboard_slug = 'revenue';
UPDATE public.dashboard_configs SET description = 'Analyze user conversion funnel' WHERE dashboard_slug = 'funnel';
UPDATE public.dashboard_configs SET description = 'Channel performance and ROAS analysis' WHERE dashboard_slug = 'channels';
UPDATE public.dashboard_configs SET description = 'Track affiliate performance and ROI' WHERE dashboard_slug = 'affiliates';