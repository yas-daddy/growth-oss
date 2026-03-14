
-- Add org_id column to review_settings
ALTER TABLE public.review_settings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Clear existing review_settings data so orgs start fresh
DELETE FROM public.review_settings;

-- Drop old unique constraint on user_id and add new unique on org_id
ALTER TABLE public.review_settings DROP CONSTRAINT IF EXISTS review_settings_user_id_key;
ALTER TABLE public.review_settings ADD CONSTRAINT review_settings_org_id_key UNIQUE (org_id);

-- Make org_id NOT NULL after clearing data
ALTER TABLE public.review_settings ALTER COLUMN org_id SET NOT NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Non-affiliates can view review settings" ON public.review_settings;
DROP POLICY IF EXISTS "Authenticated users can view all review settings" ON public.review_settings;
DROP POLICY IF EXISTS "Admins can create review settings" ON public.review_settings;
DROP POLICY IF EXISTS "Admins can update review settings" ON public.review_settings;

-- Create org-scoped RLS policies
CREATE POLICY "Org members can view review settings" ON public.review_settings
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create review settings" ON public.review_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update review settings" ON public.review_settings
  FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid(), org_id));
