-- Google Search Console daily metrics
CREATE TABLE public.google_search_console_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(5,4),
  position NUMERIC(5,2),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE public.google_search_console_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read search console metrics"
ON public.google_search_console_metrics
FOR SELECT
TO authenticated
USING (true);

-- App Store organic install metrics
CREATE TABLE public.appstore_organic_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source_type TEXT NOT NULL, -- 'app_store_search', 'app_store_browse', etc.
  downloads INTEGER NOT NULL DEFAULT 0,
  first_time_downloads INTEGER,
  redownloads INTEGER,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, source_type)
);

-- Enable RLS
ALTER TABLE public.appstore_organic_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read appstore organic metrics"
ON public.appstore_organic_metrics
FOR SELECT
TO authenticated
USING (true);

-- Daily NPS tracking (aggregated from typeform)
CREATE TABLE public.daily_nps_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  promoters INTEGER NOT NULL DEFAULT 0,
  passives INTEGER NOT NULL DEFAULT 0,
  detractors INTEGER NOT NULL DEFAULT 0,
  nps_score NUMERIC(5,2),
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_nps_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read NPS metrics"
ON public.daily_nps_metrics
FOR SELECT
TO authenticated
USING (true);

-- Create indexes for efficient querying
CREATE INDEX idx_gsc_metrics_date ON public.google_search_console_metrics(date DESC);
CREATE INDEX idx_appstore_organic_date ON public.appstore_organic_metrics(date DESC);
CREATE INDEX idx_daily_nps_date ON public.daily_nps_metrics(date DESC);