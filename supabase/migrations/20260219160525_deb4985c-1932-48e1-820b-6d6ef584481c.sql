
CREATE TABLE public.saved_competitor_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ad_archive_id text NOT NULL,
  page_name text,
  page_id text,
  ad_creative_body text,
  ad_snapshot_url text,
  ad_delivery_start_time text,
  eu_total_reach integer,
  publisher_platforms text[],
  media_type text,
  saved_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE UNIQUE INDEX idx_saved_competitor_ads_user_ad ON public.saved_competitor_ads (user_id, ad_archive_id);

ALTER TABLE public.saved_competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_competitor_ads FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.saved_competitor_ads FROM anon;
REVOKE ALL ON public.saved_competitor_ads FROM public;

CREATE POLICY "Users can view their own saved ads"
  ON public.saved_competitor_ads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save ads"
  ON public.saved_competitor_ads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved ads"
  ON public.saved_competitor_ads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved ads"
  ON public.saved_competitor_ads FOR DELETE
  USING (auth.uid() = user_id);
