import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PushNotificationSchedule {
  id: string;
  fixture_id: string;
  braze_schedule_id: string | null;
  scheduled_at: string;
  ai_title: string;
  ai_body: string;
  status: string;
  created_at: string;
  created_by: string;
  braze_response: Record<string, unknown> | null;
}

export function usePushNotifications() {
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["push-notification-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_notification_schedules")
        .select("*")
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return data as PushNotificationSchedule[];
    },
  });

  const generateCopy = useMutation({
    mutationFn: async (fixture_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("generate-push-copy", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { fixture_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { title: string; body: string };
    },
    onError: (error: Error) => {
      toast.error("Failed to generate copy: " + error.message);
    },
  });

  const schedulePush = useMutation({
    mutationFn: async ({ fixture_id, title, body, scheduled_at }: { fixture_id: string; title?: string; body?: string; scheduled_at?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("schedule-match-push", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { fixture_id, title, body, scheduled_at },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-notification-schedules"] });
      toast.success("Push notification scheduled successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to schedule push: " + error.message);
    },
  });

  const cancelPush = useMutation({
    mutationFn: async (schedule_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("cancel-match-push", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { schedule_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-notification-schedules"] });
      toast.success("Push notification cancelled");
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel push: " + error.message);
    },
  });

  const getScheduleForFixture = (fixtureId: string) => {
    return schedules.find(s => s.fixture_id === fixtureId && s.status === "scheduled");
  };

  return {
    schedules,
    isLoading,
    generateCopy,
    schedulePush,
    cancelPush,
    getScheduleForFixture,
  };
}
