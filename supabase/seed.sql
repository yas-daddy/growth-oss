-- GrowthOS demo seed data
-- =========================
-- Populates the core dashboards with synthetic data so you can explore the app
-- WITHOUT connecting any ad platform. Run this AFTER you have:
--   1. pushed the migrations (`supabase db push`), and
--   2. created an account in the app and completed onboarding (creates your org).
--
-- How to run:
--   • Supabase Dashboard → SQL Editor → paste this file → Run, OR
--   • psql "$DATABASE_URL" -f supabase/seed.sql
--
-- It keys off the FIRST registered user and their organization. Safe to re-run:
-- it removes its own demo rows (markers: campaign_id/review_id like 'demo-%',
-- reasoning like 'Demo:%') before re-inserting.
--
-- This covers the spend/channel dashboards, App Ratings, and Recommendations.
-- Funnel/revenue/keyword/creative pages may still be sparse — extend below as needed.

DO $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Sign up in the app first, then re-run this seed.';
    RETURN;
  END IF;

  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;

  -- Make the first user an admin so every page/action is available.
  UPDATE public.user_roles SET role = 'admin' WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. Daily ad spend (90 days × 5 campaigns across 3 platforms)
  --    Drives: total spend, spend-by-channel, installs, the Home page KPIs.
  -- ---------------------------------------------------------------------------
  DELETE FROM public.daily_ad_spend WHERE campaign_id LIKE 'demo-%';

  INSERT INTO public.daily_ad_spend
    (user_id, platform, campaign_id, campaign_name, date, spend, impressions, clicks, installs)
  SELECT
    v_user_id,
    p.platform,
    p.campaign_id,
    p.campaign_name,
    (current_date - g)::date,
    round((p.base_spend  * (0.8 + random() * 0.4))::numeric, 2),
    round((p.base_impr   * (0.8 + random() * 0.4))::numeric)::int,
    round((p.base_clicks * (0.8 + random() * 0.4))::numeric)::int,
    round((p.base_inst   * (0.8 + random() * 0.4))::numeric)::int
  FROM generate_series(1, 89) AS g
  CROSS JOIN (VALUES
    ('meta',   'demo-meta-bau',      'Meta — BAU Prospecting',     1200, 90000,  1800, 60),
    ('meta',   'demo-meta-retarget', 'Meta — Retargeting',          600, 40000,  1200, 45),
    ('apple',  'demo-asa-brand',     'Apple Search Ads — Brand',    400, 20000,   900, 70),
    ('apple',  'demo-asa-generic',   'Apple Search Ads — Generic',  700, 35000,  1100, 55),
    ('moloco', 'demo-moloco-ua',     'Moloco — User Acquisition',   900, 120000, 1500, 50)
  ) AS p(platform, campaign_id, campaign_name, base_spend, base_impr, base_clicks, base_inst);

  -- ---------------------------------------------------------------------------
  -- 2. Conversion event definitions (org-scoped config)
  -- ---------------------------------------------------------------------------
  IF v_org_id IS NOT NULL THEN
    DELETE FROM public.conversion_events
     WHERE org_id = v_org_id AND event_label LIKE '%(demo)%';

    INSERT INTO public.conversion_events (org_id, event_name, event_label, is_primary)
    VALUES
      (v_org_id, 'install',      'App Install (demo)',       false),
      (v_org_id, 'registration', 'Registration (demo)',      false),
      (v_org_id, 'ftd',          'First Deposit (demo)',     true);
  ELSE
    RAISE NOTICE 'No organization found — skipping org-scoped demo data. Complete onboarding, then re-run.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Reviews (App Store / Google Play / Trustpilot) → App Ratings page
  -- ---------------------------------------------------------------------------
  DELETE FROM public.app_store_reviews   WHERE review_id LIKE 'demo-%';
  DELETE FROM public.google_play_reviews WHERE review_id LIKE 'demo-%';
  DELETE FROM public.trustpilot_reviews  WHERE review_id LIKE 'demo-%';

  INSERT INTO public.app_store_reviews
    (user_id, review_id, stars, title, text, author_name, created_at)
  VALUES
    (v_user_id, 'demo-as-1', 5, 'Love it',          'Super smooth and fast. Best in class.',        'Alex',   now() - interval '2 days'),
    (v_user_id, 'demo-as-2', 4, 'Pretty good',      'Works well, would like more chart options.',   'Sam',    now() - interval '6 days'),
    (v_user_id, 'demo-as-3', 2, 'Crashes sometimes','App crashed twice on the latest update.',       'Jordan', now() - interval '9 days'),
    (v_user_id, 'demo-as-4', 5, 'Daily driver',     'I open this every morning. Indispensable.',     'Riya',   now() - interval '14 days');

  INSERT INTO public.google_play_reviews
    (user_id, review_id, stars, title, text, author_name, review_created_at)
  VALUES
    (v_user_id, 'demo-gp-1', 5, 'Excellent',     'Exactly what our growth team needed.',         'Chris', now() - interval '3 days'),
    (v_user_id, 'demo-gp-2', 3, 'Decent',        'Good data but onboarding was confusing.',      'Pat',   now() - interval '7 days'),
    (v_user_id, 'demo-gp-3', 1, 'Login issues',  'Could not sign in for a day. Frustrating.',     'Lee',   now() - interval '11 days');

  INSERT INTO public.trustpilot_reviews
    (user_id, review_id, stars, title, text, consumer_display_name, created_at)
  VALUES
    (v_user_id, 'demo-tp-1', 5, 'Great support',  'The team responded within an hour.',           'Dana',  now() - interval '4 days'),
    (v_user_id, 'demo-tp-2', 4, 'Solid product',  'Reliable and well designed.',                  'Morgan',now() - interval '8 days');

  -- ---------------------------------------------------------------------------
  -- 4. AI recommendations → Recommendations page (pending/active are shown)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.ai_keyword_recommendations        WHERE reasoning LIKE 'Demo:%';
  DELETE FROM public.ai_budget_recommendations         WHERE reasoning LIKE 'Demo:%';
  DELETE FROM public.ai_creative_fatigue_predictions   WHERE reasoning LIKE 'Demo:%';

  INSERT INTO public.ai_keyword_recommendations
    (user_id, keyword_text, recommendation_type, confidence, reasoning, status)
  VALUES
    (v_user_id, 'best betting app', 'increase_bid', 82, 'Demo: strong CVR to FTD at current bid; headroom to scale.', 'pending'),
    (v_user_id, 'free spins',       'decrease_bid', 67, 'Demo: high spend, low downstream conversion.',               'pending'),
    (v_user_id, 'casino bonus',     'pause',        74, 'Demo: no FTDs in 30 days despite consistent spend.',         'pending');

  INSERT INTO public.ai_budget_recommendations
    (user_id, entity_type, entity_id, entity_name, channel, action_type, confidence, reasoning, recommended_action, current_spend, suggested_change, status)
  VALUES
    (v_user_id, 'channel', 'meta',   'Meta Ads',         'Meta Ads',         'increase',   78, 'Demo: blended CPA below target with stable volume.', 'Shift +20% budget to Meta prospecting.', 1800, 20,  'pending'),
    (v_user_id, 'channel', 'moloco', 'Moloco Ads',       'Moloco Ads',       'decrease',   71, 'Demo: rising CPI over the last 2 weeks.',            'Reduce Moloco budget by 15%.',           900, -15, 'pending');

  INSERT INTO public.ai_creative_fatigue_predictions
    (user_id, creative_id, creative_name, platform, fatigue_status, confidence, days_until_fatigue, reasoning, recommended_action, status)
  VALUES
    (v_user_id, 'demo-cr-1', 'Hero Video — FA Cup',   'meta',   'fatiguing',     80, 5,    'Demo: CTR down 28% week-over-week.',         'Refresh creative within ~5 days.',   'active'),
    (v_user_id, 'demo-cr-2', 'Static — Welcome Offer','moloco', 'early_warning', 64, 12,   'Demo: early signs of frequency saturation.', 'Prepare a variant to rotate in.',    'active');

  RAISE NOTICE 'GrowthOS demo data seeded for user %, org %.', v_user_id, COALESCE(v_org_id::text, '(none)');
END $$;
