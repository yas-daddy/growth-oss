import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ComplianceResult } from '@/hooks/useComplianceCheck';
import { ComplianceRule } from '@/hooks/useComplianceRules';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

function getResultStatus(r: ComplianceResult): 'pass' | 'warning' | 'fail' {
  if (r.status) return r.status;
  return r.passed ? 'pass' : 'fail';
}

interface MediaComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl?: string;
  mediaType?: 'image' | 'video';
  score?: number;
  results?: ComplianceResult[];
  rules?: ComplianceRule[];
}

export function MediaComplianceDialog({
  open,
  onOpenChange,
  previewUrl,
  mediaType,
  score,
  results,
  rules,
}: MediaComplianceDialogProps) {
  const scoreColor =
    score === undefined
      ? 'text-muted-foreground'
      : score >= 90
        ? 'text-green-600 dark:text-green-400'
        : score >= 50
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Compliance Results
            {score !== undefined && (
              <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Media preview */}
        {previewUrl && (
          <div className="rounded-lg overflow-hidden border bg-muted max-h-48 flex items-center justify-center">
            {mediaType === 'video' ? (
              <video
                src={previewUrl}
                className="max-h-48 object-contain"
                muted
                playsInline
                controls={false}
                onLoadedData={(e) => {
                  (e.target as HTMLVideoElement).currentTime = 0.1;
                }}
              />
            ) : (
              <img src={previewUrl} alt="Media preview" className="max-h-48 object-contain" />
            )}
          </div>
        )}

        {/* Results list */}
        <div className="space-y-2">
          {results && results.length > 0 ? (
            results.map((result, i) => {
              const status = getResultStatus(result);
              return (
                <div
                  key={result.rule_id || i}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-0.5">
                    {status === 'pass' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {status === 'fail' && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{rules?.find(r => r.id === result.rule_id)?.label || result.rule_id}</span>
                      <Badge
                        variant={status === 'pass' ? 'secondary' : status === 'warning' ? 'outline' : 'destructive'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{result.reason}</p>
                    {result.timestamps && result.timestamps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {result.timestamps.map((ts, j) => (
                          <Badge key={j} variant="outline" className="text-[10px]">
                            {formatTime(ts.start)} – {formatTime(ts.end)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No compliance issues found.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
