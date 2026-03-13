import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TypeformSurvey {
  id: string;
  response_id: string;
  rating: number;
  nps_score: number | null;
  disappointment_score: number | null;
  feedback_text: string | null;
  primary_benefit: string | null;
  acquisition_source: string | null;
  has_invited_friends: boolean;
  email: string | null;
  submitted_at: string;
  synced_at: string;
  created_at: string;
}

export interface TypeformStats {
  totalResponses: number;
  averageRating: number;
  starDistribution: Record<number, number>;
  averageNPS: number | null;
  lastSynced: string | null;
}

export function useTypeformSurveys() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["typeform-surveys", user?.id],
    queryFn: async (): Promise<TypeformSurvey[]> => {
      const { data, error } = await supabase
        .from("typeform_surveys")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TypeformSurvey[];
    },
    enabled: !!user,
  });
}

export function useTypeformStats() {
  const { data: surveys, isLoading } = useTypeformSurveys();

  const stats: TypeformStats = {
    totalResponses: surveys?.length || 0,
    averageRating: 0,
    starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    averageNPS: null,
    lastSynced: null,
  };

  if (surveys && surveys.length > 0) {
    stats.averageRating = Math.round(
      (surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length) * 10
    ) / 10;

    surveys.forEach(s => {
      stats.starDistribution[s.rating] = (stats.starDistribution[s.rating] || 0) + 1;
    });

    const surveysWithNPS = surveys.filter(s => s.nps_score !== null);
    if (surveysWithNPS.length > 0) {
      stats.averageNPS = Math.round(
        (surveysWithNPS.reduce((sum, s) => sum + (s.nps_score || 0), 0) / surveysWithNPS.length) * 10
      ) / 10;
    }

    stats.lastSynced = surveys[0]?.synced_at || null;
  }

  return { stats, isLoading };
}

// Get only surveys with feedback text (for review display)
export function useTypeformReviewsWithFeedback() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["typeform-surveys-with-feedback", user?.id],
    queryFn: async (): Promise<TypeformSurvey[]> => {
      const { data, error } = await supabase
        .from("typeform_surveys")
        .select("*")
        .not("feedback_text", "is", null)
        .neq("feedback_text", "")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TypeformSurvey[];
    },
    enabled: !!user,
  });
}
