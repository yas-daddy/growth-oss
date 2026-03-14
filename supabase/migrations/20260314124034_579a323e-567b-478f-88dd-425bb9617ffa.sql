-- Fix: allow org creator to read their own org (needed for insert().select())
DROP POLICY "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members and creators can view their organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id = ANY (get_user_org_ids(auth.uid()))
    OR created_by = auth.uid()
    OR is_super_admin(auth.uid())
  );