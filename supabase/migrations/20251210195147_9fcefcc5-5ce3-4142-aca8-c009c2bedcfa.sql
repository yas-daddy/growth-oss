-- Create attributed_users table for user-level attribution data
CREATE TABLE public.attributed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  appsflyer_id text NOT NULL,
  media_source text NOT NULL,
  campaign_name text,
  campaign_id text,
  adset_name text,
  ad_name text,
  platform text NOT NULL,
  install_time timestamptz NOT NULL,
  country_code text,
  device_type text,
  is_retargeting boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, appsflyer_id)
);

-- Enable RLS
ALTER TABLE public.attributed_users ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own attributed users"
ON public.attributed_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attributed users"
ON public.attributed_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attributed users"
ON public.attributed_users FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attributed users"
ON public.attributed_users FOR DELETE
USING (auth.uid() = user_id);

-- Create index for fast lookups by appsflyer_id
CREATE INDEX idx_attributed_users_appsflyer_id ON public.attributed_users(appsflyer_id);
CREATE INDEX idx_attributed_users_media_source ON public.attributed_users(media_source);
CREATE INDEX idx_attributed_users_install_time ON public.attributed_users(install_time);