import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BrandScoreExplanation {
  id: string;
  component_key: string;
  label: string;
  explanation: string;
  created_at: string;
  updated_at: string;
}

export function useBrandScoreExplanations() {
  return useQuery({
    queryKey: ["brand-score-explanations"],
    queryFn: async (): Promise<Record<string, BrandScoreExplanation>> => {
      const { data, error } = await supabase
        .from("brand_score_explanations")
        .select("*");

      if (error) throw error;

      // Convert array to a map keyed by component_key
      const explanationsMap: Record<string, BrandScoreExplanation> = {};
      for (const item of data || []) {
        explanationsMap[item.component_key] = item;
      }

      return explanationsMap;
    },
  });
}

export function useUpdateBrandScoreExplanation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      explanation,
    }: {
      id: string;
      explanation: string;
    }) => {
      const { error } = await supabase
        .from("brand_score_explanations")
        .update({ explanation })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-score-explanations"] });
      toast.success("Explanation updated");
    },
    onError: (error) => {
      toast.error("Failed to update explanation");
      console.error(error);
    },
  });
}
