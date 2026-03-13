import { ReactNode, useEffect, useRef } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { usePageVisitTracker } from '@/hooks/usePageVisitTracker';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/ads': 'Ad Platforms',
  '/affiliates': 'Affiliates',
  '/funnel': 'Funnel Analytics',
  '/ratings': 'Review Manager',
  '/settings': 'Settings',
  '/projections': 'Projections',
  '/weekly': 'Weekly Tracker',
  '/monthly': 'Monthly Tracker',
  '/launch-ads': 'Launch Ads',
  '/top-ads': 'Top Ads',
  '/creative-analysis': 'Creative Analysis',
  '/keyword-analysis': 'Keyword Analysis',
  '/recommendations': 'AI Recommendations',
  '/brand-visibility': 'Brand Score',
  '/email-campaigns': 'Canvas Scheduler',
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAffiliate, affiliateIds, isLoading: roleLoading } = useUserRole();
  const { trackVisit } = usePageVisitTracker();
  const prevPathRef = useRef<string | null>(null);
  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  // Track page visits on route change
  useEffect(() => {
    if (user && location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      trackVisit(location.pathname);
    }
  }, [user, location.pathname, trackVisit]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Redirect affiliates to their dashboard if they try to access other pages
  useEffect(() => {
    if (!authLoading && !roleLoading && user && isAffiliate && affiliateIds.length > 0) {
      const allowedPath = `/settings/affiliates/${affiliateIds[0]}`;
      
      // If affiliate is on any page other than their dashboard, redirect them
      if (!location.pathname.startsWith('/settings/affiliates/')) {
        navigate(allowedPath, { replace: true });
      } else if (location.pathname.startsWith('/settings/affiliates/')) {
        // Check if they're trying to access another affiliate's dashboard
        const currentAffiliateId = location.pathname.split('/settings/affiliates/')[1];
        if (!affiliateIds.includes(currentAffiliateId)) {
          navigate(allowedPath, { replace: true });
        }
      }
    }
  }, [user, authLoading, roleLoading, isAffiliate, affiliateIds, location.pathname, navigate]);

  // Show loading while checking auth/role
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-sm md:text-base truncate">{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 p-3 md:p-6 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
