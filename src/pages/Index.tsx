import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const { isAffiliate, affiliateIds, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    // Once auth and role are loaded, redirect to appropriate dashboard
    if (!loading && !roleLoading && user) {
      if (isAffiliate && affiliateIds.length > 0) {
        navigate(`/settings/affiliates/${affiliateIds[0]}`, { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, loading, roleLoading, isAffiliate, affiliateIds, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
