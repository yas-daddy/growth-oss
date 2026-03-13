import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface GooglePlayReview {
  id: string;
  review_id: string;
  author_name: string | null;
  stars: number;
  text: string | null;
  title: string | null;
  language: string | null;
  device: string | null;
  app_version_code: string | null;
  app_version_name: string | null;
  thumbs_up_count: number;
  review_created_at: string;
  review_updated_at: string | null;
  developer_reply_text: string | null;
  developer_reply_at: string | null;
  synced_at: string;
  response_text: string | null;
  responded_at: string | null;
}

export interface GooglePlayStats {
  totalReviews: number;
  averageRating: number;
  starDistribution: Record<number, number>;
  lastSynced: string | null;
}

export function useGooglePlayReviews() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["google-play-reviews", user?.id],
    queryFn: async (): Promise<GooglePlayReview[]> => {
      const { data, error } = await supabase
        .from("google_play_reviews")
        .select("*")
        .order("review_created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GooglePlayReview[];
    },
    enabled: !!user,
  });
}

export function useGooglePlayStats() {
  const { data: reviews, isLoading } = useGooglePlayReviews();

  const stats: GooglePlayStats = {
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

export function useSyncGooglePlayReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("google-play-sync", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-play-reviews"] });
    },
  });
}

export function useRespondToGooglePlayReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, responseText }: { reviewId: string; responseText: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("google-play-respond", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { reviewId, responseText },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-play-reviews"] });
    },
  });
}