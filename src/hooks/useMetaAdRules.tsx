import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MetaRuleFilter {
  field: string;
  value: unknown;
  operator: string;
}

export interface MetaEvaluationSpec {
  evaluation_type: "SCHEDULE" | "TRIGGER";
  filters: MetaRuleFilter[];
  trigger?: {
    type: string;
    field?: string;
    value?: unknown;
    operator?: string;
  };
}

export interface MetaExecutionSpec {
  execution_type: string;
  execution_options?: Array<{
    field: string;
    value: unknown;
    operator: string;
  }>;
}

export interface MetaScheduleSpec {
  schedule_type: "DAILY" | "HOURLY" | "SEMI_HOURLY" | "CUSTOM";
  schedule?: Array<{
    start_minute?: number;
    end_minute?: number;
    days?: number[];
  }>;
}

export interface MetaAdRule {
  id: string;
  meta_rule_id: string;
  name: string;
  status: string;
  account_id: string | null;
  evaluation_spec: MetaEvaluationSpec;
  execution_spec: MetaExecutionSpec;
  schedule_spec: MetaScheduleSpec | null;
  created_by_name: string | null;
  created_time: string | null;
  updated_time: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

// Mapping Meta execution types to human-readable labels
export const EXECUTION_TYPE_LABELS: Record<string, string> = {
  PAUSE: "Pause",
  UNPAUSE: "Unpause",
  CHANGE_BID: "Change Bid",
  CHANGE_BUDGET: "Change Budget",
  CHANGE_CAMPAIGN_BUDGET: "Change Campaign Budget",
  REBALANCE_BUDGET: "Rebalance Budget",
  NOTIFICATION: "Send Notification",
  ROTATE: "Rotate Creatives",
};

// Common filter fields
export const FILTER_FIELD_LABELS: Record<string, string> = {
  entity_type: "Entity Type",
  time_preset: "Time Period",
  impressions: "Impressions",
  reach: "Reach",
  clicks: "Clicks",
  spend: "Spend",
  cpc: "CPC",
  cpm: "CPM",
  ctr: "CTR",
  frequency: "Frequency",
  cost_per_result: "Cost per Result",
  cost_per_purchase_fb: "Cost per Purchase",
  cost_per_mobile_app_install: "Cost per Install",
  mobile_app_install: "Installs",
};

export function useMetaAdRules() {
  return useQuery({
    queryKey: ["meta-ad-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_rules")
        .select("*")
        .order("synced_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MetaAdRule[];
    },
  });
}

export function useSyncMetaRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-sync-rules");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-rules"] });
      toast.success(data?.message || "Meta rules synced successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync Meta rules: ${error.message}`);
    },
  });
}

export function useToggleMetaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const { data, error } = await supabase.functions.invoke("meta-manage-rule", {
        body: {
          action: "toggle",
          ruleId,
          status: enabled ? "ENABLED" : "DISABLED",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-rules"] });
      toast.success(enabled ? "Rule enabled" : "Rule disabled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to toggle rule: ${error.message}`);
    },
  });
}

export function useDeleteMetaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-manage-rule", {
        body: { action: "delete", ruleId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-rules"] });
      toast.success("Rule deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete rule: ${error.message}`);
    },
  });
}

export function useCreateMetaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleData: {
      name: string;
      evaluation_spec: MetaEvaluationSpec;
      execution_spec: MetaExecutionSpec;
      schedule_spec?: MetaScheduleSpec;
      status?: "ENABLED" | "DISABLED";
    }) => {
      const { data, error } = await supabase.functions.invoke("meta-manage-rule", {
        body: { action: "create", ...ruleData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-rules"] });
      toast.success("Rule created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    },
  });
}

// Helper to format rule conditions for display
export function formatMetaRuleConditions(rule: MetaAdRule): string {
  const filters = rule.evaluation_spec?.filters || [];
  return filters
    .filter((f) => f.field !== "entity_type" && f.field !== "time_preset")
    .map((f) => {
      const fieldLabel = FILTER_FIELD_LABELS[f.field] || f.field;
      return `${fieldLabel} ${f.operator} ${f.value}`;
    })
    .join(" AND ");
}

// Helper to format rule action for display
export function formatMetaRuleAction(rule: MetaAdRule): string {
  const execType = rule.execution_spec?.execution_type;
  return EXECUTION_TYPE_LABELS[execType] || execType || "Unknown";
}

// Helper to get time preset from filters
export function getTimePreset(rule: MetaAdRule): string {
  const timeFilter = rule.evaluation_spec?.filters?.find((f) => f.field === "time_preset");
  return (timeFilter?.value as string) || "LIFETIME";
}

// Helper to get entity type from filters
export function getEntityType(rule: MetaAdRule): string {
  const entityFilter = rule.evaluation_spec?.filters?.find((f) => f.field === "entity_type");
  return (entityFilter?.value as string) || "AD";
}
