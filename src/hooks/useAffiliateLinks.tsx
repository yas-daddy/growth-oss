import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AffiliateLink {
  id: string;
  affiliate_id: string;
  campaign_name: string;
  short_url: string;
  long_url: string | null;
  created_at: string;
  created_by: string;
}

export interface GeneratedLink {
  campaign_name: string;
  url: string;
}

export interface GenerateLinkInput {
  affiliate_id: string;
  campaign_names: string[];
}

export interface GenerateLinkResponse {
  success: boolean;
  links: GeneratedLink[];
  affiliate_name: string;
  media_source: string;
  error?: string;
}

/**
 * Parse campaign names from a string containing comma or newline separated values
 */
export function parseCampaignNames(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
}

/**
 * Validate a single campaign name
 */
export function validateCampaignName(name: string): boolean {
  const campaignNameRegex = /^[a-zA-Z0-9_-]+$/;
  return campaignNameRegex.test(name);
}

/**
 * Validate all campaign names and return invalid ones
 */
export function getInvalidCampaignNames(names: string[]): string[] {
  return names.filter(name => !validateCampaignName(name));
}

export function useAffiliateLinks(affiliateId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['affiliate-links', affiliateId],
    queryFn: async () => {
      let query = supabase
        .from('affiliate_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AffiliateLink[];
    },
    enabled: !!user,
  });
}

export function useGenerateAffiliateLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateLinkInput): Promise<GenerateLinkResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-onelink', {
        body: input,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate links');
      
      return data as GenerateLinkResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-links'] });
      const count = data.links.length;
      toast.success(`Generated ${count} link${count !== 1 ? 's' : ''} successfully!`);
    },
    onError: (error) => {
      toast.error('Failed to generate links: ' + error.message);
    },
  });
}

// Keep the old hook name for backwards compatibility but mark as deprecated
/** @deprecated Use useGenerateAffiliateLinks instead */
export function useGenerateAffiliateLink() {
  const generateLinks = useGenerateAffiliateLinks();
  
  return {
    ...generateLinks,
    mutateAsync: async (input: { affiliate_id: string; campaign_name: string }) => {
      const result = await generateLinks.mutateAsync({
        affiliate_id: input.affiliate_id,
        campaign_names: [input.campaign_name],
      });
      return {
        ...result,
        short_url: result.links[0]?.url,
      };
    },
  };
}
