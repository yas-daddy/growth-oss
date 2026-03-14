import { useMemo, useCallback, useRef } from 'react';
import { useUserPreference } from './useUserPreferences';
import {
  LayoutDashboard, Star, Calendar, CalendarDays, BarChart3, Rocket, Film, BarChart2,
  Search, PieChart, Activity, Lightbulb, Zap, Eye, Trophy, Bell, TrendingUp
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

type PageMeta = { title: string; icon: LucideIcon };

const PAGE_METADATA: Record<string, PageMeta> = {
  '/campaign-performance': { title: 'Campaign Performance', icon: Activity },
  '/weekly': { title: 'Weekly Tracker', icon: CalendarDays },
  '/monthly': { title: 'Monthly Tracker', icon: BarChart3 },
  '/recommendations': { title: 'Recommendations', icon: Lightbulb },
  '/projections': { title: 'Projections', icon: Calendar },
  '/ratings': { title: 'Review Manager', icon: Star },
  
  '/automation-rules': { title: 'Automation Rules', icon: Zap },
  '/launch-ads': { title: 'Launch Ads', icon: Rocket },
  '/top-ads': { title: 'Top Ads', icon: Film },
  '/creative-analysis': { title: 'Creative Analysis', icon: BarChart2 },
  '/keyword-analysis': { title: 'Keyword Analysis', icon: Search },
  '/audience-analysis': { title: 'Audience Analysis', icon: PieChart },
  '/football-ads': { title: 'Football Ads', icon: Trophy },
  '/brand-visibility': { title: 'Brand Score', icon: Eye },
};

// Paths we never track
const EXCLUDED_PREFIXES = ['/home', '/auth', '/settings', '/dashboard'];

const MIN_VISITS = 4;
const MAX_QUICK_LINKS = 6;

export function usePageVisitTracker() {
  const { value: counts, setValue: setCounts, isLoading } = useUserPreference<Record<string, number>>('page_visit_counts', {});
  const countsRef = useRef(counts);
  countsRef.current = counts;

  const trackVisit = useCallback((path: string) => {
    if (EXCLUDED_PREFIXES.some(p => path.startsWith(p))) return;
    if (!PAGE_METADATA[path]) return;

    const current = countsRef.current;
    const newCounts = { ...current, [path]: (current[path] || 0) + 1 };
    setCounts(newCounts);
  }, [setCounts]);

  const topPages = useMemo(() => {
    return Object.entries(counts)
      .filter(([path, count]) => count >= MIN_VISITS && PAGE_METADATA[path])
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_QUICK_LINKS)
      .map(([path]) => ({
        path,
        ...PAGE_METADATA[path],
      }));
  }, [counts]);

  return { trackVisit, topPages, isLoading };
}
