import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  RotateCcw,
  X
} from 'lucide-react';
import { useCreativeFatigueAnalysis, FatiguePrediction } from '@/hooks/useCreativeFatigueAnalysis';
import { formatDistanceToNow } from 'date-fns';

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-600 bg-green-100',
    badgeVariant: 'default' as const,
    label: 'Healthy',
  },
  early_warning: {
    icon: Clock,
    color: 'text-yellow-600 bg-yellow-100',
    badgeVariant: 'secondary' as const,
    label: 'Early Warning',
  },
  fatiguing: {
    icon: AlertTriangle,
    color: 'text-orange-600 bg-orange-100',
    badgeVariant: 'outline' as const,
    label: 'Fatiguing',
  },
  fatigued: {
    icon: AlertCircle,
    color: 'text-red-600 bg-red-100',
    badgeVariant: 'destructive' as const,
    label: 'Fatigued',
  },
};

function FatiguePredictionCard({ 
  prediction, 
  onDismiss,
  onMarkRotated 
}: { 
  prediction: FatiguePrediction;
  onDismiss: () => void;
  onMarkRotated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const config = statusConfig[prediction.fatigue_status];
  const Icon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{prediction.creative_name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {prediction.platform.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.badgeVariant} className="text-xs">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {prediction.confidence}% confidence
                  </span>
                  {prediction.days_until_fatigue && (
                    <span className="text-xs text-orange-600 font-medium">
                      ~{prediction.days_until_fatigue} days until critical
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Trend Data */}
          {prediction.trend_data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {prediction.trend_data.avg_ctr_first_week !== undefined && (
                <div className="bg-muted/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">CTR (First Week)</div>
                  <div className="font-medium">{prediction.trend_data.avg_ctr_first_week.toFixed(2)}%</div>
                </div>
              )}
              {prediction.trend_data.avg_ctr_last_week !== undefined && (
                <div className="bg-muted/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">CTR (Last Week)</div>
                  <div className="font-medium">{prediction.trend_data.avg_ctr_last_week.toFixed(2)}%</div>
                </div>
              )}
              {prediction.trend_data.ctr_decline_percent !== undefined && (
                <div className="bg-muted/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">CTR Decline</div>
                  <div className={`font-medium flex items-center justify-center gap-1 ${
                    prediction.trend_data.ctr_decline_percent > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {prediction.trend_data.ctr_decline_percent > 0 && <TrendingDown className="h-3 w-3" />}
                    {prediction.trend_data.ctr_decline_percent.toFixed(1)}%
                  </div>
                </div>
              )}
              {prediction.metrics_snapshot?.days_active !== undefined && (
                <div className="bg-muted/50 rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">Days Active</div>
                  <div className="font-medium">{prediction.metrics_snapshot.days_active}</div>
                </div>
              )}
            </div>
          )}

          {/* AI Reasoning */}
          <div>
            <h5 className="text-sm font-medium mb-1">AI Analysis</h5>
            <p className="text-sm text-muted-foreground">{prediction.reasoning}</p>
          </div>

          {/* Recommended Action */}
          {prediction.recommended_action && (
            <div className="bg-primary/5 rounded-lg p-3">
              <h5 className="text-sm font-medium mb-1">Recommended Action</h5>
              <p className="text-sm">{prediction.recommended_action}</p>
            </div>
          )}

          {/* Spend Info */}
          {prediction.metrics_snapshot?.total_spend && (
            <div className="text-xs text-muted-foreground">
              Total Spend: £{prediction.metrics_snapshot.total_spend.toFixed(2)} • 
              {prediction.metrics_snapshot.total_impressions?.toLocaleString()} impressions
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={onMarkRotated}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Mark as Rotated
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CreativeFatiguePanel() {
  const {
    predictions,
    creativesNeedingAttention,
    isLoading,
    generatePredictions,
    updatePredictionStatus,
    isGenerating,
  } = useCreativeFatigueAnalysis();

  const handleDismiss = (id: string) => {
    updatePredictionStatus.mutate({ id, status: 'dismissed' });
  };

  const handleMarkRotated = (id: string) => {
    updatePredictionStatus.mutate({ id, status: 'rotated' });
  };

  const lastAnalyzed = predictions?.[0]?.created_at
    ? formatDistanceToNow(new Date(predictions[0].created_at), { addSuffix: true })
    : null;

  // Count by status
  const statusCounts = {
    fatigued: predictions?.filter(p => p.fatigue_status === 'fatigued').length || 0,
    fatiguing: predictions?.filter(p => p.fatigue_status === 'fatiguing').length || 0,
    early_warning: predictions?.filter(p => p.fatigue_status === 'early_warning').length || 0,
    healthy: predictions?.filter(p => p.fatigue_status === 'healthy').length || 0,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Creative Fatigue Prediction</CardTitle>
              <CardDescription>
                AI-powered detection of declining ad performance
                {lastAnalyzed && <span className="ml-1">• Last analyzed {lastAnalyzed}</span>}
              </CardDescription>
            </div>
          </div>
          <Button 
            onClick={() => generatePredictions.mutate({ days: 30, platform: 'all' })}
            disabled={isGenerating}
            size="sm"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Analyze Creatives
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading predictions...</div>
        ) : !predictions?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No fatigue predictions yet</p>
            <p className="text-sm">Click "Analyze Creatives" to detect fatiguing ads</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{statusCounts.fatigued}</div>
                <div className="text-xs text-muted-foreground">Fatigued</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{statusCounts.fatiguing}</div>
                <div className="text-xs text-muted-foreground">Fatiguing</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{statusCounts.early_warning}</div>
                <div className="text-xs text-muted-foreground">Early Warning</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{statusCounts.healthy}</div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>
            </div>

            {/* Predictions needing attention */}
            {creativesNeedingAttention.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Creatives Needing Attention ({creativesNeedingAttention.length})
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {creativesNeedingAttention.map((prediction) => (
                    <FatiguePredictionCard
                      key={prediction.id}
                      prediction={prediction}
                      onDismiss={() => handleDismiss(prediction.id)}
                      onMarkRotated={() => handleMarkRotated(prediction.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Healthy creatives (collapsed by default) */}
            {statusCounts.healthy > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Healthy Creatives ({statusCounts.healthy})
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {predictions
                    .filter(p => p.fatigue_status === 'healthy')
                    .map((prediction) => (
                      <FatiguePredictionCard
                        key={prediction.id}
                        prediction={prediction}
                        onDismiss={() => handleDismiss(prediction.id)}
                        onMarkRotated={() => handleMarkRotated(prediction.id)}
                      />
                    ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
