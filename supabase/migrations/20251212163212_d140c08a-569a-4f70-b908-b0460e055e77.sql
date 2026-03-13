-- App Store average rating
CREATE OR REPLACE FUNCTION public.get_report_avg_rating_app_store(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(AVG(stars), 0)::numeric as value,
    0::numeric as previous_value
  FROM app_store_reviews
  WHERE created_at >= start_date::timestamp
    AND created_at < (end_date + 1)::timestamp;
$$;

-- Google Play average rating
CREATE OR REPLACE FUNCTION public.get_report_avg_rating_google_play(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(AVG(stars), 0)::numeric as value,
    0::numeric as previous_value
  FROM google_play_reviews
  WHERE review_created_at >= start_date::timestamp
    AND review_created_at < (end_date + 1)::timestamp;
$$;

-- Trustpilot average rating
CREATE OR REPLACE FUNCTION public.get_report_avg_rating_trustpilot(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(AVG(stars), 0)::numeric as value,
    0::numeric as previous_value
  FROM trustpilot_reviews
  WHERE created_at >= start_date::timestamp
    AND created_at < (end_date + 1)::timestamp;
$$;

-- Weighted average rating across all platforms
CREATE OR REPLACE FUNCTION public.get_report_avg_rating_blended(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH weights AS (
    SELECT 
      COALESCE(app_store_weight, 1) as app_store_w,
      COALESCE(google_play_weight, 1) as google_play_w,
      COALESCE(trustpilot_weight, 1) as trustpilot_w
    FROM channel_weights
    LIMIT 1
  ),
  default_weights AS (
    SELECT 1::numeric as app_store_w, 1::numeric as google_play_w, 1::numeric as trustpilot_w
  ),
  final_weights AS (
    SELECT * FROM weights
    UNION ALL
    SELECT * FROM default_weights WHERE NOT EXISTS (SELECT 1 FROM weights)
    LIMIT 1
  ),
  app_store_avg AS (
    SELECT COALESCE(AVG(stars), 0) as avg_rating, COUNT(*) as cnt
    FROM app_store_reviews
    WHERE created_at >= start_date::timestamp
      AND created_at < (end_date + 1)::timestamp
  ),
  google_play_avg AS (
    SELECT COALESCE(AVG(stars), 0) as avg_rating, COUNT(*) as cnt
    FROM google_play_reviews
    WHERE review_created_at >= start_date::timestamp
      AND review_created_at < (end_date + 1)::timestamp
  ),
  trustpilot_avg AS (
    SELECT COALESCE(AVG(stars), 0) as avg_rating, COUNT(*) as cnt
    FROM trustpilot_reviews
    WHERE created_at >= start_date::timestamp
      AND created_at < (end_date + 1)::timestamp
  )
  SELECT 
    CASE 
      WHEN (
        (SELECT cnt FROM app_store_avg) + 
        (SELECT cnt FROM google_play_avg) + 
        (SELECT cnt FROM trustpilot_avg)
      ) = 0 THEN 0
      ELSE (
        (SELECT avg_rating FROM app_store_avg) * (SELECT app_store_w FROM final_weights) * CASE WHEN (SELECT cnt FROM app_store_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT avg_rating FROM google_play_avg) * (SELECT google_play_w FROM final_weights) * CASE WHEN (SELECT cnt FROM google_play_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT avg_rating FROM trustpilot_avg) * (SELECT trustpilot_w FROM final_weights) * CASE WHEN (SELECT cnt FROM trustpilot_avg) > 0 THEN 1 ELSE 0 END
      ) / NULLIF(
        (SELECT app_store_w FROM final_weights) * CASE WHEN (SELECT cnt FROM app_store_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT google_play_w FROM final_weights) * CASE WHEN (SELECT cnt FROM google_play_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT trustpilot_w FROM final_weights) * CASE WHEN (SELECT cnt FROM trustpilot_avg) > 0 THEN 1 ELSE 0 END,
        0
      )
    END::numeric as value,
    0::numeric as previous_value;
$$;

-- Insert report definitions
INSERT INTO report_definitions (slug, name, description, category, report_type, data_source, config)
VALUES 
  ('avg-rating-app-store', 'App Store Rating', 'Average App Store rating', 'ratings', 'kpi', 'get_report_avg_rating_app_store', '{"format": "number", "subtitle": "App Store", "icon": "Apple"}'),
  ('avg-rating-google-play', 'Google Play Rating', 'Average Google Play rating', 'ratings', 'kpi', 'get_report_avg_rating_google_play', '{"format": "number", "subtitle": "Google Play", "icon": "Play"}'),
  ('avg-rating-trustpilot', 'Trustpilot Rating', 'Average Trustpilot rating', 'ratings', 'kpi', 'get_report_avg_rating_trustpilot', '{"format": "number", "subtitle": "Trustpilot", "icon": "Star"}'),
  ('avg-rating-blended', 'Blended Rating', 'Weighted average across all platforms', 'ratings', 'kpi', 'get_report_avg_rating_blended', '{"format": "number", "subtitle": "All platforms", "icon": "Star"}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  data_source = EXCLUDED.data_source,
  config = EXCLUDED.config;