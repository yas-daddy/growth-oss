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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import {
  MetaAdRule,
  MetaEvaluationSpec,
  MetaExecutionSpec,
  MetaScheduleSpec,
  MetaRuleFilter,
  useCreateMetaRule,
  FILTER_FIELD_LABELS,
  EXECUTION_TYPE_LABELS,
} from "@/hooks/useMetaAdRules";

interface MetaRuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: MetaAdRule | null;
}

// Meta-supported operators
const META_OPERATORS = [
  { key: "GREATER_THAN", label: ">" },
  { key: "LESS_THAN", label: "<" },
  { key: "EQUAL", label: "=" },
  { key: "NOT_EQUAL", label: "≠" },
  { key: "IN_RANGE", label: "Between" },
];

// Time presets for Meta
const TIME_PRESETS = [
  { key: "TODAY", label: "Today" },
  { key: "LAST_3D", label: "Last 3 Days" },
  { key: "LAST_7D", label: "Last 7 Days" },
  { key: "LAST_14D", label: "Last 14 Days" },
  { key: "LAST_30D", label: "Last 30 Days" },
  { key: "LIFETIME", label: "Lifetime" },
];

// Entity types
const ENTITY_TYPES = [
  { key: "AD", label: "Ads" },
  { key: "ADSET", label: "Ad Sets" },
  { key: "CAMPAIGN", label: "Campaigns" },
];

// Metrics for conditions
const META_METRICS = [
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "clicks", label: "Clicks" },
  { key: "spend", label: "Spend" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "ctr", label: "CTR" },
  { key: "frequency", label: "Frequency" },
  { key: "cost_per_result", label: "Cost per Result" },
  { key: "cost_per_mobile_app_install", label: "Cost per Install" },
  { key: "mobile_app_install", label: "Installs" },
];

// Execution types
const EXECUTION_TYPES = [
  { key: "PAUSE", label: "Pause" },
  { key: "UNPAUSE", label: "Unpause" },
  { key: "CHANGE_BUDGET", label: "Change Budget" },
  { key: "NOTIFICATION", label: "Send Notification Only" },
];

// Schedule types
const SCHEDULE_TYPES = [
  { key: "SEMI_HOURLY", label: "Every 30 minutes" },
  { key: "HOURLY", label: "Hourly" },
  { key: "DAILY", label: "Daily" },
];

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

