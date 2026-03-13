-- Update handle_new_user to enforce invite-only signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check for pending invitation (REQUIRED for signup)
  SELECT * INTO invitation_record 
  FROM public.user_invitations 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now()
  LIMIT 1;
  
  -- Reject signup if no valid invitation exists
  IF invitation_record IS NULL THEN
    RAISE EXCEPTION 'Signup not allowed. You must be invited to create an account.';
  END IF;
  
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
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
  
  RETURN NEW;
END;
$function$;