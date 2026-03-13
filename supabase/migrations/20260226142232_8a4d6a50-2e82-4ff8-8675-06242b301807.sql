-- Allow all authenticated users to view all compliance checks (for shared history)
DROP POLICY IF EXISTS "Users can read own compliance checks" ON public.compliance_checks;

CREATE POLICY "Authenticated users can view all compliance checks"
ON public.compliance_checks
FOR SELECT
USING (auth.role() = 'authenticated');
