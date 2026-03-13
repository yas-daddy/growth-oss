import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ReviewSettings {
  id: string;
  user_id: string;
  ai_prompt: string;
  insights_prompt: string;
  push_notification_prompt: string | null;
  braze_canvas_id: string | null;
  email_copy_prompt: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROMPT = `You are a professional customer service representative. Generate a helpful, empathetic, and professional response to the following customer review. Keep the response concise (2-3 sentences) and address any specific concerns mentioned. Be genuine and avoid generic responses.`;

const DEFAULT_INSIGHTS_PROMPT = `Analyze these customer reviews and provide brief insights.

Answer these two questions in 2 sentences maximum each:

1. **Did users have any specific issues or bugs?**
Look for technical problems, app crashes, features not working, or any bugs mentioned.

2. **What features were users asking for?**
Look for feature requests, missing functionality, or suggestions for improvement.

Be specific and cite examples from the reviews when possible. If there are no relevant complaints for a question, say "No specific issues mentioned."`;

export function useReviewSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["review-settings"],
    queryFn: async (): Promise<ReviewSettings | null> => {
      // Fetch organization-wide settings (first row, not filtered by user)
      const { data, error } = await supabase
        .from("review_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateReviewSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: { aiPrompt?: string; insightsPrompt?: string; pushNotificationPrompt?: string; brazeCanvasId?: string; emailCopyPrompt?: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if organization settings already exist
      const { data: existing } = await supabase
        .from("review_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      const updateData: { ai_prompt?: string; insights_prompt?: string; push_notification_prompt?: string; braze_canvas_id?: string; email_copy_prompt?: string } = {};
      if (settings.aiPrompt !== undefined) updateData.ai_prompt = settings.aiPrompt;
      if (settings.insightsPrompt !== undefined) updateData.insights_prompt = settings.insightsPrompt;
      if (settings.pushNotificationPrompt !== undefined) updateData.push_notification_prompt = settings.pushNotificationPrompt;
      if (settings.brazeCanvasId !== undefined) updateData.braze_canvas_id = settings.brazeCanvasId;
      if (settings.emailCopyPrompt !== undefined) updateData.email_copy_prompt = settings.emailCopyPrompt;

      if (existing) {
        // Update existing organization settings
        const { data, error } = await supabase
          .from("review_settings")
          .update(updateData)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new organization settings (use current user as owner)
        const { data, error } = await supabase
          .from("review_settings")
          .insert({ ...updateData, user_id: user.id })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-settings"] });
    },
  });
}

export function useGenerateAISuggestion() {
  return useMutation({
    mutationFn: async (review: {
      stars: number;
      title: string | null;
      text: string | null;
      author: string | null;
      source: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("ai-suggest-response", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { review },
      });

      if (error) throw error;
      return data as { suggestion: string };
    },
  });
}

export function useAnalyzeReviews() {
  return useMutation({
    mutationFn: async (reviews: Array<{
      stars: number;
      title: string | null;
      text: string | null;
      source: string;
    }>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("analyze-reviews", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { reviews },
      });

      if (error) throw error;
      return data as { issues: string; features: string; raw?: string };
    },
  });
}

const DEFAULT_EMAIL_COPY_PROMPT = `You are an email marketing copywriter for a sports betting brand called StakeMate. Given an email title (subject line), generate the following fields for an email campaign.

IMPORTANT: Where promotional values like bet amounts or free bet amounts are dynamic, you MUST use Liquid template syntax exactly as shown in the examples. Use {{ bet_amount }} and {{ free_bet_amount }} where applicable.

Return these 5 fields:
- pre_header: A short teaser shown next to the subject in inbox
- header_title: The main heading inside the email
- body_copy: The main email body (use HTML <b> tags for emphasis, keep it 2-4 sentences, use \\n\\n for paragraph breaks)
- push_title: Push notification title (short, with emoji if appropriate)
- push_body: Push notification body (1 sentence, include CTA)

Example:
Email Title: "FA Cup Special: Bet {{ bet_amount }}, Get {{ free_bet_amount }} Free"
pre_header: Bet {{ bet_amount }}, {{ free_bet_amount }} FREE bet on us
header_title: Your FA Cup free bet is waiting
body_copy: The FA Cup has a habit of delivering big moments, late drama and the odd giant-killing that no one saw coming.\\n\\nTo make it even better, we're giving you a little extra to play with:\\n\\n<b>Bet {{ bet_amount }}, get {{ free_bet_amount }} FREE bet.</b>\\n\\nGet involved before kick off and give yourself something extra to cheer about.
push_title: Bet {{ bet_amount }}, get {{ free_bet_amount }} FREE bet ⚽
push_body: Kick off the FA Cup with a free bet. Terms apply. Bet here.`;

export { DEFAULT_PROMPT, DEFAULT_INSIGHTS_PROMPT, DEFAULT_EMAIL_COPY_PROMPT };
