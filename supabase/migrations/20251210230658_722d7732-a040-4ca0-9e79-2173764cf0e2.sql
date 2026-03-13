-- Update RLS policies for shared data access
-- All authenticated users can read, owners/admins can write

-- affiliates
DROP POLICY IF EXISTS "Users can view their own affiliates" ON public.affiliates;
CREATE POLICY "Authenticated users can view all affiliates" ON public.affiliates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own affiliates" ON public.affiliates;
CREATE POLICY "Admins can create affiliates" ON public.affiliates
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own affiliates" ON public.affiliates;
CREATE POLICY "Admins can update affiliates" ON public.affiliates
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own affiliates" ON public.affiliates;
CREATE POLICY "Admins can delete affiliates" ON public.affiliates
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- app_store_reviews
DROP POLICY IF EXISTS "Users can view their own app store reviews" ON public.app_store_reviews;
CREATE POLICY "Authenticated users can view all app store reviews" ON public.app_store_reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own app store reviews" ON public.app_store_reviews;
CREATE POLICY "Admins can create app store reviews" ON public.app_store_reviews
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own app store reviews" ON public.app_store_reviews;
CREATE POLICY "Admins can update app store reviews" ON public.app_store_reviews
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own app store reviews" ON public.app_store_reviews;
CREATE POLICY "Admins can delete app store reviews" ON public.app_store_reviews
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- apple_campaigns
DROP POLICY IF EXISTS "Users can view their own apple campaigns" ON public.apple_campaigns;
CREATE POLICY "Authenticated users can view all apple campaigns" ON public.apple_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own apple campaigns" ON public.apple_campaigns;
CREATE POLICY "Admins can create apple campaigns" ON public.apple_campaigns
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own apple campaigns" ON public.apple_campaigns;
CREATE POLICY "Admins can update apple campaigns" ON public.apple_campaigns
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own apple campaigns" ON public.apple_campaigns;
CREATE POLICY "Admins can delete apple campaigns" ON public.apple_campaigns
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- appsflyer_campaigns
DROP POLICY IF EXISTS "Users can view their own appsflyer campaigns" ON public.appsflyer_campaigns;
CREATE POLICY "Authenticated users can view all appsflyer campaigns" ON public.appsflyer_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own appsflyer campaigns" ON public.appsflyer_campaigns;
CREATE POLICY "Admins can create appsflyer campaigns" ON public.appsflyer_campaigns
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own appsflyer campaigns" ON public.appsflyer_campaigns;
CREATE POLICY "Admins can update appsflyer campaigns" ON public.appsflyer_campaigns
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own appsflyer campaigns" ON public.appsflyer_campaigns;
CREATE POLICY "Admins can delete appsflyer campaigns" ON public.appsflyer_campaigns
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- appsflyer_events
DROP POLICY IF EXISTS "Users can view their own appsflyer events" ON public.appsflyer_events;
CREATE POLICY "Authenticated users can view all appsflyer events" ON public.appsflyer_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own appsflyer events" ON public.appsflyer_events;
CREATE POLICY "Admins can create appsflyer events" ON public.appsflyer_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own appsflyer events" ON public.appsflyer_events;
CREATE POLICY "Admins can update appsflyer events" ON public.appsflyer_events
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own appsflyer events" ON public.appsflyer_events;
CREATE POLICY "Admins can delete appsflyer events" ON public.appsflyer_events
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- attributed_users
DROP POLICY IF EXISTS "Users can view their own attributed users" ON public.attributed_users;
CREATE POLICY "Authenticated users can view all attributed users" ON public.attributed_users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own attributed users" ON public.attributed_users;
CREATE POLICY "Admins can create attributed users" ON public.attributed_users
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own attributed users" ON public.attributed_users;
CREATE POLICY "Admins can update attributed users" ON public.attributed_users
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own attributed users" ON public.attributed_users;
CREATE POLICY "Admins can delete attributed users" ON public.attributed_users
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- channel_weights
DROP POLICY IF EXISTS "Users can view their own channel weights" ON public.channel_weights;
CREATE POLICY "Authenticated users can view all channel weights" ON public.channel_weights
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own channel weights" ON public.channel_weights;
CREATE POLICY "Admins can create channel weights" ON public.channel_weights
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own channel weights" ON public.channel_weights;
CREATE POLICY "Admins can update channel weights" ON public.channel_weights
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- daily_ad_spend
DROP POLICY IF EXISTS "Users can view their own daily spend" ON public.daily_ad_spend;
CREATE POLICY "Authenticated users can view all daily spend" ON public.daily_ad_spend
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own daily spend" ON public.daily_ad_spend;
CREATE POLICY "Admins can create daily spend" ON public.daily_ad_spend
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own daily spend" ON public.daily_ad_spend;
CREATE POLICY "Admins can update daily spend" ON public.daily_ad_spend
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own daily spend" ON public.daily_ad_spend;
CREATE POLICY "Admins can delete daily spend" ON public.daily_ad_spend
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- daily_affiliate_spend
DROP POLICY IF EXISTS "Users can view their own affiliate spend" ON public.daily_affiliate_spend;
CREATE POLICY "Authenticated users can view all affiliate spend" ON public.daily_affiliate_spend
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own affiliate spend" ON public.daily_affiliate_spend;
CREATE POLICY "Admins can create affiliate spend" ON public.daily_affiliate_spend
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own affiliate spend" ON public.daily_affiliate_spend;
CREATE POLICY "Admins can update affiliate spend" ON public.daily_affiliate_spend
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own affiliate spend" ON public.daily_affiliate_spend;
CREATE POLICY "Admins can delete affiliate spend" ON public.daily_affiliate_spend
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- google_play_reviews
DROP POLICY IF EXISTS "Users can view their own google play reviews" ON public.google_play_reviews;
CREATE POLICY "Authenticated users can view all google play reviews" ON public.google_play_reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own google play reviews" ON public.google_play_reviews;
CREATE POLICY "Admins can create google play reviews" ON public.google_play_reviews
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own google play reviews" ON public.google_play_reviews;
CREATE POLICY "Admins can update google play reviews" ON public.google_play_reviews
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own google play reviews" ON public.google_play_reviews;
CREATE POLICY "Admins can delete google play reviews" ON public.google_play_reviews
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- meta_campaigns
DROP POLICY IF EXISTS "Users can view their own meta campaigns" ON public.meta_campaigns;
CREATE POLICY "Authenticated users can view all meta campaigns" ON public.meta_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own meta campaigns" ON public.meta_campaigns;
CREATE POLICY "Admins can create meta campaigns" ON public.meta_campaigns
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own meta campaigns" ON public.meta_campaigns;
CREATE POLICY "Admins can update meta campaigns" ON public.meta_campaigns
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own meta campaigns" ON public.meta_campaigns;
CREATE POLICY "Admins can delete meta campaigns" ON public.meta_campaigns
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- mixpanel_events
DROP POLICY IF EXISTS "Users can view their own mixpanel events" ON public.mixpanel_events;
CREATE POLICY "Authenticated users can view all mixpanel events" ON public.mixpanel_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own mixpanel events" ON public.mixpanel_events;
CREATE POLICY "Admins can create mixpanel events" ON public.mixpanel_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own mixpanel events" ON public.mixpanel_events;
CREATE POLICY "Admins can update mixpanel events" ON public.mixpanel_events
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own mixpanel events" ON public.mixpanel_events;
CREATE POLICY "Admins can delete mixpanel events" ON public.mixpanel_events
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- mixpanel_user_ltv
DROP POLICY IF EXISTS "Users can view their own mixpanel ltv" ON public.mixpanel_user_ltv;
CREATE POLICY "Authenticated users can view all mixpanel ltv" ON public.mixpanel_user_ltv
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own mixpanel ltv" ON public.mixpanel_user_ltv;
CREATE POLICY "Admins can create mixpanel ltv" ON public.mixpanel_user_ltv
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own mixpanel ltv" ON public.mixpanel_user_ltv;
CREATE POLICY "Admins can update mixpanel ltv" ON public.mixpanel_user_ltv
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own mixpanel ltv" ON public.mixpanel_user_ltv;
CREATE POLICY "Admins can delete mixpanel ltv" ON public.mixpanel_user_ltv
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- moloco_campaigns
DROP POLICY IF EXISTS "Users can view their own moloco campaigns" ON public.moloco_campaigns;
CREATE POLICY "Authenticated users can view all moloco campaigns" ON public.moloco_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own moloco campaigns" ON public.moloco_campaigns;
CREATE POLICY "Admins can create moloco campaigns" ON public.moloco_campaigns
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own moloco campaigns" ON public.moloco_campaigns;
CREATE POLICY "Admins can update moloco campaigns" ON public.moloco_campaigns
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own moloco campaigns" ON public.moloco_campaigns;
CREATE POLICY "Admins can delete moloco campaigns" ON public.moloco_campaigns
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- review_settings
DROP POLICY IF EXISTS "Users can view their own review settings" ON public.review_settings;
CREATE POLICY "Authenticated users can view all review settings" ON public.review_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own review settings" ON public.review_settings;
CREATE POLICY "Admins can create review settings" ON public.review_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own review settings" ON public.review_settings;
CREATE POLICY "Admins can update review settings" ON public.review_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- trustpilot_reviews
DROP POLICY IF EXISTS "Users can view their own trustpilot reviews" ON public.trustpilot_reviews;
CREATE POLICY "Authenticated users can view all trustpilot reviews" ON public.trustpilot_reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own trustpilot reviews" ON public.trustpilot_reviews;
CREATE POLICY "Admins can create trustpilot reviews" ON public.trustpilot_reviews
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own trustpilot reviews" ON public.trustpilot_reviews;
CREATE POLICY "Admins can update trustpilot reviews" ON public.trustpilot_reviews
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own trustpilot reviews" ON public.trustpilot_reviews;
CREATE POLICY "Admins can delete trustpilot reviews" ON public.trustpilot_reviews
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- user_identity_map
DROP POLICY IF EXISTS "Users can view their own identity mappings" ON public.user_identity_map;
CREATE POLICY "Authenticated users can view all identity mappings" ON public.user_identity_map
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own identity mappings" ON public.user_identity_map;
CREATE POLICY "Admins can create identity mappings" ON public.user_identity_map
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own identity mappings" ON public.user_identity_map;
CREATE POLICY "Admins can update identity mappings" ON public.user_identity_map
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- profiles - admins can view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);