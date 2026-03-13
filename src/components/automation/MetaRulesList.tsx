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
import { MoreHorizontal, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import {
  useMetaAdRules,
  useSyncMetaRules,
  useToggleMetaRule,
  useDeleteMetaRule,
  formatMetaRuleConditions,
  formatMetaRuleAction,
  getTimePreset,
  getEntityType,
  MetaAdRule,
} from "@/hooks/useMetaAdRules";

export function MetaRulesList() {
  const { data: rules, isLoading } = useMetaAdRules();
  const syncRules = useSyncMetaRules();
  const toggleRule = useToggleMetaRule();
  const deleteRule = useDeleteMetaRule();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<MetaAdRule | null>(null);

  const handleDelete = async () => {
    if (ruleToDelete) {
      await deleteRule.mutateAsync(ruleToDelete.meta_rule_id);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ENABLED":
        return <Badge variant="default">Enabled</Badge>;
      case "DISABLED":
        return <Badge variant="secondary">Disabled</Badge>;
      case "HAS_ISSUES":
        return <Badge variant="destructive">Has Issues</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEntityTypeBadge = (entityType: string) => {
    switch (entityType) {
      case "AD":
        return <Badge variant="outline">Ads</Badge>;
      case "ADSET":
        return <Badge variant="outline">Ad Sets</Badge>;
      case "CAMPAIGN":
        return <Badge variant="outline">Campaigns</Badge>;
      default:
        return <Badge variant="outline">{entityType}</Badge>;
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

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncRules.mutate()}
          disabled={syncRules.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncRules.isPending ? "animate-spin" : ""}`} />
          Sync from Meta
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No Meta ad rules synced yet.</p>
          <p className="text-sm mt-1">
            Click "Sync from Meta" to import your existing rules.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Applies To</TableHead>
              <TableHead className="hidden lg:table-cell">Conditions</TableHead>
              <TableHead className="hidden sm:table-cell">Action</TableHead>
              <TableHead className="hidden lg:table-cell">Schedule</TableHead>
              <TableHead className="hidden xl:table-cell">Last Synced</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <Switch
                    checked={rule.status === "ENABLED"}
                    onCheckedChange={(checked) =>
                      toggleRule.mutate({
                        ruleId: rule.meta_rule_id,
                        enabled: checked,
                      })
                    }
                    disabled={toggleRule.isPending}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    {rule.created_by_name && (
                      <div className="text-xs text-muted-foreground">
                        by {rule.created_by_name}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {getEntityTypeBadge(getEntityType(rule))}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                    {formatMetaRuleConditions(rule) || "No conditions"}
                  </code>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{formatMetaRuleAction(rule)}</Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell capitalize">
                  {rule.schedule_spec?.schedule_type?.toLowerCase() || "Daily"}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                  {format(new Date(rule.synced_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://business.facebook.com/adsmanager/manage/campaigns?act=${rule.account_id}&tool=AUTOMATED_RULES`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View in Meta
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
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This will
              also delete the rule from Meta Ads Manager. This action cannot be
              undone.
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
