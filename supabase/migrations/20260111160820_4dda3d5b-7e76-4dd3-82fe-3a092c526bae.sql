-- Drop the deprecated meta_connections table that contains exposed API tokens
-- This table is no longer needed as META_ACCESS_TOKEN is configured as a secure secret

-- First drop any policies
DROP POLICY IF EXISTS "Admins can view all meta connections" ON public.meta_connections;
DROP POLICY IF EXISTS "Users can insert their own meta connection" ON public.meta_connections;
DROP POLICY IF EXISTS "Users can update their own meta connection" ON public.meta_connections;
DROP POLICY IF EXISTS "Users can delete their own meta connection" ON public.meta_connections;

-- Drop the trigger
DROP TRIGGER IF EXISTS update_meta_connections_updated_at ON public.meta_connections;

-- Drop the table
DROP TABLE IF EXISTS public.meta_connections;