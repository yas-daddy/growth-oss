import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PendingResponse {
  id: string;
  platform: string;
  review_id: string;
  review_db_id: string;
  review_stars: number;
  review_title: string | null;
  review_text: string | null;
  review_author: string | null;
  ai_response: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  posted_at: string | null;
}

export function usePendingResponses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_responses")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingResponse[];
    },
    enabled: !!user,
  });
}

export function useApproveResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pendingResponse,
      responseText,
    }: {
      pendingResponse: PendingResponse;
      responseText: string;
    }): Promise<{ reviewDeleted?: boolean }> => {
      // Post the response using the appropriate edge function
      let functionName = "";
      if (pendingResponse.platform === "App Store") {
        functionName = "app-store-respond";
      } else if (pendingResponse.platform === "Google Play") {
        functionName = "google-play-respond";
      } else if (pendingResponse.platform === "Trustpilot") {
        functionName = "trustpilot-respond";
      }

      const response = await supabase.functions.invoke(functionName, {
        body: {
          reviewId: pendingResponse.review_db_id,
          responseText,
        },
      });

      // Check if review was deleted (HTTP 410 Gone returns isReviewDeleted)
      if (response.error) {
        // The error might contain our custom isReviewDeleted flag
        const errorData = response.data;
        if (errorData?.isReviewDeleted) {
          // Mark as deleted instead of throwing
          await supabase
            .from("pending_responses")
            .update({
              status: "review_deleted",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", pendingResponse.id);
          
          return { reviewDeleted: true };
        }
        throw response.error;
      }

      // Update pending response status
      const { error: updateError } = await supabase
        .from("pending_responses")
        .update({
          status: "approved",
          ai_response: responseText,
          reviewed_at: new Date().toISOString(),
          posted_at: new Date().toISOString(),
        })
        .eq("id", pendingResponse.id);

      if (updateError) throw updateError;
      
      return {};
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pending-responses"] });
      queryClient.invalidateQueries({ queryKey: ["app-store-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["google-play-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["trustpilot-reviews"] });
      
      if (result?.reviewDeleted) {
        toast.info("This review was deleted on the platform and has been removed from your queue");
      } else {
        toast.success("Response posted successfully");
      }
    },
    onError: (error) => {
      toast.error(`Failed to post response: ${error.message}`);
    },
  });
}

export function useRejectResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pending_responses")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          rejected_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-responses"] });
      toast.success("Response rejected - this review will not receive future drafts");
    },
  });
}
