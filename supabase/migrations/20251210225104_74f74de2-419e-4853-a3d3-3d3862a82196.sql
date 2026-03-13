-- Create table to link affiliate users to specific affiliates
CREATE TABLE public.affiliate_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, affiliate_id)
);

-- Enable RLS
ALTER TABLE public.affiliate_user_access ENABLE ROW LEVEL SECURITY;

-- Only admins can manage affiliate access
CREATE POLICY "Admins can manage affiliate access"
ON public.affiliate_user_access
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Affiliate users can view their own access
CREATE POLICY "Users can view their own affiliate access"
ON public.affiliate_user_access
FOR SELECT
USING (auth.uid() = user_id);

-- Create invitations table for pending user invites
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (email)
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update the handle_new_user function to check for pending invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Check for pending invitation
  SELECT * INTO invitation_record 
  FROM public.user_invitations 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now()
  LIMIT 1;
  
  IF invitation_record IS NOT NULL THEN
    -- Use invited role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invitation_record.role);
    
    -- If affiliate role, create affiliate access
    IF invitation_record.role = 'affiliate' AND invitation_record.affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_user_access (user_id, affiliate_id)
      VALUES (NEW.id, invitation_record.affiliate_id);
    END IF;
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations 
    SET accepted_at = now() 
    WHERE id = invitation_record.id;
  ELSE
    -- Default to viewer role for uninvited users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer');
  END IF;
  
  RETURN NEW;
END;
$$;