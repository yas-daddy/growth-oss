-- Add columns to dashboard_configs for dynamic dashboard management
ALTER TABLE public.dashboard_configs
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'LayoutDashboard',
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_deletable boolean DEFAULT true;

-- Backfill existing dashboards with their names
UPDATE public.dashboard_configs SET name = 'Acquisition', icon = 'Target', display_order = 1, is_deletable = false WHERE dashboard_slug = 'acquisition';
UPDATE public.dashboard_configs SET name = 'Revenue', icon = 'DollarSign', display_order = 2, is_deletable = false WHERE dashboard_slug = 'revenue';
UPDATE public.dashboard_configs SET name = 'Channels', icon = 'BarChart3', display_order = 3, is_deletable = false WHERE dashboard_slug = 'channels';
UPDATE public.dashboard_configs SET name = 'Affiliates', icon = 'Users', display_order = 4, is_deletable = false WHERE dashboard_slug = 'affiliates';