import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TrustpilotReview {
  id: string;
  review_id: string;
  stars: number;
  title: string | null;
  text: string | null;
  language: string | null;
  consumer_display_name: string | null;
  consumer_country_code: string | null;
  created_at: string;
  updated_at: string | null;
  is_verified: boolean;
  synced_at: string;
  response_text: string | null;
  responded_at: string | null;
}

export interface TrustpilotStats {
  totalReviews: number;
  averageRating: number;
  starDistribution: Record<number, number>;
  lastSynced: string | null;
}

export function useTrustpilotReviews() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trustpilot-reviews", user?.id],
    queryFn: async (): Promise<TrustpilotReview[]> => {
      const { data, error } = await supabase
        .from("trustpilot_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useTrustpilotStats() {
  const { data: reviews, isLoading } = useTrustpilotReviews();

  const stats: TrustpilotStats = {
    totalReviews: reviews?.length || 0,
    averageRating: 0,
    starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    lastSynced: null,
  };

  if (reviews && reviews.length > 0) {
    stats.averageRating = Math.round(
      (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length) * 10
    ) / 10;

    reviews.forEach(r => {
      stats.starDistribution[r.stars] = (stats.starDistribution[r.stars] || 0) + 1;
    });

    stats.lastSynced = reviews[0]?.synced_at || null;
  }

  return { stats, isLoading };
}

export function useSyncTrustpilotReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("trustpilot-sync", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trustpilot-reviews"] });
    },
  });
}

export function useRespondToTrustpilotReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, responseText }: { reviewId: string; responseText: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("trustpilot-respond", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { reviewId, responseText },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trustpilot-reviews"] });
    },
  });
}
