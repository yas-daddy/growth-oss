import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AffiliateStatus = 'active' | 'paused' | 'inactive';

export interface Affiliate {
  id: string;
  user_id: string;
  name: string;
  channel: string;
  cpa: number;
  ftds: number;
  monthly_cap: number;
  status: AffiliateStatus;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAffiliateInput {
  name: string;
  channel: string;
  cpa: number;
  monthly_cap?: number;
  status?: AffiliateStatus;
  contact_email?: string;
  notes?: string;
}

export interface UpdateAffiliateInput extends Partial<CreateAffiliateInput> {
  id: string;
}

export function useAffiliates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['affiliates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Affiliate[];
    },
    enabled: !!user,
  });
}

export function useCreateAffiliate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateAffiliateInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('affiliates')
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Affiliate created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create affiliate: ' + error.message);
    },
  });
}

export function useUpdateAffiliate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAffiliateInput) => {
      const { data, error } = await supabase
        .from('affiliates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Affiliate updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update affiliate: ' + error.message);
    },
  });
}

export function useDeleteAffiliate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Affiliate deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete affiliate: ' + error.message);
    },
  });
}
