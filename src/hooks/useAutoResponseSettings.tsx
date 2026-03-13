import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AutoResponseSettings {
  id: string;
  platform: string;
  enabled: boolean;
  auto_post_threshold: number;
  created_at: string;
  updated_at: string;
}

export function useAutoResponseSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["auto-response-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_response_settings")
        .select("*")
        .order("platform");

      if (error) throw error;
      return data as AutoResponseSettings[];
    },
    enabled: !!user,
  });
}

export function useUpdateAutoResponseSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      platform,
      enabled,
      auto_post_threshold,
    }: {
      platform: string;
      enabled?: boolean;
      auto_post_threshold?: number;
    }) => {
      const updates: Partial<AutoResponseSettings> = {};
      if (enabled !== undefined) updates.enabled = enabled;
      if (auto_post_threshold !== undefined) updates.auto_post_threshold = auto_post_threshold;

      const { error } = await supabase
        .from("auto_response_settings")
        .update(updates)
        .eq("platform", platform);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-response-settings"] });
    },
  });
}
