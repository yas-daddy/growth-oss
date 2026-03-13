import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface MolocoTrackingLink {
  id: string;
  title: string;
  device_os: string;
  click_through_url: string;
  impression_url?: string;
  status: string;
}

export interface MolocoAdGroup {
  id: string;
  title: string;
  status: string;
  campaign_id: string;
  campaign_title: string;
  campaign_status: string;
  creative_group_ids: string[];
}

export interface MolocoCampaign {
  id: string;
  title: string;
  status: string;
  app_id?: string;
  goal?: string;
  ad_groups: MolocoAdGroup[];
}

export interface UploadCreativeResult {
  creative_id: string;
  creative_title: string;
  creative_type: 'IMAGE' | 'VIDEO';
  asset_id: string;
  asset_url?: string;
}

export interface CreateCreativeGroupResult {
  creative_group_id: string;
  title: string;
  status: string;
  creative_ids: string[];
}

// Fetch tracking links
export function useMolocoTrackingLinks() {
  return useQuery({
    queryKey: ['moloco-tracking-links'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('moloco-fetch-tracking-links', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      return data.tracking_links as MolocoTrackingLink[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch campaigns and ad groups
export function useMolocoCampaignsAndAdGroups() {
  return useQuery({
    queryKey: ['moloco-campaigns-adgroups'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('moloco-fetch-adgroups', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      return {
        campaigns: data.campaigns as MolocoCampaign[],
        adGroups: data.ad_groups as MolocoAdGroup[],
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Upload creative to Moloco
export function useUploadMolocoCreative() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      mediaUrl: string;
      fileName: string;
      creativeName?: string;
    }): Promise<UploadCreativeResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('moloco-upload-creative', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: params,
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      return data as UploadCreativeResult;
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Create creative group
export function useCreateMolocoCreativeGroup() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      creativeIds: string[];
      trackingLinkId: string;
      groupName?: string;
      startPaused?: boolean;
    }): Promise<CreateCreativeGroupResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('moloco-create-creative-group', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: params,
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      return data as CreateCreativeGroupResult;
    },
    onError: (error) => {
      toast({
        title: 'Failed to create creative group',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Attach creative group to ad group
export function useAttachToMolocoAdGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      adGroupId: string;
      creativeGroupId: string;
    }): Promise<{ success: boolean; ad_group_id: string }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('moloco-attach-to-adgroup', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: params,
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moloco-campaigns-adgroups'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to attach creative group',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
