import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useSyncFunctionStatuses, SyncFunctionStatus } from '@/hooks/useSyncFunctionLogs';
import { formatDistanceToNow, format } from 'date-fns';

function StatusIcon({ status }: { status: 'running' | 'success' | 'error' | null }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'running':
      return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: 'running' | 'success' | 'error' | null }) {
  switch (status) {
    case 'success':
      return (
        <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
          Success
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
          Failed
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500/30 text-xs">
          Running
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground text-xs">
          Never Run
        </Badge>
      );
  }
}

function SyncFunctionRow({ status }: { status: SyncFunctionStatus }) {
  const lastRun = status.last_run;
  const lastRunStatus = lastRun?.status || null;
  
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={lastRunStatus} />
        <div>
          <p className="font-medium text-sm">{status.display_name}</p>
          <p className="text-xs text-muted-foreground">{status.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {lastRun ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true })}
            </p>
            {lastRun.duration_ms && (
              <p className="text-xs text-muted-foreground">
                {lastRun.duration_ms < 1000 
                  ? `${lastRun.duration_ms}ms` 
                  : `${(lastRun.duration_ms / 1000).toFixed(1)}s`}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
        <StatusBadge status={lastRunStatus} />
      </div>
    </div>
  );
}

function SyncStatusSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SyncStatusPanel() {
  const { statuses, isLoading } = useSyncFunctionStatuses();

  // Group by category
  const categories = statuses.reduce((acc, status) => {
    if (!acc[status.category]) {
      acc[status.category] = [];
    }
    acc[status.category].push(status);
    return acc;
  }, {} as Record<string, SyncFunctionStatus[]>);

  // Calculate summary
  const successCount = statuses.filter(s => s.last_run?.status === 'success').length;
  const errorCount = statuses.filter(s => s.last_run?.status === 'error').length;
  const neverRunCount = statuses.filter(s => !s.last_run).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Automated Sync Status</CardTitle>
        </div>
        <CardDescription>
          Status of scheduled sync functions (runs 5x daily at 3am, 9am, 1pm, 4pm, 8pm)
        </CardDescription>
        <div className="flex gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">{successCount} successful</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-muted-foreground">{errorCount} failed</span>
          </div>
          {neverRunCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{neverRunCount} never run</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SyncStatusSkeleton />
        ) : (
          <div className="space-y-6">
            {Object.entries(categories).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="bg-muted/30 rounded-lg px-3">
                  {items.map(status => (
                    <SyncFunctionRow key={status.function_name} status={status} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
