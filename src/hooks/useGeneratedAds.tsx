import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GeneratedAd {
  id: string;
  fixture_id: string | null;
  template_id: string | null;
  generated_image_url: string | null;
  meta_ad_id: string | null;
  meta_creative_id: string | null;
  status: string;
  error_message: string | null;
  scheduled_pause_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGeneratedAds() {
  const queryClient = useQueryClient();

  const { data: generatedAds = [], isLoading } = useQuery({
    queryKey: ['generated-football-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_football_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GeneratedAd[];
    },
  });

  const generateAdMutation = useMutation({
    mutationFn: async ({ fixtureId, templateId }: { fixtureId: string; templateId?: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-football-ad', {
        body: { fixture_id: fixtureId, template_id: templateId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-football-ads'] });
      toast.success("Ad generated successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to generate ad: " + error.message);
    },
  });

  return {
    generatedAds,
    isLoading,
    generateAd: generateAdMutation.mutateAsync,
    isGenerating: generateAdMutation.isPending,
  };
}
