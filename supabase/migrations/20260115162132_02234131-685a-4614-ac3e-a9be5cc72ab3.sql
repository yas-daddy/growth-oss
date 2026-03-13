-- Add platform column to ad_launch_history
ALTER TABLE public.ad_launch_history 
ADD COLUMN platform text NOT NULL DEFAULT 'meta';

-- Add moloco-specific columns
ALTER TABLE public.ad_launch_history
ADD COLUMN moloco_creative_ids text[] DEFAULT NULL,
ADD COLUMN moloco_creative_group_id text DEFAULT NULL,
ADD COLUMN tracking_link_id text DEFAULT NULL;