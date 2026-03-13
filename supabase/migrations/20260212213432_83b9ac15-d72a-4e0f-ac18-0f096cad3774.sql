
CREATE TABLE public.football_team_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.football_teams(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE public.football_team_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_team_scores FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.football_team_scores FROM anon;
REVOKE ALL ON public.football_team_scores FROM public;
GRANT SELECT ON public.football_team_scores TO authenticated;
GRANT INSERT, UPDATE ON public.football_team_scores TO authenticated;

CREATE POLICY "Authenticated users can view team scores"
  ON public.football_team_scores FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage team scores"
  ON public.football_team_scores FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
