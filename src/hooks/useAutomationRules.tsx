import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RuleCondition = {
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=" | "in" | "not_in";
  value: number | string | string[];
};

// A group of conditions that are AND'd together
export type RuleConditionGroup = {
  conditions: RuleCondition[];
};

// Multiple groups that are OR'd together (each group internally uses AND)
export type RuleConditions = {
  groups: RuleConditionGroup[];
};

// Keyword targeting options
export type KeywordTargeting = {
  mode: "all" | "specific" | "filter";
  keyword_ids?: string[];
  filters?: {
    text_contains?: string;
    text_starts_with?: string;
    campaign_ids?: string[];
    match_type?: string[];
  };
};

export type ActionValue = {
  type: "increase" | "decrease" | "set";
  value: number;
  unit: "percent" | "absolute";
  maxBid?: number;
  minBid?: number;
};

export type AutomationRule = {
  id: string;
  name: string;
  description: string | null;
  platform: "apple" | "meta";
  is_active: boolean;
  priority: number;
  conditions: RuleConditions;
  keyword_targeting: KeywordTargeting | null;
  action_type: "adjust_bid" | "pause_keyword" | "enable_keyword";
  action_value: ActionValue | null;
  lookback_days: number;
  min_spend_threshold: number | null;
  min_impressions_threshold: number | null;
  frequency: "daily" | "weekly" | "manual";
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RuleExecutionLog = {
  id: string;
  rule_id: string;
  executed_at: string;
  keywords_evaluated: number;
  keywords_matched: number;
  actions_taken: Array<{
    keyword_id: string;
    keyword_text?: string;
    action: string;
    old_value?: number | string;
    new_value?: number | string;
    success: boolean;
    error?: string;
  }>;
  errors: Array<{ message: string; keyword_id?: string }> | null;
  status: "pending" | "success" | "partial" | "failed";
  created_at: string;
};

export type CreateRuleInput = {
  name: string;
  description?: string;
  platform: "apple" | "meta";
  is_active?: boolean;
  priority?: number;
  conditions: RuleConditions;
  keyword_targeting?: KeywordTargeting;
  action_type: "adjust_bid" | "pause_keyword" | "enable_keyword";
  action_value?: ActionValue;
  lookback_days?: number;
  min_spend_threshold?: number;
  min_impressions_threshold?: number;
  frequency?: "daily" | "weekly" | "manual";
};

export const SUPPORTED_METRICS = [
  { key: "spend", label: "Spend", category: "Apple Metrics" },
  { key: "impressions", label: "Impressions", category: "Apple Metrics" },
  { key: "taps", label: "Taps", category: "Apple Metrics" },
  { key: "installs", label: "Installs (Apple)", category: "Apple Metrics" },
  { key: "ttr", label: "TTR (%)", category: "Apple Metrics" },
  { key: "cpt", label: "CPT", category: "Apple Metrics" },
  { key: "bid_amount", label: "Bid Amount", category: "Apple Metrics" },
  { key: "impression_share", label: "Impression Share (%)", category: "Impression Share" },
  { key: "impression_rank", label: "Impression Rank", category: "Impression Share" },
  { key: "search_popularity", label: "Search Popularity", category: "Impression Share" },
  { key: "ftd_count", label: "FTD Count", category: "Conversion Metrics" },
  { key: "bet_count", label: "Bet Count", category: "Conversion Metrics" },
  { key: "cpa_ftd", label: "CPA (FTD)", category: "Conversion Metrics" },
  { key: "cpa_bet", label: "CPA (Bet)", category: "Conversion Metrics" },
];

export const OPERATORS = [
  { key: ">", label: ">" },
  { key: "<", label: "<" },
  { key: ">=", label: ">=" },
  { key: "<=", label: "<=" },
  { key: "==", label: "=" },
  { key: "!=", label: "≠" },
];

export function useAutomationRules(platform?: "apple" | "meta") {
  return useQuery({
    queryKey: ["automation-rules", platform],
    queryFn: async () => {
      let query = supabase
        .from("keyword_automation_rules")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Parse JSON fields properly and migrate old format
      return (data || []).map((rule) => {
        let conditions = rule.conditions as RuleConditions | { logic: string; conditions: RuleCondition[] };
        
        // Migrate old format (logic + conditions) to new format (groups)
        if ('logic' in conditions && !('groups' in conditions)) {
          const oldFormat = conditions as { logic: string; conditions: RuleCondition[] };
          conditions = {
            groups: [{ conditions: oldFormat.conditions }],
          } as RuleConditions;
        }
        
        return {
          ...rule,
          conditions: conditions as RuleConditions,
          keyword_targeting: (rule as Record<string, unknown>).keyword_targeting as KeywordTargeting | null,
          action_value: rule.action_value as ActionValue | null,
        };
      }) as AutomationRule[];
    },
  });
}

export function useRuleExecutionLogs(ruleId?: string) {
  return useQuery({
    queryKey: ["rule-execution-logs", ruleId],
    queryFn: async () => {
      let query = supabase
        .from("rule_execution_logs")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(50);

      if (ruleId) {
        query = query.eq("rule_id", ruleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RuleExecutionLog[];
    },
    enabled: !!ruleId || ruleId === undefined, // Fetch all if no ruleId
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const insertData = {
        name: input.name,
        description: input.description,
        platform: input.platform,
        is_active: input.is_active ?? true,
        priority: input.priority ?? 0,
        conditions: input.conditions as unknown as Record<string, unknown>,
        action_type: input.action_type,
        action_value: input.action_value as unknown as Record<string, unknown> | undefined,
        lookback_days: input.lookback_days ?? 7,
        min_spend_threshold: input.min_spend_threshold,
        min_impressions_threshold: input.min_impressions_threshold,
        frequency: input.frequency ?? "daily",
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from("keyword_automation_rules")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Rule created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<CreateRuleInput> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.conditions) {
        updateData.conditions = updates.conditions as unknown as Record<string, unknown>;
      }
      if (updates.action_value) {
        updateData.action_value = updates.action_value as unknown as Record<string, unknown>;
      }

      const { data, error } = await supabase
        .from("keyword_automation_rules")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Rule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("keyword_automation_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Rule deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete rule: ${error.message}`);
    },
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("keyword_automation_rules")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success(is_active ? "Rule enabled" : "Rule disabled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to toggle rule: ${error.message}`);
    },
  });
}
