-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own search terms" ON public.apple_search_terms;

-- Create a permissive SELECT policy that allows all authenticated users to view
CREATE POLICY "Users can view all apple search terms" 
  ON public.apple_search_terms 
  FOR SELECT 
  USING (true);