import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X } from "lucide-react";
import {
  AutomationRule,
  CreateRuleInput,
  RuleCondition,
  RuleConditions,
  RuleConditionGroup,
  KeywordTargeting,
  ActionValue,
  SUPPORTED_METRICS,
  OPERATORS,
  useCreateRule,
  useUpdateRule,
} from "@/hooks/useAutomationRules";
import { useAppleKeywords } from "@/hooks/useAppleKeywords";

interface RuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: AutomationRule | null;
}

const defaultConditions: RuleConditions = {
  groups: [{ conditions: [{ metric: "spend", operator: ">", value: 0 }] }],
};

const defaultActionValue: ActionValue = {
  type: "decrease",
  value: 10,
  unit: "percent",
  minBid: undefined,
  maxBid: undefined,
};

const defaultKeywordTargeting: KeywordTargeting = {
  mode: "all",
};

export function RuleEditorDialog({
  open,
  onOpenChange,
  rule,
}: RuleEditorDialogProps) {
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const { keywords } = useAppleKeywords();
  const isEditing = !!rule;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<"apple" | "meta">("apple");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [conditions, setConditions] = useState<RuleConditions>(defaultConditions);
  const [keywordTargeting, setKeywordTargeting] = useState<KeywordTargeting>(defaultKeywordTargeting);
  const [actionType, setActionType] = useState<
    "adjust_bid" | "pause_keyword" | "enable_keyword"
  >("pause_keyword");
  const [actionValue, setActionValue] = useState<ActionValue>(defaultActionValue);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [minSpend, setMinSpend] = useState<string>("");
  const [minImpressions, setMinImpressions] = useState<string>("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "manual">(
    "daily"
  );
  const [keywordSearch, setKeywordSearch] = useState("");

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || "");
      setPlatform(rule.platform);
      setIsActive(rule.is_active);
      setPriority(rule.priority);
      setConditions(rule.conditions);
      setKeywordTargeting(rule.keyword_targeting || defaultKeywordTargeting);
      setActionType(rule.action_type);
      setActionValue(rule.action_value || defaultActionValue);
      setLookbackDays(rule.lookback_days);
      setMinSpend(rule.min_spend_threshold?.toString() || "");
      setMinImpressions(rule.min_impressions_threshold?.toString() || "");
      setFrequency(rule.frequency);
    } else {
      // Reset to defaults for new rule
      setName("");
      setDescription("");
      setPlatform("apple");
      setIsActive(true);
      setPriority(0);
      setConditions(defaultConditions);
      setKeywordTargeting(defaultKeywordTargeting);
      setActionType("pause_keyword");
      setActionValue(defaultActionValue);
      setLookbackDays(7);
      setMinSpend("");
      setMinImpressions("");
      setFrequency("daily");
    }
  }, [rule, open]);

  // Group management
  const handleAddGroup = () => {
    setConditions((prev) => ({
      groups: [
        ...prev.groups,
        { conditions: [{ metric: "spend", operator: ">", value: 0 }] },
      ],
    }));
  };

  const handleRemoveGroup = (groupIndex: number) => {
    if (conditions.groups.length <= 1) return;
    setConditions((prev) => ({
      groups: prev.groups.filter((_, i) => i !== groupIndex),
    }));
  };

  // Condition management within a group
  const handleAddCondition = (groupIndex: number) => {
    setConditions((prev) => ({
      groups: prev.groups.map((group, i) =>
        i === groupIndex
          ? {
              conditions: [
                ...group.conditions,
                { metric: "spend", operator: ">", value: 0 },
              ],
            }
          : group
      ),
    }));
  };

  const handleRemoveCondition = (groupIndex: number, conditionIndex: number) => {
    setConditions((prev) => ({
      groups: prev.groups.map((group, i) =>
        i === groupIndex
          ? {
              conditions: group.conditions.filter((_, j) => j !== conditionIndex),
            }
          : group
      ),
    }));
  };

  const handleConditionChange = (
    groupIndex: number,
    conditionIndex: number,
    field: keyof RuleCondition,
    value: string | number
  ) => {
    setConditions((prev) => ({
      groups: prev.groups.map((group, i) =>
        i === groupIndex
          ? {
              conditions: group.conditions.map((c, j) =>
                j === conditionIndex ? { ...c, [field]: value } : c
              ),
            }
          : group
      ),
    }));
  };

  // Keyword targeting
  const handleAddKeywordId = (keywordId: string) => {
    setKeywordTargeting((prev) => ({
      ...prev,
      keyword_ids: [...(prev.keyword_ids || []), keywordId],
    }));
    setKeywordSearch("");
  };

  const handleRemoveKeywordId = (keywordId: string) => {
    setKeywordTargeting((prev) => ({
      ...prev,
      keyword_ids: (prev.keyword_ids || []).filter((id) => id !== keywordId),
    }));
  };

  const filteredKeywords = keywords?.filter(
    (kw) =>
      kw.keyword_text.toLowerCase().includes(keywordSearch.toLowerCase()) &&
      !(keywordTargeting.keyword_ids || []).includes(kw.keyword_id)
  );

  const selectedKeywords = keywords?.filter((kw) =>
    (keywordTargeting.keyword_ids || []).includes(kw.keyword_id)
  );

  const handleSubmit = async () => {
    const input: CreateRuleInput = {
      name,
      description: description || undefined,
      platform,
      is_active: isActive,
      priority,
      conditions,
      keyword_targeting: keywordTargeting.mode === "all" ? undefined : keywordTargeting,
      action_type: actionType,
      action_value: actionType === "adjust_bid" ? actionValue : undefined,
      lookback_days: lookbackDays,
      min_spend_threshold: minSpend ? parseFloat(minSpend) : undefined,
      min_impressions_threshold: minImpressions
        ? parseInt(minImpressions)
        : undefined,
      frequency,
    };

    if (isEditing && rule) {
      await updateRule.mutateAsync({ id: rule.id, ...input });
    } else {
      await createRule.mutateAsync(input);
    }
    onOpenChange(false);
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Rule" : "Create Rule"}</DialogTitle>
          <DialogDescription>
            Define conditions and actions for automated keyword management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Pause high CPA keywords"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as "apple" | "meta")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apple">Apple Search Ads</SelectItem>
                  <SelectItem value="meta" disabled>
                    Meta Ads (coming soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this rule does..."
              rows={2}
            />
          </div>

          {/* Keyword Targeting */}
          <div className="space-y-3">
            <Label>Apply to Keywords</Label>
            <Select
              value={keywordTargeting.mode}
              onValueChange={(v) =>
                setKeywordTargeting((prev) => ({
                  ...prev,
                  mode: v as "all" | "specific" | "filter",
                  keyword_ids: v === "all" ? undefined : prev.keyword_ids,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Keywords</SelectItem>
                <SelectItem value="specific">Specific Keywords</SelectItem>
                <SelectItem value="filter">Keywords Matching Filter</SelectItem>
              </SelectContent>
            </Select>

            {keywordTargeting.mode === "specific" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedKeywords?.map((kw) => (
                    <Badge
                      key={kw.keyword_id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {kw.keyword_text}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeywordId(kw.keyword_id)}
                        className="ml-1 hover:bg-muted rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    placeholder="Search keywords to add..."
                  />
                  {keywordSearch && filteredKeywords && filteredKeywords.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                      {filteredKeywords.slice(0, 10).map((kw) => (
                        <button
                          key={kw.keyword_id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => handleAddKeywordId(kw.keyword_id)}
                        >
                          {kw.keyword_text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {keywordTargeting.mode === "filter" && (
              <div className="grid gap-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Keyword contains
                  </Label>
                  <Input
                    value={keywordTargeting.filters?.text_contains || ""}
                    onChange={(e) =>
                      setKeywordTargeting((prev) => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          text_contains: e.target.value || undefined,
                        },
                      }))
                    }
                    placeholder="e.g., betting"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Conditions - OR groups of AND conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddGroup}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add OR Group
              </Button>
            </div>

            {conditions.groups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="p-3 border rounded-lg space-y-2 bg-muted/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {groupIndex > 0 && (
                      <Badge variant="outline" className="text-xs">
                        OR
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Group {groupIndex + 1} (conditions are AND'd)
                    </span>
                  </div>
                  {conditions.groups.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGroup(groupIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {group.conditions.map((condition, conditionIndex) => (
                  <div key={conditionIndex} className="flex items-center gap-2">
                    {conditionIndex > 0 && (
                      <span className="text-xs text-muted-foreground w-10">AND</span>
                    )}
                    {conditionIndex === 0 && <span className="w-10" />}
                    
                    <Select
                      value={condition.metric}
                      onValueChange={(v) =>
                        handleConditionChange(groupIndex, conditionIndex, "metric", v)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_METRICS.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(v) =>
                        handleConditionChange(groupIndex, conditionIndex, "operator", v)
                      }
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.key} value={op.key}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={condition.value as number}
                      onChange={(e) =>
                        handleConditionChange(
                          groupIndex,
                          conditionIndex,
                          "value",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-24"
                    />

                    {group.conditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCondition(groupIndex, conditionIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddCondition(groupIndex)}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add AND Condition
                </Button>
              </div>
            ))}
          </div>

          {/* Action */}
          <div className="space-y-3">
            <Label>Action</Label>
            <Select
              value={actionType}
              onValueChange={(v) =>
                setActionType(v as "adjust_bid" | "pause_keyword" | "enable_keyword")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pause_keyword">Pause Keyword</SelectItem>
                <SelectItem value="enable_keyword">Enable Keyword</SelectItem>
                <SelectItem value="adjust_bid">Adjust Bid</SelectItem>
              </SelectContent>
            </Select>

            {actionType === "adjust_bid" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Select
                    value={actionValue.type}
                    onValueChange={(v) =>
                      setActionValue((prev) => ({
                        ...prev,
                        type: v as "increase" | "decrease" | "set",
                      }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">Increase by</SelectItem>
                      <SelectItem value="decrease">Decrease by</SelectItem>
                      <SelectItem value="set">Set to</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    value={actionValue.value}
                    onChange={(e) =>
                      setActionValue((prev) => ({
                        ...prev,
                        value: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-20"
                  />

                  <Select
                    value={actionValue.unit}
                    onValueChange={(v) =>
                      setActionValue((prev) => ({
                        ...prev,
                        unit: v as "percent" | "absolute",
                      }))
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="absolute">£</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bid Constraints */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                  <div className="space-y-1.5">
                    <Label htmlFor="minBid" className="text-xs text-muted-foreground">
                      Minimum Bid (£)
                    </Label>
                    <Input
                      id="minBid"
                      type="number"
                      step="0.01"
                      min="0"
                      value={actionValue.minBid ?? ""}
                      onChange={(e) =>
                        setActionValue((prev) => ({
                          ...prev,
                          minBid: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      placeholder="No minimum"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxBid" className="text-xs text-muted-foreground">
                      Maximum Bid (£)
                    </Label>
                    <Input
                      id="maxBid"
                      type="number"
                      step="0.01"
                      min="0"
                      value={actionValue.maxBid ?? ""}
                      onChange={(e) =>
                        setActionValue((prev) => ({
                          ...prev,
                          maxBid: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      placeholder="No maximum"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thresholds & Settings */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lookback">Lookback (days)</Label>
              <Input
                id="lookback"
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value) || 7)}
                min={1}
                max={90}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minSpend">Min Spend (£)</Label>
              <Input
                id="minSpend"
                type="number"
                value={minSpend}
                onChange={(e) => setMinSpend(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minImpressions">Min Impressions</Label>
              <Input
                id="minImpressions"
                type="number"
                value={minImpressions}
                onChange={(e) => setMinImpressions(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as "daily" | "weekly" | "manual")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label htmlFor="active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Rule will run automatically when active
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}