import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useOrganization } from '@/hooks/useOrganization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const { isAffiliate, affiliateIds, isLoading: roleLoading } = useUserRole();
  const { organization, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  // Check onboarding status
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-onboarding', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (!loading && !roleLoading && !orgLoading && !profileLoading && user) {
      // If onboarding not completed or no org, go to onboarding
      if (!profile?.onboarding_completed || !organization) {
        navigate('/onboarding', { replace: true });
        return;
      }

      if (isAffiliate && affiliateIds.length > 0) {
        navigate(`/settings/affiliates/${affiliateIds[0]}`, { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, loading, roleLoading, orgLoading, profileLoading, isAffiliate, affiliateIds, organization, profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
