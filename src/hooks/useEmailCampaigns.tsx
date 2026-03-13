import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmailCampaignSchedule {
  id: string;
  image_url: string | null;
  email_title: string;
  pre_header: string | null;
  header_title: string | null;
  body_copy: string | null;
  cta_text: string | null;
  cta_url: string | null;
  offer_validity_hours: number | null;
  push_title: string | null;
  push_body: string | null;
  scheduled_at: string;
  status: string;
  braze_schedule_id: string | null;
  braze_response: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  extra_properties: Record<string, string> | null;
  campaign_id: string | null;
}

export interface CustomContentBlock {
  key: string;
  label: string;
  html: string;
}

export interface CustomMockAttribute {
  key: string;
  value: string;
}

export interface CustomPayloadField {
  key: string;
  label: string;
  type: 'input' | 'textarea';
}

export interface EmailCampaignSettings {
  id: string;
  name: string;
  html_template: string | null;
  canvas_id: string | null;
  mock_first_name: string;
  mock_net_deposits: string;
  cb_hero_without_cta: string | null;
  cb_header_title: string | null;
  cb_body_copy: string | null;
  cb_cta: string | null;
  cb_footer: string | null;
  custom_content_blocks: CustomContentBlock[] | null;
  custom_mock_attributes: CustomMockAttribute[] | null;
  custom_payload_fields: CustomPayloadField[] | null;
  default_email_title: string | null;
  default_pre_header: string | null;
  default_header_title: string | null;
  default_body_copy: string | null;
  default_cta_text: string | null;
  default_cta_url: string | null;
  default_offer_hours: number | null;
  default_push_title: string | null;
  default_push_body: string | null;
  created_at: string;
  updated_at: string;
}

// ── List hook (for the campaigns list page) ──

export function useEmailCampaignList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const campaignsQuery = useQuery({
    queryKey: ['email-campaigns-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_settings')
        .select('id, name, canvas_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch all schedules to compute last/next send per campaign
      const { data: schedules } = await supabase
        .from('email_campaign_schedules')
        .select('campaign_id, scheduled_at, status')
        .order('scheduled_at', { ascending: false });

      const now = new Date();
      const campaignsWithDates = (data || []).map((c) => {
        const campaignSchedules = (schedules || []).filter(s => s.campaign_id === c.id);
        const pastSends = campaignSchedules.filter(s => s.status !== 'cancelled' && new Date(s.scheduled_at) <= now);
        const futureSends = campaignSchedules.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > now);
        return {
          ...c,
          last_send: pastSends.length > 0 ? pastSends[0].scheduled_at : null,
          next_send: futureSends.length > 0 ? futureSends[futureSends.length - 1].scheduled_at : null,
        };
      });

      return campaignsWithDates;
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (payload: { name: string; canvas_id: string }) => {
      const { data, error } = await supabase
        .from('email_campaign_settings')
        .insert({ name: payload.name, canvas_id: payload.canvas_id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns-list'] });
      toast({ title: 'Campaign created' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error creating campaign', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      // Delete associated schedules first
      await supabase.from('email_campaign_schedules').delete().eq('campaign_id', campaignId);
      const { error } = await supabase.from('email_campaign_settings').delete().eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns-list'] });
      toast({ title: 'Campaign deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error deleting campaign', description: err.message, variant: 'destructive' });
    },
  });

  const renameCampaign = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('email_campaign_settings')
        .update({ name, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns-list'] });
      toast({ title: 'Campaign renamed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error renaming campaign', description: err.message, variant: 'destructive' });
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    isLoading: campaignsQuery.isLoading,
    createCampaign,
    deleteCampaign,
    renameCampaign,
  };
}

// ── Detail hook (for a single campaign) ──

export function useEmailCampaign(campaignId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settingsQuery = useQuery({
    queryKey: ['email-campaign-settings', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_settings')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EmailCampaignSettings | null;
    },
    enabled: !!campaignId,
  });

  const schedulesQuery = useQuery({
    queryKey: ['email-campaign-schedules', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_schedules')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data as EmailCampaignSchedule[];
    },
    enabled: !!campaignId,
  });

  const saveSettings = useMutation({
    mutationFn: async (settings: { html_template: string; canvas_id: string; mock_first_name?: string; mock_net_deposits?: string; cb_hero_without_cta?: string; cb_header_title?: string; cb_body_copy?: string; cb_cta?: string; cb_footer?: string; custom_content_blocks?: CustomContentBlock[]; custom_mock_attributes?: CustomMockAttribute[]; custom_payload_fields?: CustomPayloadField[]; default_email_title?: string; default_pre_header?: string; default_header_title?: string; default_body_copy?: string; default_cta_text?: string; default_cta_url?: string; default_offer_hours?: number; default_push_title?: string; default_push_body?: string; name?: string }) => {
      const payload = {
        ...settings,
        custom_content_blocks: settings.custom_content_blocks ? JSON.parse(JSON.stringify(settings.custom_content_blocks)) : undefined,
        custom_mock_attributes: settings.custom_mock_attributes ? JSON.parse(JSON.stringify(settings.custom_mock_attributes)) : undefined,
        custom_payload_fields: settings.custom_payload_fields ? JSON.parse(JSON.stringify(settings.custom_payload_fields)) : undefined,
      };
      const { error } = await supabase
        .from('email_campaign_settings')
        .update({ ...payload, updated_at: new Date().toISOString() } as any)
        .eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign-settings', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns-list'] });
      toast({ title: 'Settings saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    },
  });

  const scheduleBroadcast = useMutation({
    mutationFn: async (payload: {
      image_url?: string;
      email_title: string;
      pre_header?: string;
      header_title?: string;
      body_copy?: string;
      cta_text?: string;
      cta_url?: string;
      offer_validity_hours?: number;
      push_title?: string;
      push_body?: string;
      scheduled_at: string;
      extra_properties?: Record<string, string>;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('schedule-email-broadcast', {
        body: { ...payload, campaign_id: campaignId },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to schedule');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign-schedules', campaignId] });
      toast({ title: 'Broadcast scheduled successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Scheduling failed', description: err.message, variant: 'destructive' });
    },
  });

  const cancelBroadcast = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('cancel-email-broadcast', {
        body: { schedule_id: scheduleId },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to cancel');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign-schedules', campaignId] });
      toast({ title: 'Broadcast cancelled' });
    },
    onError: (err: Error) => {
      toast({ title: 'Cancellation failed', description: err.message, variant: 'destructive' });
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Try uploading with original name first; if it already exists, append a short suffix
    let fileName = sanitized;
    let { error } = await supabase.storage
      .from('email-assets')
      .upload(fileName, file, { upsert: false });

    if (error && error.message?.includes('already exists')) {
      const ext = sanitized.includes('.') ? sanitized.slice(sanitized.lastIndexOf('.')) : '';
      const base = ext ? sanitized.slice(0, sanitized.lastIndexOf('.')) : sanitized;
      fileName = `${base}_${crypto.randomUUID().slice(0, 8)}${ext}`;
      const retry = await supabase.storage
        .from('email-assets')
        .upload(fileName, file, { upsert: false });
      error = retry.error;
    }

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('email-assets')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  return {
    schedules: schedulesQuery.data || [],
    schedulesLoading: schedulesQuery.isLoading,
    settings: settingsQuery.data,
    settingsLoading: settingsQuery.isLoading,
    saveSettings,
    scheduleBroadcast,
    cancelBroadcast,
    uploadImage,
  };
}

// Legacy hook kept for backward compatibility
export function useEmailCampaigns() {
  return useEmailCampaign('');
}
