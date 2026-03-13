import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AutomationRule, useRuleExecutionLogs } from "@/hooks/useAutomationRules";

interface ExecutionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
}

export function ExecutionHistoryDialog({
  open,
  onOpenChange,
  rule,
}: ExecutionHistoryDialogProps) {
  const { data: logs, isLoading } = useRuleExecutionLogs(rule?.id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default">Success</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Execution History</DialogTitle>
          <DialogDescription>
            {rule?.name} - View past rule executions and their results.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No execution history yet.</p>
              <p className="text-sm mt-1">
                History will appear here after the rule runs.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {logs.map((log) => (
                <AccordionItem
                  key={log.id}
                  value={log.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4 text-left">
                      <div>
                        <div className="font-medium">
                          {format(
                            new Date(log.executed_at),
                            "MMM d, yyyy HH:mm"
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.keywords_matched} of {log.keywords_evaluated}{" "}
                          keywords matched
                        </div>
                      </div>
                      {getStatusBadge(log.status)}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {log.actions_taken && log.actions_taken.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">
                            Actions Taken:
                          </div>
                          <div className="space-y-1">
                            {log.actions_taken.map((action, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                              >
                                <span className="font-mono">
                                  {action.keyword_text || action.keyword_id}
                                </span>
                                <div className="flex items-center gap-2">
                                  {action.old_value !== undefined &&
                                    action.new_value !== undefined && (
                                      <span className="text-muted-foreground">
                                        {action.old_value} → {action.new_value}
                                      </span>
                                    )}
                                  <Badge
                                    variant={
                                      action.success ? "default" : "destructive"
                                    }
                                  >
                                    {action.success ? "✓" : "✗"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No actions were taken.
                        </div>
                      )}

                      {log.errors && log.errors.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-destructive">
                            Errors:
                          </div>
                          <div className="space-y-1">
                            {log.errors.map((error, i) => (
                              <div
                                key={i}
                                className="text-sm p-2 bg-destructive/10 text-destructive rounded"
                              >
                                {error.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
