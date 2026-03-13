import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AppStoreReview {
  id: string;
  review_id: string;
  stars: number;
  title: string | null;
  text: string | null;
  author_name: string | null;
  app_version: string | null;
  territory: string | null;
  created_at: string;
  updated_at: string | null;
  synced_at: string;
  response_text: string | null;
  response_id: string | null;
  responded_at: string | null;
}

export interface AppStoreStats {
  totalReviews: number;
  averageRating: number;
  starDistribution: Record<number, number>;
  lastSynced: string | null;
}

export function useAppStoreReviews() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["app-store-reviews", user?.id],
    queryFn: async (): Promise<AppStoreReview[]> => {
      const { data, error } = await supabase
        .from("app_store_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useAppStoreStats() {
  const { data: reviews, isLoading } = useAppStoreReviews();

  const stats: AppStoreStats = {
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

export function useSyncAppStoreReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("app-store-sync", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-store-reviews"] });
    },
  });
}

export function useRespondToAppStoreReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, responseText }: { reviewId: string; responseText: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("app-store-respond", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { reviewId, responseText },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-store-reviews"] });
    },
  });
}
