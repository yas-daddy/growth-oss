CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invitation_record RECORD;
BEGIN
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');

  IF invitation_record IS NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invitation_record.role);
    IF invitation_record.role = 'affiliate' AND invitation_record.affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_user_access (user_id, affiliate_id)
      VALUES (NEW.id, invitation_record.affiliate_id);
    END IF;
    UPDATE public.user_invitations SET accepted_at = now() WHERE id = invitation_record.id;
  END IF;

  RETURN NEW;
END;
$function$;