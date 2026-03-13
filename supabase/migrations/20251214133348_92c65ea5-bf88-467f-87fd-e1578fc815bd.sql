-- Create typeform_surveys table to store survey responses
CREATE TABLE public.typeform_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id text NOT NULL UNIQUE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  nps_score integer CHECK (nps_score >= 0 AND nps_score <= 10),
  disappointment_score integer CHECK (disappointment_score >= 1 AND disappointment_score <= 5),
  feedback_text text,
  primary_benefit text,
  acquisition_source text,
  has_invited_friends boolean DEFAULT false,
  email text,
  submitted_at timestamp with time zone NOT NULL,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add typeform_weight to channel_weights table
ALTER TABLE public.channel_weights 
ADD COLUMN typeform_weight numeric NOT NULL DEFAULT 1;

-- Enable RLS
ALTER TABLE public.typeform_surveys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage typeform surveys"
ON public.typeform_surveys
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view typeform surveys"
ON public.typeform_surveys
FOR SELECT
USING (true);

-- Create RPC function for Typeform average rating
CREATE OR REPLACE FUNCTION public.get_report_avg_rating_typeform(start_date date, end_date date)
RETURNS TABLE(value numeric, previous_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(AVG(rating), 0)::numeric as value,
    0::numeric as previous_value
  FROM typeform_surveys
  WHERE submitted_at >= start_date::timestamp
    AND submitted_at < (end_date + 1)::timestamp;
$$;

-- Update blended rating function to include Typeform
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
      COALESCE(trustpilot_weight, 1) as trustpilot_w,
      COALESCE(typeform_weight, 1) as typeform_w
    FROM channel_weights
    LIMIT 1
  ),
  default_weights AS (
    SELECT 1::numeric as app_store_w, 1::numeric as google_play_w, 1::numeric as trustpilot_w, 1::numeric as typeform_w
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
  ),
  typeform_avg AS (
    SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as cnt
    FROM typeform_surveys
    WHERE submitted_at >= start_date::timestamp
      AND submitted_at < (end_date + 1)::timestamp
  )
  SELECT 
    CASE 
      WHEN (
        (SELECT cnt FROM app_store_avg) + 
        (SELECT cnt FROM google_play_avg) + 
        (SELECT cnt FROM trustpilot_avg) +
        (SELECT cnt FROM typeform_avg)
      ) = 0 THEN 0
      ELSE (
        (SELECT avg_rating FROM app_store_avg) * (SELECT app_store_w FROM final_weights) * CASE WHEN (SELECT cnt FROM app_store_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT avg_rating FROM google_play_avg) * (SELECT google_play_w FROM final_weights) * CASE WHEN (SELECT cnt FROM google_play_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT avg_rating FROM trustpilot_avg) * (SELECT trustpilot_w FROM final_weights) * CASE WHEN (SELECT cnt FROM trustpilot_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT avg_rating FROM typeform_avg) * (SELECT typeform_w FROM final_weights) * CASE WHEN (SELECT cnt FROM typeform_avg) > 0 THEN 1 ELSE 0 END
      ) / NULLIF(
        (SELECT app_store_w FROM final_weights) * CASE WHEN (SELECT cnt FROM app_store_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT google_play_w FROM final_weights) * CASE WHEN (SELECT cnt FROM google_play_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT trustpilot_w FROM final_weights) * CASE WHEN (SELECT cnt FROM trustpilot_avg) > 0 THEN 1 ELSE 0 END +
        (SELECT typeform_w FROM final_weights) * CASE WHEN (SELECT cnt FROM typeform_avg) > 0 THEN 1 ELSE 0 END,
        0
      )
    END::numeric as value,
    0::numeric as previous_value;
$$;