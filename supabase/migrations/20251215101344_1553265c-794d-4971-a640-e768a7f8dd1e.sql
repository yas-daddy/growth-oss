-- Create function to get affiliate channel(s) for a user
CREATE OR REPLACE FUNCTION public.get_user_affiliate_channels(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(a.channel)
  FROM public.affiliate_user_access aua
  JOIN public.affiliates a ON a.id = aua.affiliate_id
  WHERE aua.user_id = _user_id
$$;

-- Create function to get affiliate IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_affiliate_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(affiliate_id)
  FROM public.affiliate_user_access
  WHERE user_id = _user_id
$$;

-- Create function to check if user is affiliate-only (has affiliate role but not admin/user)
CREATE OR REPLACE FUNCTION public.is_affiliate_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'affiliate'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'user', 'editor', 'viewer')
  )
$$;

-- Update affiliates table: affiliates can only see their own affiliate record
DROP POLICY IF EXISTS "Authenticated users can view all affiliates" ON public.affiliates;
CREATE POLICY "Users can view affiliates based on role" ON public.affiliates
FOR SELECT USING (
  NOT is_affiliate_only(auth.uid()) 
  OR id = ANY(get_user_affiliate_ids(auth.uid()))
);

-- Update daily_affiliate_spend: affiliates can only see their own spend
DROP POLICY IF EXISTS "Authenticated users can view all affiliate spend" ON public.daily_affiliate_spend;
CREATE POLICY "Users can view affiliate spend based on role" ON public.daily_affiliate_spend
FOR SELECT USING (
  NOT is_affiliate_only(auth.uid())
  OR affiliate_id = ANY(get_user_affiliate_ids(auth.uid()))
);

-- Update appsflyer_events: affiliates can only see events for their channel
DROP POLICY IF EXISTS "Authenticated users can view all appsflyer events" ON public.appsflyer_events;
CREATE POLICY "Users can view appsflyer events based on role" ON public.appsflyer_events
FOR SELECT USING (
  NOT is_affiliate_only(auth.uid())
  OR media_source = ANY(get_user_affiliate_channels(auth.uid()))
);

-- Update daily_appsflyer_installs: affiliates can only see installs for their channel
DROP POLICY IF EXISTS "Authenticated users can view all daily appsflyer installs" ON public.daily_appsflyer_installs;
CREATE POLICY "Users can view appsflyer installs based on role" ON public.daily_appsflyer_installs
FOR SELECT USING (
  NOT is_affiliate_only(auth.uid())
  OR media_source = ANY(get_user_affiliate_channels(auth.uid()))
);

-- Update daily_appsflyer_clicks: affiliates can only see clicks for their channel
DROP POLICY IF EXISTS "Authenticated users can view all daily appsflyer clicks" ON public.daily_appsflyer_clicks;
CREATE POLICY "Users can view appsflyer clicks based on role" ON public.daily_appsflyer_clicks
FOR SELECT USING (
  NOT is_affiliate_only(auth.uid())
  OR media_source = ANY(get_user_affiliate_channels(auth.uid()))
);

-- Restrict affiliates from ad platform data
DROP POLICY IF EXISTS "Authenticated users can view all daily spend" ON public.daily_ad_spend;
CREATE POLICY "Non-affiliates can view daily ad spend" ON public.daily_ad_spend
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all meta campaigns" ON public.meta_campaigns;
CREATE POLICY "Non-affiliates can view meta campaigns" ON public.meta_campaigns
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all apple campaigns" ON public.apple_campaigns;
CREATE POLICY "Non-affiliates can view apple campaigns" ON public.apple_campaigns
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all moloco campaigns" ON public.moloco_campaigns;
CREATE POLICY "Non-affiliates can view moloco campaigns" ON public.moloco_campaigns
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all appsflyer campaigns" ON public.appsflyer_campaigns;
CREATE POLICY "Non-affiliates can view appsflyer campaigns" ON public.appsflyer_campaigns
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

-- Restrict affiliates from user behavior/analytics data
DROP POLICY IF EXISTS "Authenticated users can view all mixpanel events" ON public.mixpanel_events;
CREATE POLICY "Non-affiliates can view mixpanel events" ON public.mixpanel_events
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all attributed users" ON public.attributed_users;
CREATE POLICY "Non-affiliates can view attributed users" ON public.attributed_users
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all identity mappings" ON public.user_identity_map;
CREATE POLICY "Non-affiliates can view identity mappings" ON public.user_identity_map
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

-- Restrict affiliates from aggregated metrics
DROP POLICY IF EXISTS "Authenticated users can view weekly metrics" ON public.weekly_metrics;
CREATE POLICY "Non-affiliates can view weekly metrics" ON public.weekly_metrics
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view monthly metrics" ON public.monthly_metrics;
CREATE POLICY "Non-affiliates can view monthly metrics" ON public.monthly_metrics
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view range metrics cache" ON public.range_metrics_cache;
CREATE POLICY "Non-affiliates can view range metrics cache" ON public.range_metrics_cache
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

-- Restrict affiliates from review/feedback data
DROP POLICY IF EXISTS "Authenticated users can view all app store reviews" ON public.app_store_reviews;
CREATE POLICY "Non-affiliates can view app store reviews" ON public.app_store_reviews
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all google play reviews" ON public.google_play_reviews;
CREATE POLICY "Non-affiliates can view google play reviews" ON public.google_play_reviews
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all trustpilot reviews" ON public.trustpilot_reviews;
CREATE POLICY "Non-affiliates can view trustpilot reviews" ON public.trustpilot_reviews
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view typeform surveys" ON public.typeform_surveys;
CREATE POLICY "Non-affiliates can view typeform surveys" ON public.typeform_surveys
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view pending responses" ON public.pending_responses;
CREATE POLICY "Non-affiliates can view pending responses" ON public.pending_responses
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view auto response settings" ON public.auto_response_settings;
CREATE POLICY "Non-affiliates can view auto response settings" ON public.auto_response_settings
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all review settings" ON public.review_settings;
CREATE POLICY "Non-affiliates can view review settings" ON public.review_settings
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

-- Restrict affiliates from configuration data
DROP POLICY IF EXISTS "Authenticated users can view all channel weights" ON public.channel_weights;
CREATE POLICY "Non-affiliates can view channel weights" ON public.channel_weights
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view sync logs" ON public.sync_function_logs;
CREATE POLICY "Non-affiliates can view sync logs" ON public.sync_function_logs
FOR SELECT USING (NOT is_affiliate_only(auth.uid()));