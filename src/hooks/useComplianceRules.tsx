import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComplianceRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  sort_order: number;
  content_types: string[];
  created_at: string;
  updated_at: string;
}

export function useComplianceRules() {
  return useQuery({
    queryKey: ['compliance-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_rules' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as unknown as ComplianceRule[];
    },
  });
}

export function useUpdateComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComplianceRule> & { id: string }) => {
      const { error } = await supabase
        .from('compliance_rules' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-rules'] }),
  });
}

export function useCreateComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { label: string; description: string; content_types: string[]; sort_order: number }) => {
      const { error } = await supabase
        .from('compliance_rules' as any)
        .insert(rule as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-rules'] }),
  });
}

export function useDeleteComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compliance_rules' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-rules'] }),
  });
}
