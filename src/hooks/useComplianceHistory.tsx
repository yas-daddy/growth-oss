import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComplianceCheckRecord {
  id: string;
  user_id: string;
  content_type: string;
  input_data: any;
  results: any[];
  overall_status: string;
  created_at: string;
  user_name?: string;
  ai_name?: string | null;
  thumbnail_url?: string | null;
}

export function useComplianceHistory() {
  return useQuery({
    queryKey: ['compliance-history'],
    queryFn: async () => {
      const { data: checks, error } = await supabase
        .from('compliance_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profile names for unique user IDs
      const userIds = [...new Set((checks || []).map((c: any) => c.user_id))];
      let profileMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.full_name || 'Unknown';
          }
        }
      }

      // Generate signed URLs for thumbnails
      const thumbnailPaths = (checks || [])
        .map((c: any) => c.thumbnail_path)
        .filter(Boolean) as string[];

      let thumbnailMap: Record<string, string> = {};

      if (thumbnailPaths.length > 0) {
        const { data: signedData } = await supabase.storage
          .from('compliance-uploads')
          .createSignedUrls(thumbnailPaths, 3600);

        if (signedData) {
          for (const item of signedData) {
            if (item.signedUrl && item.path) {
              thumbnailMap[item.path] = item.signedUrl;
            }
          }
        }
      }

      return (checks || []).map((c: any) => ({
        ...c,
        results: Array.isArray(c.results) ? c.results : [],
        user_name: profileMap[c.user_id] || 'Unknown',
        ai_name: c.ai_name || null,
        thumbnail_url: c.thumbnail_path ? (thumbnailMap[c.thumbnail_path] || null) : null,
      })) as ComplianceCheckRecord[];
    },
  });
}

function getResultStatus(r: any): 'pass' | 'warning' | 'fail' {
  if (r.status) return r.status;
  return r.passed ? 'pass' : 'fail';
}

export function useDismissComplianceResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checkId,
      ruleId,
      action,
    }: {
      checkId: string;
      ruleId: string;
      action: 'ignored' | 'resolved';
    }) => {
      // Fetch current record
      const { data: check, error: fetchError } = await supabase
        .from('compliance_checks')
        .select('results')
        .eq('id', checkId)
        .single();

      if (fetchError) throw fetchError;

      const currentResults = Array.isArray(check.results) ? check.results : [];

      const updatedResults = currentResults.map((r: any) =>
        r.rule_id === ruleId
          ? { ...r, dismissed_as: action, dismissed_at: new Date().toISOString() }
          : r
      );

      // Recompute overall status from non-dismissed results
      const active = updatedResults.filter((r: any) => !r.dismissed_as);
      const hasAnyFail = active.some((r: any) => getResultStatus(r) === 'fail');
      const hasAnyWarning = active.some((r: any) => getResultStatus(r) === 'warning');
      const newOverall =
        active.length === 0
          ? 'pass'
          : hasAnyFail
          ? 'fail'
          : hasAnyWarning
          ? 'warning'
          : 'pass';

      const { error: updateError } = await supabase
        .from('compliance_checks')
        .update({ results: updatedResults, overall_status: newOverall })
        .eq('id', checkId);

      if (updateError) throw updateError;

      return { updatedResults, newOverall };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-history'] });
    },
  });
}
