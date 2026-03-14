-- Fix org_members INSERT policy to allow first member (org creator) to add themselves
DROP POLICY "Org admins can add members" ON public.organization_members;
CREATE POLICY "Org admins and creators can add members"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_admin(auth.uid(), org_id)
    OR (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = org_id AND created_by = auth.uid()
      )
    )
    OR is_super_admin(auth.uid())
  );

-- Also let super admins view all org members
DROP POLICY "Members can view org members" ON public.organization_members;
CREATE POLICY "Members can view org members"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(auth.uid(), org_id)
    OR is_super_admin(auth.uid())
  );