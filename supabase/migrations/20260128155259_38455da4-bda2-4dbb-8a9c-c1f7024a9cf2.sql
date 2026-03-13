-- Football Teams table
CREATE TABLE public.football_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_team_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  short_name text,
  tla text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ad Templates table
CREATE TABLE public.ad_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  background_image_url text,
  width integer DEFAULT 1080,
  height integer DEFAULT 1080,
  elements jsonb NOT NULL DEFAULT '[]',
  terms_text text,
  cta_text text DEFAULT 'Bet Now',
  destination_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Football Fixtures table
CREATE TABLE public.football_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_fixture_id integer UNIQUE NOT NULL,
  home_team_id uuid REFERENCES public.football_teams(id),
  away_team_id uuid REFERENCES public.football_teams(id),
  match_date timestamptz NOT NULL,
  competition text DEFAULT 'Premier League',
  status text DEFAULT 'SCHEDULED',
  home_odds decimal(5,2),
  draw_odds decimal(5,2),
  away_odds decimal(5,2),
  odds_fetched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Generated Football Ads table
CREATE TABLE public.generated_football_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid REFERENCES public.football_fixtures(id),
  template_id uuid REFERENCES public.ad_templates(id),
  generated_image_url text,
  meta_ad_id text,
  meta_creative_id text,
  status text DEFAULT 'pending',
  error_message text,
  scheduled_pause_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.football_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_football_ads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for football_teams (read by authenticated, write by admin)
CREATE POLICY "Authenticated users can view football teams"
ON public.football_teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage football teams"
ON public.football_teams FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ad_templates
CREATE POLICY "Authenticated users can view ad templates"
ON public.ad_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage ad templates"
ON public.ad_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for football_fixtures
CREATE POLICY "Authenticated users can view football fixtures"
ON public.football_fixtures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage football fixtures"
ON public.football_fixtures FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for generated_football_ads
CREATE POLICY "Authenticated users can view generated ads"
ON public.generated_football_ads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage generated ads"
ON public.generated_football_ads FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('football-team-images', 'football-team-images', true),
  ('football-ad-backgrounds', 'football-ad-backgrounds', true),
  ('generated-football-ads', 'generated-football-ads', true);

-- Storage policies for football-team-images
CREATE POLICY "Public can view team images"
ON storage.objects FOR SELECT
USING (bucket_id = 'football-team-images');

CREATE POLICY "Admins can upload team images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'football-team-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update team images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'football-team-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete team images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'football-team-images' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for football-ad-backgrounds
CREATE POLICY "Public can view ad backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'football-ad-backgrounds');

CREATE POLICY "Admins can upload ad backgrounds"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'football-ad-backgrounds' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ad backgrounds"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'football-ad-backgrounds' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ad backgrounds"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'football-ad-backgrounds' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for generated-football-ads
CREATE POLICY "Public can view generated ads"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-football-ads');

CREATE POLICY "Admins can upload generated ads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-football-ads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update generated ads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-football-ads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete generated ads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-football-ads' AND public.has_role(auth.uid(), 'admin'));