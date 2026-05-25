# Allow open signup — any user can create an account and an organization

## Current state
- Signup is gated by `handle_new_user()` trigger which raises an exception if there's no matching row in `user_invitations`.
- `src/pages/Auth.tsx` shows "Invitation Required" toasts and an "Have an invitation?" hint.
- The onboarding flow at `/onboarding` already handles creating an organization for any logged-in user without one — no changes needed there.
- `shouldCreateUser: false` in `signInWithOtp` is for magic-link sign-in only and is fine to leave (magic links shouldn't auto-create accounts; the signup form is the entry point).

## Changes

### 1. Database migration — relax `handle_new_user()`
Update the trigger so it:
- Still honors a pending invitation when present (uses invited role + affiliate access, marks invitation accepted).
- If no invitation exists, just creates the profile and assigns the default `'user'` role instead of raising.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;
```

### 2. `src/pages/Auth.tsx`
- Remove the "Signup not allowed" / "Invitation Required" branch in the signup error handler (no longer reachable).
- Remove the "Have an invitation?" helper text near line 305.

No other code or onboarding changes — `/onboarding` will pick up newly signed-up users and let them create their org as it does today.

## Notes
- Email verification stays on (Supabase default) — users must confirm email before signing in. If you'd prefer auto-confirm so new users land straight in the app, say the word and I'll flip that too.
- Existing invitation flow keeps working unchanged for admins inviting affiliates / specific roles.
