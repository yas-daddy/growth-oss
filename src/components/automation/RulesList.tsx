import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Pencil, Trash2, Play, History } from "lucide-react";
import {
  AutomationRule,
  useAutomationRules,
  useToggleRule,
  useDeleteRule,
  SUPPORTED_METRICS,
} from "@/hooks/useAutomationRules";

interface RulesListProps {
  platform: "apple" | "meta";
  onEdit: (rule: AutomationRule) => void;
  onViewHistory: (rule: AutomationRule) => void;
}

function formatConditions(rule: AutomationRule): string {
  const groupStrings = rule.conditions.groups.map((group) => {
    const conditions = group.conditions
      .map((c) => {
        const metric = SUPPORTED_METRICS.find((m) => m.key === c.metric);
        return `${metric?.label || c.metric} ${c.operator} ${c.value}`;
      })
      .join(" AND ");
    return rule.conditions.groups.length > 1 ? `(${conditions})` : conditions;
  });
  return groupStrings.join(" OR ");
}

function formatAction(rule: AutomationRule): string {
  if (rule.action_type === "pause_keyword") return "Pause keyword";
  if (rule.action_type === "enable_keyword") return "Enable keyword";
  if (rule.action_type === "adjust_bid" && rule.action_value) {
    const { type, value, unit } = rule.action_value;
    const unitLabel = unit === "percent" ? "%" : "£";
    if (type === "increase") return `Increase bid by ${value}${unitLabel}`;
    if (type === "decrease") return `Decrease bid by ${value}${unitLabel}`;
    return `Set bid to ${value}${unitLabel}`;
  }
  return rule.action_type;
}

export function RulesList({ platform, onEdit, onViewHistory }: RulesListProps) {
  const { data: rules, isLoading } = useAutomationRules(platform);
  const toggleRule = useToggleRule();
  const deleteRule = useDeleteRule();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);

  const handleDelete = async () => {
    if (ruleToDelete) {
      await deleteRule.mutateAsync(ruleToDelete.id);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No automation rules yet.</p>
        <p className="text-sm mt-1">Create your first rule to get started.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Active</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Conditions</TableHead>
            <TableHead className="hidden sm:table-cell">Action</TableHead>
            <TableHead className="hidden lg:table-cell">Frequency</TableHead>
            <TableHead className="hidden lg:table-cell">Last Run</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={(checked) =>
                    toggleRule.mutate({ id: rule.id, is_active: checked })
                  }
                />
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {rule.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <code className="text-xs bg-muted px-2 py-1 rounded max-w-[250px] truncate block">
                  {formatConditions(rule)}
                </code>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant={
                    rule.action_type === "pause_keyword"
                      ? "destructive"
                      : rule.action_type === "enable_keyword"
                      ? "default"
                      : "secondary"
                  }
                >
                  {formatAction(rule)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell capitalize">
                {rule.frequency}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                {rule.last_run_at
                  ? format(new Date(rule.last_run_at), "MMM d, HH:mm")
                  : "Never"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(rule)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewHistory(rule)}>
                      <History className="h-4 w-4 mr-2" />
                      View History
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setRuleToDelete(rule);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