export function MetaRuleEditorDialog({
  open,
  onOpenChange,
  rule,
}: MetaRuleEditorDialogProps) {
  const createRule = useCreateMetaRule();
  const isEditing = !!rule;

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [entityType, setEntityType] = useState("AD");
  const [timePreset, setTimePreset] = useState("LAST_7D");
  const [conditions, setConditions] = useState<ConditionRow[]>([
    { field: "spend", operator: "GREATER_THAN", value: "0" },
  ]);
  const [executionType, setExecutionType] = useState("PAUSE");
  const [budgetChangeType, setBudgetChangeType] = useState<"increase" | "decrease">("decrease");
  const [budgetChangeValue, setBudgetChangeValue] = useState("10");
  const [scheduleType, setScheduleType] = useState("DAILY");

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setIsActive(rule.status === "ENABLED");
      
      // Parse entity type and time preset from filters
      const filters = rule.evaluation_spec?.filters || [];
      const entityFilter = filters.find((f) => f.field === "entity_type");
      const timeFilter = filters.find((f) => f.field === "time_preset");
      setEntityType((entityFilter?.value as string) || "AD");
      setTimePreset((timeFilter?.value as string) || "LAST_7D");
      
      // Parse other conditions
      const otherFilters = filters.filter(
        (f) => f.field !== "entity_type" && f.field !== "time_preset"
      );
      if (otherFilters.length > 0) {
        setConditions(
          otherFilters.map((f) => ({
            field: f.field,
            operator: f.operator,
            value: String(f.value),
          }))
        );
      }
      
      // Parse execution
      setExecutionType(rule.execution_spec?.execution_type || "PAUSE");
      const execOptions = rule.execution_spec?.execution_options;
      if (execOptions && execOptions.length > 0) {
        const budgetOption = execOptions[0];
        if (budgetOption.operator === "INCREASE") {
          setBudgetChangeType("increase");
        } else {
          setBudgetChangeType("decrease");
        }
        setBudgetChangeValue(String(budgetOption.value));
      }
      
      // Parse schedule
      setScheduleType(rule.schedule_spec?.schedule_type || "DAILY");
    } else {
      // Reset to defaults for new rule
      setName("");
      setIsActive(true);
      setEntityType("AD");
      setTimePreset("LAST_7D");
      setConditions([{ field: "spend", operator: "GREATER_THAN", value: "0" }]);
      setExecutionType("PAUSE");
      setBudgetChangeType("decrease");
      setBudgetChangeValue("10");
      setScheduleType("DAILY");
    }
  }, [rule, open]);

  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: "spend", operator: "GREATER_THAN", value: "0" },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    field: keyof ConditionRow,
    value: string
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async () => {
    // Build filters array
    const filters: MetaRuleFilter[] = [
      { field: "entity_type", value: entityType, operator: "EQUAL" },
      { field: "time_preset", value: timePreset, operator: "EQUAL" },
      ...conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: parseFloat(c.value) || 0,
      })),
    ];

    const evaluation_spec: MetaEvaluationSpec = {
      evaluation_type: "SCHEDULE",
      filters,
    };

    const execution_spec: MetaExecutionSpec = {
      execution_type: executionType,
    };

    // Add execution options for budget changes
    if (executionType === "CHANGE_BUDGET") {
      execution_spec.execution_options = [
        {
          field: "daily_budget",
          value: parseFloat(budgetChangeValue) || 10,
          operator: budgetChangeType === "increase" ? "INCREASE" : "DECREASE",
        },
      ];
    }

    const schedule_spec: MetaScheduleSpec = {
      schedule_type: scheduleType as MetaScheduleSpec["schedule_type"],
    };

    await createRule.mutateAsync({
      name,
      evaluation_spec,
      execution_spec,
      schedule_spec,
      status: isActive ? "ENABLED" : "DISABLED",
    });

    onOpenChange(false);
  };

  const isPending = createRule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Meta Rule" : "Create Meta Rule"}</DialogTitle>
          <DialogDescription>
            Create a rule following Meta Ads automation logic. This will be synced to Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pause high CPA ads"
            />
          </div>

          {/* Apply To */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Apply to</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={timePreset} onValueChange={setTimePreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            <Label>Conditions (all must be true)</Label>
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(v) => handleConditionChange(index, "field", v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {META_METRICS.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(v) => handleConditionChange(index, "operator", v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {META_OPERATORS.map((op) => (
                        <SelectItem key={op.key} value={op.key}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    value={condition.value}
                    onChange={(e) =>
                      handleConditionChange(index, "value", e.target.value)
                    }
                    className="w-24"
                  />

                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCondition(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCondition}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>

          {/* Action */}
          <div className="space-y-3">
            <Label>Action</Label>
            <Select value={executionType} onValueChange={setExecutionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXECUTION_TYPES.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {executionType === "CHANGE_BUDGET" && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Select
                  value={budgetChangeType}
                  onValueChange={(v) => setBudgetChangeType(v as "increase" | "decrease")}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase by</SelectItem>
                    <SelectItem value="decrease">Decrease by</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  value={budgetChangeValue}
                  onChange={(e) => setBudgetChangeValue(e.target.value)}
                  className="w-20"
                />

                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label>Check Frequency</Label>
            <Select value={scheduleType} onValueChange={setScheduleType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_TYPES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="active">Rule is active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name}>
            {isPending ? "Creating..." : isEditing ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
