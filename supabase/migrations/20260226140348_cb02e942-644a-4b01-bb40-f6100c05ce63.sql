
-- Create compliance_rules table
CREATE TABLE public.compliance_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_types TEXT[] NOT NULL DEFAULT '{email,image,video}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.compliance_rules FROM anon, public;
GRANT SELECT ON public.compliance_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.compliance_rules TO authenticated;

CREATE POLICY "Authenticated users can read compliance rules"
  ON public.compliance_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert compliance rules"
  ON public.compliance_rules FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update compliance rules"
  ON public.compliance_rules FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete compliance rules"
  ON public.compliance_rules FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed default rules
INSERT INTO public.compliance_rules (label, description, sort_order, content_types) VALUES
  ('No young persons', 'No young persons (under 25) appear in the content. Characters must look clearly over 25 years old.', 1, '{email,image,video}'),
  ('18+ GambleAware visible', 'The 18+ logo and GambleAware messaging must be visible throughout the content, typically in header or footer.', 2, '{email,image,video}'),
  ('Terms are clear and compliant', 'All terms and conditions, wagering requirements, and offer details are clearly stated and not misleading.', 3, '{email,image,video}'),
  ('Not presented as financial solution', 'Gambling is not being presented as a solution to financial difficulties or as a way to make money.', 4, '{email,image,video}'),
  ('Not correlated with sexual success', 'Gambling is not being correlated with sexual success, attractiveness, or romantic outcomes.', 5, '{email,image,video}'),
  ('Does not appeal to young demographics', 'The content does not use themes, imagery, language, or characters that would primarily appeal to under-18s.', 6, '{email,image,video}'),
  ('Not pushy or aggressive', 'The advert is not pushy, aggressive, or creating undue pressure to gamble. No urgency tactics.', 7, '{email,image,video}'),
  ('Claims are substantiated', 'All claims made in the content are substantiated and verifiable. No misleading statistics or promises.', 8, '{email,image,video}');

-- Create compliance_checks table
CREATE TABLE public.compliance_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  overall_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.compliance_checks FROM anon, public;
GRANT SELECT, INSERT ON public.compliance_checks TO authenticated;

CREATE POLICY "Users can read own compliance checks"
  ON public.compliance_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own compliance checks"
  ON public.compliance_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for compliance uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-uploads', 'compliance-uploads', false);

CREATE POLICY "Authenticated users can upload compliance files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'compliance-uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Users can read own compliance uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'compliance-uploads' AND auth.role() = 'authenticated');

-- Trigger for updated_at on compliance_rules
CREATE TRIGGER update_compliance_rules_updated_at
  BEFORE UPDATE ON public.compliance_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
