import { useState, useCallback } from 'react';
import { useUserPreference } from '@/hooks/useUserPreferences';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Star,
  Settings,
  LogOut,
  Megaphone,
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  Shield,
  CalendarDays,
  MoreHorizontal,
  PieChart,
  LineChart,
  Activity,
  Rocket,
  Film,
  BarChart2,
  Search,
  Zap,
  Lightbulb,
  Home,
  ChevronRight
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import gosLogo from '@/assets/gos-logo.png';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import { useUserRole } from '@/hooks/useUserRole';
import { useAllDashboards } from '@/hooks/useDashboardConfig';
import { DashboardManagerDialog, getIconComponent } from '@/components/dashboard/DashboardManagerDialog';

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// All dashboards use the unified /dashboard/:slug pattern

// Report section
const reportingNavItems = [
  { title: 'Campaign Performance', url: '/campaign-performance', icon: Activity },
  { title: 'Funnel Analytics', url: '/dashboard/funnel', icon: LineChart },
  { title: 'Affiliates', url: '/dashboard/affiliates', icon: Users },
  { title: 'Weekly Tracker', url: '/weekly', icon: CalendarDays },
  { title: 'Monthly Tracker', url: '/monthly', icon: BarChart3 },
];

// Analyse section
const analyseNavItems = [
  { title: 'Creative Analysis', url: '/creative-analysis', icon: BarChart2 },
  { title: 'Keyword Analysis', url: '/keyword-analysis', icon: Search },
  { title: 'Audience Analysis', url: '/audience-analysis', icon: PieChart },
  { title: 'Projections', url: '/projections', icon: Calendar },
  { title: 'Top Ads', url: '/top-ads', icon: Film },
];

// Automate section
const automateNavItems = [
  { title: 'Launch Ads', url: '/launch-ads', icon: Rocket },
  { title: 'Automation Rules', url: '/automation-rules', icon: Zap },
  { title: 'Recommendations', url: '/recommendations', icon: Lightbulb, badge: 'ai' as const },
  { title: 'Compliance', url: '/compliance', icon: Shield, badge: 'ai' as const },
  { title: 'Review Manager', url: '/ratings', icon: Star },
];

// Experimental features
const experimentalNavItems = [
  { title: 'Competitor Ads', url: '/competitor-ads', icon: Megaphone, badge: 'beta' as const },
];

const systemNavItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  // On mobile, always show full content (not collapsed) when sidebar sheet is open
  const collapsed = isMobile ? false : state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, isAdmin, isAffiliate, canViewDashboard, affiliateIds, isLoading: roleLoading } = useUserRole();
  const { data: dashboards = [] } = useAllDashboards();
  const [managerOpen, setManagerOpen] = useState(false);
  const { value: sectionState, setValue: setSectionState } = useUserPreference<Record<string, boolean>>('sidebar_sections_state', {});

  const getSectionOpen = useCallback((name: string, fallback: boolean) => {
    if (name in sectionState) return sectionState[name];
    return fallback;
  }, [sectionState]);

  const handleSectionToggle = useCallback((name: string, open: boolean) => {
    setSectionState({ ...sectionState, [name]: open });
  }, [sectionState, setSectionState]);

  // Close mobile sidebar on navigation
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');

  // Build dashboard items from database - all use /dashboard/:slug
  const dashboardItems = dashboards.map(d => ({
    title: d.name || d.dashboard_slug,
    url: `/dashboard/${d.dashboard_slug}`,
    icon: getIconComponent(d.icon),
    slug: d.dashboard_slug,
  }));

  // Filter out dashboard items that are already in the static reporting list
  const staticDashboardSlugs = new Set(reportingNavItems.filter(i => i.url.startsWith('/dashboard/')).map(i => i.url.replace('/dashboard/', '')));
  const visibleDashboardItems = isAffiliate ? [] : dashboardItems.filter(d => !staticDashboardSlugs.has(d.slug));
  const visibleReportingItems = isAffiliate ? [] : reportingNavItems;
  const visibleAnalyseItems = isAffiliate ? [] : analyseNavItems;
  const visibleAutomateItems = isAffiliate ? [] : automateNavItems;
  const visibleExperimentalItems = isAffiliate ? [] : experimentalNavItems;
  
  const visibleSystemItems = isAffiliate ? [] : systemNavItems;

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">Admin</Badge>;
      case 'user':
        return <Badge variant="secondary" className="text-[10px]">User</Badge>;
      case 'affiliate':
        return <Badge className="bg-accent/10 text-accent border-accent/30 text-[10px]">Affiliate</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <img src={gosLogo} alt="GrowthOS" className="w-9 h-9 rounded-lg flex-shrink-0" />
            {!collapsed && (
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-sidebar-foreground">GrowthOS</span>
                </div>
                <span className="text-xs text-muted-foreground">Marketing Command Centre</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 flex flex-col">
          {/* Home - always first for non-affiliates */}
          {!isAffiliate && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive('/home')}
                      tooltip="Home"
                    >
                      <NavLink 
                        to="/home" 
                        end 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        onClick={handleNavClick}
                      >
                        <Home className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>Home</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {!isAffiliate && !collapsed && (
            <SidebarGroup>
              <Collapsible open={getSectionOpen('Reporting', [...visibleDashboardItems, ...visibleReportingItems].some(i => isActive(i.url)))} onOpenChange={(open) => handleSectionToggle('Reporting', open)}>
                <div className="flex items-center justify-between px-2">
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group w-full">
                    <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                    <span>Reporting</span>
                  </CollapsibleTrigger>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setManagerOpen(true)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CollapsibleContent className="mt-1.5">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleDashboardItems.map((item) => (
                        <SidebarMenuItem key={item.slug}>
                          <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                            <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                              <item.icon className="h-4 w-4 flex-shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      {visibleReportingItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                            <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                              <item.icon className="h-4 w-4 flex-shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          )}
          {!isAffiliate && collapsed && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleDashboardItems.map((item) => (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {visibleReportingItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

        {visibleAnalyseItems.length > 0 && !collapsed && (
          <SidebarGroup>
            <Collapsible open={getSectionOpen('Analyse', visibleAnalyseItems.some(i => isActive(i.url)))} onOpenChange={(open) => handleSectionToggle('Analyse', open)}>
              <CollapsibleTrigger className="flex items-center gap-1 px-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group w-full">
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                <span>Analyse</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleAnalyseItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
        {visibleAnalyseItems.length > 0 && collapsed && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAnalyseItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleAutomateItems.length > 0 && !collapsed && (
          <SidebarGroup>
            <Collapsible open={getSectionOpen('Automate', visibleAutomateItems.some(i => isActive(i.url)))} onOpenChange={(open) => handleSectionToggle('Automate', open)}>
              <CollapsibleTrigger className="flex items-center gap-1 px-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group w-full">
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                <span>Automate</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleAutomateItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="flex items-center gap-2">
                              {item.title}
                              {'badge' in item && item.badge === 'ai' && (
                                <span className="text-[9px] font-bold leading-none px-1 py-0.5 rounded-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">AI</span>
                              )}
                              {'badge' in item && (item as { badge: string }).badge === 'new' && (
                                <span className="text-[9px] font-semibold leading-none px-1 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400">NEW</span>
                              )}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
        {visibleAutomateItems.length > 0 && collapsed && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAutomateItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleExperimentalItems.length > 0 && !collapsed && (
          <SidebarGroup>
            <Collapsible open={getSectionOpen('Experimental', visibleExperimentalItems.some(i => isActive(i.url)))} onOpenChange={(open) => handleSectionToggle('Experimental', open)}>
              <CollapsibleTrigger className="flex items-center gap-1 px-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group w-full">
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                <span>Experimental</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleExperimentalItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="flex items-center gap-2">
                              {item.title}
                              {'badge' in item && (item as { badge: string }).badge === 'alpha' && (
                                <span className="text-[9px] font-semibold leading-none px-1 py-0.5 rounded-sm bg-amber-500/20 text-amber-400">ALPHA</span>
                              )}
                              {'badge' in item && (item as { badge: string }).badge === 'beta' && (
                                <span className="text-[9px] font-semibold leading-none px-1 py-0.5 rounded-sm bg-sky-500/20 text-sky-400">BETA</span>
                              )}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
        {visibleExperimentalItems.length > 0 && collapsed && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleExperimentalItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} end className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium" onClick={handleNavClick}>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Affiliate-specific navigation */}
        {isAffiliate && affiliateIds.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-2">
              {!collapsed && 'Your Dashboard'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {affiliateIds.map((affiliateId) => (
                  <SidebarMenuItem key={affiliateId}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location.pathname === `/settings/affiliates/${affiliateId}`}
                      tooltip="Partner Dashboard"
                    >
                      <NavLink 
                        to={`/settings/affiliates/${affiliateId}`}
                        end 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        onClick={handleNavClick}
                      >
                        <BarChart3 className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>Partner Dashboard</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Spacer to push System to bottom */}
        <div className="flex-1" />

        {visibleSystemItems.length > 0 && (
          <>
            <SidebarSeparator className="mx-2" />
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-2">
              {!collapsed && 'System'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSystemItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink 
                        to={item.url} 
                        end 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        onClick={handleNavClick}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate text-sidebar-foreground">
                  {user.user_metadata?.full_name || 'User'}
                </p>
                {getRoleBadge()}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button 
            variant="ghost" 
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
      </Sidebar>

      <DashboardManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
