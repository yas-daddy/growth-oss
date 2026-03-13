import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Zap, 
  Target,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RefreshCw,
  Lightbulb,
  DollarSign
} from 'lucide-react';
import { useAIKeywordRecommendations, AIRecommendation } from '@/hooks/useAIKeywordRecommendations';
import { cn } from '@/lib/utils';

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string; description: string }> = {
  increase_bid: { 
    icon: TrendingUp, 
    color: 'text-green-600 bg-green-100', 
    label: 'Increase Bid',
    description: 'Raise your max CPT bid to win more impressions and scale this high-converting keyword'
  },
  decrease_bid: { 
    icon: TrendingDown, 
    color: 'text-orange-600 bg-orange-100', 
    label: 'Decrease Bid',
    description: 'Lower your max CPT bid to improve efficiency on this underperforming keyword'
  },
  pause: { 
    icon: Pause, 
    color: 'text-red-600 bg-red-100', 
    label: 'Pause',
    description: 'Stop spending on this keyword due to poor or no conversions'
  },
};

function RecommendationCard({ 
  recommendation, 
  onApply, 
  onDismiss,
  isApplying = false
}: { 
  recommendation: AIRecommendation;
  onApply: (customAction?: { newBid?: number; changePercent?: number }) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const config = typeConfig[recommendation.recommendation_type] || typeConfig.increase_bid;
  const Icon = config.icon;

  // Get current and suggested values - check metrics_snapshot for current_bid if suggested_action doesn't have it
  const metricsSnapshot = recommendation.metrics_snapshot as Record<string, unknown> | null;
  const currentBidFromSnapshot = metricsSnapshot?.current_bid ? Number(metricsSnapshot.current_bid) : 0;
  const currentBid = recommendation.suggested_action?.current_value ?? currentBidFromSnapshot;
  const suggestedBid = recommendation.suggested_action?.suggested_value ?? currentBid;
  const suggestedChangePercent = recommendation.suggested_action?.change_percent ?? 
    (currentBid > 0 ? Math.round(((suggestedBid - currentBid) / currentBid) * 100) : 0);

  // Local state for custom adjustments
  const [customBid, setCustomBid] = useState(suggestedBid);
  const [customPercent, setCustomPercent] = useState(suggestedChangePercent);

  const isBidAdjustment = ['increase_bid', 'decrease_bid'].includes(recommendation.recommendation_type);

  // Calculate bid from percentage
  const calculateBidFromPercent = (percent: number) => {
    if (currentBid <= 0) return 0;
    return Number((currentBid * (1 + percent / 100)).toFixed(2));
  };

  // Calculate percentage from bid
  const calculatePercentFromBid = (bid: number) => {
    if (currentBid <= 0) return 0;
    return Math.round(((bid - currentBid) / currentBid) * 100);
  };

  const handlePercentChange = (value: number[]) => {
    const percent = value[0];
    setCustomPercent(percent);
    setCustomBid(calculateBidFromPercent(percent));
  };

  const handleBidChange = (value: string) => {
    const bid = parseFloat(value) || 0;
    setCustomBid(bid);
    setCustomPercent(calculatePercentFromBid(bid));
  };

  const handleApply = () => {
    if (isBidAdjustment && isEditing) {
      onApply({ newBid: customBid, changePercent: customPercent });
    } else {
      onApply();
    }
  };

  // Determine slider range based on recommendation type
  const getSliderRange = () => {
    if (recommendation.recommendation_type === 'increase_bid') {
      return { min: 0, max: 100, step: 5 };
    } else if (recommendation.recommendation_type === 'decrease_bid') {
      return { min: -75, max: 0, step: 5 };
    }
    return { min: -50, max: 100, step: 5 };
  };

  const sliderRange = getSliderRange();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn('p-2 rounded-lg', config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{recommendation.keyword_text}</span>
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {recommendation.confidence}% confident
                </Badge>
              </div>
              
              {/* Quick summary of suggested action */}
              {isBidAdjustment && currentBid > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">Current bid:</span> £{currentBid.toFixed(2)} → 
                  <span className={cn(
                    "font-medium ml-1",
                    recommendation.recommendation_type === 'increase_bid' ? 'text-green-600' : 'text-orange-600'
                  )}>
                    £{suggestedBid.toFixed(2)}
                  </span>
                  <span className={cn(
                    "ml-1",
                    recommendation.recommendation_type === 'increase_bid' ? 'text-green-600' : 'text-orange-600'
                  )}>
                    ({suggestedChangePercent > 0 ? '+' : ''}{suggestedChangePercent}%)
                  </span>
                </div>
              )}

              {/* Show description for non-bid recommendations */}
              {!isBidAdjustment && (
                <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
              )}
              
              <CollapsibleTrigger asChild>
                <button className="text-sm text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1">
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {isOpen ? 'Hide details' : 'Show details'}
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onDismiss}
              disabled={isApplying}
              className="h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (isBidAdjustment && !isEditing) {
                  setIsEditing(true);
                  setIsOpen(true);
                } else {
                  handleApply();
                }
              }}
              disabled={isApplying}
              className="h-8 px-3"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {isEditing ? 'Confirm' : 'Apply'}
                </>
              )}
            </Button>
          </div>
        </div>
        
        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Bid Adjustment Controls */}
            {isBidAdjustment && currentBid > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Bid Adjustment
                  </h4>
                  {!isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      Customize
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    {/* Percentage Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Bid Adjustment</Label>
                        <span className={cn(
                          "text-sm font-medium",
                          customPercent > 0 ? 'text-green-600' : customPercent < 0 ? 'text-orange-600' : ''
                        )}>
                          {customPercent > 0 ? '+' : ''}{customPercent}%
                        </span>
                      </div>
                      <Slider
                        value={[customPercent]}
                        onValueChange={handlePercentChange}
                        min={sliderRange.min}
                        max={sliderRange.max}
                        step={sliderRange.step}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{sliderRange.min}%</span>
                        <span>{sliderRange.max}%</span>
                      </div>
                    </div>

                    {/* New Bid Input */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Current Max CPT Bid</Label>
                        <div className="text-lg font-semibold">£{currentBid.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-bid" className="text-xs text-muted-foreground">New Max CPT Bid</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                          <Input
                            id="new-bid"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={customBid}
                            onChange={(e) => handleBidChange(e.target.value)}
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Final change:</span>
                      <span className={cn(
                        "font-medium",
                        customPercent > 0 ? 'text-green-600' : customPercent < 0 ? 'text-orange-600' : ''
                      )}>
                        £{currentBid.toFixed(2)} → £{customBid.toFixed(2)} ({customPercent > 0 ? '+' : ''}{customPercent}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-muted-foreground">AI Suggested: </span>
                      <span className="font-medium">£{currentBid.toFixed(2)} → £{suggestedBid.toFixed(2)}</span>
                    </div>
                    <Badge variant={recommendation.recommendation_type === 'increase_bid' ? 'default' : 'secondary'}>
                      {suggestedChangePercent > 0 ? '+' : ''}{suggestedChangePercent}%
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Action description for pause */}
            {recommendation.recommendation_type === 'pause' && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Recommended Action</h4>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
            )}

            {/* AI Reasoning */}
            <div>
              <h4 className="text-sm font-medium mb-1">AI Reasoning</h4>
              <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
            </div>

            {/* Metrics Snapshot */}
            {recommendation.metrics_snapshot && (
              <div>
                <h4 className="text-sm font-medium mb-2">Current Metrics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {Object.entries(recommendation.metrics_snapshot as Record<string, unknown>)
                    .filter(([key]) => ['spend', 'installs', 'ftds', 'bets', 'cpi', 'cpa_ftd', 'cvr_install_to_ftd', 'cvr_install_to_bet'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="bg-muted/50 rounded p-2">
                        <div className="text-muted-foreground text-xs uppercase">
                          {key.replace(/_/g, ' ').replace('cvr', 'CVR')}
                        </div>
                        <div className="font-medium">
                          {key.includes('spend') || key.includes('cpi') || key.includes('cpa') 
                            ? `$${Number(value).toFixed(2)}` 
                            : String(value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function AIKeywordInsights() {
  const {
    pendingRecommendations,
    isLoading,
    generateRecommendations,
    updateRecommendationStatus,
    applyBidChange,
    isGenerating,
    isApplyingBid,
  } = useAIKeywordRecommendations();

  const handleApply = async (
    recommendation: AIRecommendation,
    customAction?: { newBid?: number; changePercent?: number }
  ) => {
    const isBidAdjustment = ['increase_bid', 'decrease_bid'].includes(recommendation.recommendation_type);
    
    if (isBidAdjustment && recommendation.keyword_id && customAction?.newBid) {
      // Actually update the bid in Apple Search Ads
      try {
        await applyBidChange.mutateAsync({
          keyword_id: recommendation.keyword_id,
          new_bid: customAction.newBid,
        });
        // Mark as applied after successful API call
        updateRecommendationStatus.mutate({ id: recommendation.id, status: 'applied' });
      } catch (error) {
        // Error is already shown via toast in the mutation
        console.error('Failed to apply bid change:', error);
      }
    } else {
      // For non-bid recommendations, just mark as applied
      updateRecommendationStatus.mutate({ id: recommendation.id, status: 'applied' });
    }
  };

  const handleDismiss = (id: string) => {
    updateRecommendationStatus.mutate({ id, status: 'dismissed' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">AI Keyword Insights</CardTitle>
              <CardDescription>
                AI-powered recommendations focused on FTD and Bet optimization
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => generateRecommendations.mutate(14)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : pendingRecommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending recommendations</p>
            <p className="text-sm mt-1">
              Click "Generate Insights" to analyze your keyword performance
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onApply={(customAction) => handleApply(rec, customAction)}
                onDismiss={() => handleDismiss(rec.id)}
                isApplying={isApplyingBid}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
