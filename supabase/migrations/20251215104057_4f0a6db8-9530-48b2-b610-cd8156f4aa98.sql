-- Ensure RLS is enabled and forced on campaign tables
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apple_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moloco_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meta_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.apple_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.moloco_campaigns FORCE ROW LEVEL SECURITY;

-- Revoke all access from anonymous/public roles
REVOKE ALL ON public.meta_campaigns FROM anon, public;
REVOKE ALL ON public.apple_campaigns FROM anon, public;
REVOKE ALL ON public.moloco_campaigns FROM anon, public;

-- Grant SELECT to authenticated role (RLS policies will still restrict access)
GRANT SELECT ON public.meta_campaigns TO authenticated;
GRANT SELECT ON public.apple_campaigns TO authenticated;
GRANT SELECT ON public.moloco_campaigns TO authenticated;