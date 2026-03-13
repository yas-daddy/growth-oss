import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformBudget {
  platform: string;
  totalDailyBudget: number;
  totalLifetimeBudget: number;
  campaignCount: number;
}

export function usePlatformBudgets() {
  const metaBudgetsQuery = useQuery({
    queryKey: ['meta-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('daily_budget, lifetime_budget, status')
        .eq('status', 'ACTIVE');
      
      if (error) throw error;
      
      const campaigns = data || [];
      return {
        platform: 'meta',
        totalDailyBudget: campaigns.reduce((sum, c) => sum + Number(c.daily_budget || 0), 0),
        totalLifetimeBudget: campaigns.reduce((sum, c) => sum + Number(c.lifetime_budget || 0), 0),
        campaignCount: campaigns.length,
      };
    },
  });

  const appleBudgetsQuery = useQuery({
    queryKey: ['apple-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apple_campaigns')
        .select('daily_budget, budget_amount, status')
        .eq('status', 'ENABLED');
      
      if (error) throw error;
      
      const campaigns = data || [];
      return {
        platform: 'apple',
        totalDailyBudget: campaigns.reduce((sum, c) => sum + Number(c.daily_budget || 0), 0),
        totalLifetimeBudget: campaigns.reduce((sum, c) => sum + Number(c.budget_amount || 0), 0),
        campaignCount: campaigns.length,
      };
    },
  });

  const molocoBudgetsQuery = useQuery({
    queryKey: ['moloco-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('moloco_campaigns')
        .select('daily_budget, status')
        .eq('status', 'ACTIVE');
      
      if (error) throw error;
      
      const campaigns = data || [];
      return {
        platform: 'moloco',
        totalDailyBudget: campaigns.reduce((sum, c) => sum + Number(c.daily_budget || 0), 0),
        totalLifetimeBudget: 0, // Moloco doesn't have lifetime budgets
        campaignCount: campaigns.length,
      };
    },
  });

  const isLoading = metaBudgetsQuery.isLoading || appleBudgetsQuery.isLoading || molocoBudgetsQuery.isLoading;
  
  const budgets: PlatformBudget[] = [
    metaBudgetsQuery.data,
    appleBudgetsQuery.data,
    molocoBudgetsQuery.data,
  ].filter((b): b is PlatformBudget => !!b);

  const totalDailyBudget = budgets.reduce((sum, b) => sum + b.totalDailyBudget, 0);
  const totalLifetimeBudget = budgets.reduce((sum, b) => sum + b.totalLifetimeBudget, 0);

  return {
    budgets,
    totalDailyBudget,
    totalLifetimeBudget,
    isLoading,
    refetch: () => {
      metaBudgetsQuery.refetch();
      appleBudgetsQuery.refetch();
      molocoBudgetsQuery.refetch();
    },
  };
}
