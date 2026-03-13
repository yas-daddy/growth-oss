import { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Lightbulb,
  Search,
  Film,
  BarChart3,
  X,
  Check,
  RefreshCw,
  RotateCcw,
  Edit2,
  Image,
  Filter,
  Brain
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAIKeywordRecommendations, AIRecommendation } from '@/hooks/useAIKeywordRecommendations';
import { useCreativeFatigueAnalysis, FatiguePrediction } from '@/hooks/useCreativeFatigueAnalysis';
import { useBudgetRecommendations, BudgetRecommendation } from '@/hooks/useBudgetRecommendations';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Unified recommendation type
type UnifiedRecommendation = {
  id: string;
  type: 'keyword' | 'creative' | 'budget';
  channel: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'applied' | 'dismissed' | 'active' | 'rotated';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  reasoning: string;
  recommendedAction: string;
  metrics?: Record<string, any>;
  originalData: AIRecommendation | FatiguePrediction | BudgetRecommendation;
  createdAt: string;
  thumbnailUrl?: string;
};

const priorityConfig = {
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', label: 'High Priority' },
  medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400', label: 'Medium Priority' },
  low: { color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400', label: 'Low Priority' },
};

const typeConfig = {
  keyword: { icon: Search, color: 'text-blue-600', label: 'Keyword' },
  creative: { icon: Film, color: 'text-purple-600', label: 'Creative' },
  budget: { icon: DollarSign, color: 'text-green-600', label: 'Budget' },
};

const channelConfig: Record<string, { label: string; color: string }> = {
  apple: { label: 'Apple Search Ads', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  meta: { label: 'Meta', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  moloco: { label: 'Moloco', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  affiliates: { label: 'Affiliates', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  blended: { label: 'Cross-Channel', color: 'bg-gradient-to-r from-blue-100 to-purple-100 text-gray-800' },
};

function RecommendationCard({ 
  recommendation, 
  onApply, 
  onDismiss,
  isApplying = false,
  canApply = false,
  initialOpen = false
}: { 
  recommendation: UnifiedRecommendation;
  onApply: (customBid?: number) => void;
  onDismiss: () => void;
  isApplying?: boolean;
  canApply?: boolean;
  initialOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isEditingBid, setIsEditingBid] = useState(false);
  const TypeIcon = typeConfig[recommendation.type].icon;
  const channelInfo = channelConfig[recommendation.channel] || { label: recommendation.channel, color: 'bg-gray-100' };

  // Bid adjustment state for keywords
  const keywordData = recommendation.type === 'keyword' ? recommendation.originalData as AIRecommendation : null;
  const currentBid = keywordData?.suggested_action?.current_value || 0;
  const suggestedBid = keywordData?.suggested_action?.suggested_value || 0;
  const suggestedPercent = keywordData?.suggested_action?.change_percent || 0;

  const [customBid, setCustomBid] = useState(suggestedBid);
  const [customPercent, setCustomPercent] = useState(suggestedPercent);

  const isBidAdjustment = keywordData && 
    ['increase_bid', 'decrease_bid'].includes(keywordData.recommendation_type);

  // Calculate slider range based on recommendation type
  const sliderRange = useMemo(() => {
    if (!isBidAdjustment) return { min: -50, max: 50, step: 5 };
    return keywordData?.recommendation_type === 'increase_bid' 
      ? { min: 0, max: 100, step: 5 }
      : { min: -75, max: 0, step: 5 };
  }, [isBidAdjustment, keywordData?.recommendation_type]);

  const handlePercentChange = (values: number[]) => {
    const newPercent = values[0];
    setCustomPercent(newPercent);
    if (currentBid > 0) {
      const newBid = currentBid * (1 + newPercent / 100);
      setCustomBid(Math.max(0.01, parseFloat(newBid.toFixed(2))));
    }
  };

  const handleBidChange = (value: string) => {
    const newBid = parseFloat(value) || 0;
    setCustomBid(Math.max(0.01, newBid));
    if (currentBid > 0) {
      const percentChange = ((newBid - currentBid) / currentBid) * 100;
      setCustomPercent(Math.round(percentChange));
    }
  };

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBidAdjustment && isEditingBid) {
      onApply(customBid);
    } else {
      onApply();
    }
  };

  const getActionIcon = () => {
    if (recommendation.type === 'keyword') {
      if (keywordData?.recommendation_type === 'increase_bid') return <TrendingUp className="h-4 w-4 text-green-600" />;
      if (keywordData?.recommendation_type === 'decrease_bid') return <TrendingDown className="h-4 w-4 text-orange-600" />;
      if (keywordData?.recommendation_type === 'pause') return <Pause className="h-4 w-4 text-red-600" />;
    }
    if (recommendation.type === 'creative') {
      const creativeData = recommendation.originalData as FatiguePrediction;
      if (creativeData.fatigue_status === 'fatigued') return <AlertCircle className="h-4 w-4 text-red-600" />;
      if (creativeData.fatigue_status === 'fatiguing') return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      if (creativeData.fatigue_status === 'early_warning') return <Clock className="h-4 w-4 text-yellow-600" />;
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (recommendation.type === 'budget') {
      const budgetData = recommendation.originalData as BudgetRecommendation;
      if (budgetData.action_type === 'increase') return <TrendingUp className="h-4 w-4 text-green-600" />;
      if (budgetData.action_type === 'decrease') return <TrendingDown className="h-4 w-4 text-orange-600" />;
      if (budgetData.action_type === 'reallocate') return <RotateCcw className="h-4 w-4 text-blue-600" />;
      if (budgetData.action_type === 'pause') return <Pause className="h-4 w-4 text-red-600" />;
    }
    return <Lightbulb className="h-4 w-4" />;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Thumbnail for creative recommendations */}
              {recommendation.type === 'creative' && recommendation.thumbnailUrl ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img 
                    src={recommendation.thumbnailUrl} 
                    alt={recommendation.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                      const icon = document.createElement('div');
                      icon.innerHTML = '<svg class="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                      e.currentTarget.parentElement?.appendChild(icon);
                    }}
                  />
                </div>
              ) : recommendation.type === 'creative' ? (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-muted">
                  {getActionIcon()}
                </div>
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm truncate">{recommendation.title}</h4>
                  <Badge variant="outline" className={`text-xs ${channelInfo.color}`}>
                    {channelInfo.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <TypeIcon className={`h-3 w-3 mr-1 ${typeConfig[recommendation.type].color}`} />
                    {typeConfig[recommendation.type].label}
                  </Badge>
                </div>
                {recommendation.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{recommendation.subtitle}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs ${priorityConfig[recommendation.priority].color}`}>
                    {priorityConfig[recommendation.priority].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {recommendation.confidence}% confidence
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {(recommendation.status === 'pending' || recommendation.status === 'active') ? (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : (
                <Badge variant={recommendation.status === 'applied' ? 'default' : 'secondary'}>
                  {recommendation.status}
                </Badge>
              )}
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-3">
          <div>
            <h5 className="text-sm font-medium mb-1">AI Analysis</h5>
            <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
          </div>

          <div className="bg-primary/5 rounded-lg p-3">
            <h5 className="text-sm font-medium mb-1">Recommended Action</h5>
            <p className="text-sm">{recommendation.recommendedAction}</p>
          </div>

          {/* Bid Adjustment Controls for Keywords */}
          {isBidAdjustment && currentBid > 0 && canApply && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Bid Adjustment
                </h5>
                {!isEditingBid ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setIsEditingBid(true); }}
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Customize
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setIsEditingBid(false);
                      setCustomBid(suggestedBid);
                      setCustomPercent(suggestedPercent);
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>

              {isEditingBid ? (
                <div className="space-y-4">
                  {/* Percentage Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Adjustment</Label>
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

                  {/* Bid Input */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Current Bid</Label>
                      <div className="text-lg font-semibold">£{currentBid.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-bid" className="text-xs text-muted-foreground">New Bid</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                        <Input
                          id="custom-bid"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={customBid}
                          onChange={(e) => handleBidChange(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Suggested change:</span>
                  <span className={cn(
                    "font-medium",
                    suggestedPercent > 0 ? 'text-green-600' : suggestedPercent < 0 ? 'text-orange-600' : ''
                  )}>
                    £{currentBid.toFixed(2)} → £{suggestedBid.toFixed(2)} ({suggestedPercent > 0 ? '+' : ''}{suggestedPercent?.toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>
          )}

          {recommendation.metrics && Object.keys(recommendation.metrics).length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Current Metrics</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {Object.entries(recommendation.metrics).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs uppercase truncate">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="font-medium truncate">
                      {typeof value === 'number' 
                        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Generated {formatDistanceToNow(new Date(recommendation.createdAt), { addSuffix: true })}
            </div>
            {(recommendation.status === 'pending' || recommendation.status === 'active') && canApply && (
              <Button 
                size="sm" 
                onClick={handleApplyClick}
                disabled={isApplying}
              >
                {isApplying ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                <span className="ml-1">
                  {isBidAdjustment && isEditingBid ? `Apply £${customBid.toFixed(2)}` : 'Apply'}
                </span>
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function Recommendations() {
  const location = useLocation();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  // Get recommendation ID from URL hash (e.g., #rec-123)
  const expandedRecId = location.hash?.replace('#rec-', '') || null;

  // Fetch all recommendation types
  const {
    pendingRecommendations: keywordRecs,
    isLoading: keywordLoading,
    generateRecommendations: generateKeywordRecs,
    updateRecommendationStatus: updateKeywordStatus,
    applyBidChange,
    isGenerating: isGeneratingKeywords,
    isApplyingBid,
  } = useAIKeywordRecommendations();

  const {
    predictions: creativeRecs,
    isLoading: creativeLoading,
    generatePredictions: generateCreativeRecs,
    updatePredictionStatus: updateCreativeStatus,
    pauseCreative,
    isGenerating: isGeneratingCreatives,
    isPausing: isPausingCreative,
  } = useCreativeFatigueAnalysis();

  const {
    recommendations: budgetRecs,
    isLoading: budgetLoading,
    generateRecommendations: generateBudgetRecs,
    updateRecommendationStatus: updateBudgetStatus,
    isGenerating: isGeneratingBudget,
  } = useBudgetRecommendations();

  // Fetch creative thumbnails for recommendations
  const creativeIds = useMemo(() => {
    return (creativeRecs || []).filter(p => p.status === 'active').map(p => p.creative_id);
  }, [creativeRecs]);

  const { data: metaThumbnails } = useQuery({
    queryKey: ['meta-thumbnails', creativeIds],
    queryFn: async () => {
      if (creativeIds.length === 0) return {};
      const { data } = await supabase
        .from('meta_ads')
        .select('ad_id, thumbnail_url')
        .in('ad_id', creativeIds);
      
      const thumbnailMap: Record<string, string> = {};
      (data || []).forEach(ad => {
        if (ad.thumbnail_url) thumbnailMap[ad.ad_id] = ad.thumbnail_url;
      });
      return thumbnailMap;
    },
    enabled: creativeIds.length > 0,
  });

  const { data: molocoThumbnails } = useQuery({
    queryKey: ['moloco-thumbnails', creativeIds],
    queryFn: async () => {
      if (creativeIds.length === 0) return {};
      const { data } = await supabase
        .from('moloco_creatives')
        .select('creative_id, main_asset_url')
        .in('creative_id', creativeIds);
      
      const thumbnailMap: Record<string, string> = {};
      (data || []).forEach(creative => {
        if (creative.main_asset_url) thumbnailMap[creative.creative_id] = creative.main_asset_url;
      });
      return thumbnailMap;
    },
    enabled: creativeIds.length > 0,
  });

  const isLoading = keywordLoading || creativeLoading || budgetLoading;
  const isGenerating = isGeneratingKeywords || isGeneratingCreatives || isGeneratingBudget;

  // Transform all recommendations into unified format
  const unifiedRecommendations = useMemo(() => {
    const unified: UnifiedRecommendation[] = [];

    // Transform keyword recommendations
    (keywordRecs || []).forEach(rec => {
      const priority = rec.confidence >= 85 ? 'high' : rec.confidence >= 70 ? 'medium' : 'low';
      const actionLabel = rec.recommendation_type === 'increase_bid' ? 'Increase Bid' 
        : rec.recommendation_type === 'decrease_bid' ? 'Decrease Bid' : 'Pause Keyword';
      
      unified.push({
        id: rec.id,
        type: 'keyword',
        channel: 'apple',
        title: rec.keyword_text,
        subtitle: actionLabel,
        status: rec.status as any,
        priority,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
        recommendedAction: rec.suggested_action?.suggested_value 
          ? `${actionLabel} to £${rec.suggested_action.suggested_value.toFixed(2)}` 
          : actionLabel,
        metrics: rec.metrics_snapshot as Record<string, any> || undefined,
        originalData: rec,
        createdAt: rec.created_at,
      });
    });

    // Transform creative fatigue predictions
    (creativeRecs || []).filter(p => p.status === 'active').forEach(pred => {
      const priority = pred.fatigue_status === 'fatigued' ? 'high' 
        : pred.fatigue_status === 'fatiguing' ? 'high' 
        : pred.fatigue_status === 'early_warning' ? 'medium' : 'low';
      
      const statusLabel = pred.fatigue_status === 'fatigued' ? 'Rotate Immediately'
        : pred.fatigue_status === 'fatiguing' ? 'Rotate Soon'
        : pred.fatigue_status === 'early_warning' ? 'Monitor Closely' : 'Healthy';

      // Get thumbnail based on platform
      const thumbnailUrl = pred.platform === 'meta' 
        ? metaThumbnails?.[pred.creative_id]
        : molocoThumbnails?.[pred.creative_id];

      unified.push({
        id: pred.id,
        type: 'creative',
        channel: pred.platform,
        title: pred.creative_name,
        subtitle: `${statusLabel}${pred.days_until_fatigue ? ` - ~${pred.days_until_fatigue} days` : ''}`,
        status: pred.status as any,
        priority,
        confidence: pred.confidence,
        reasoning: pred.reasoning,
        recommendedAction: pred.recommended_action || statusLabel,
        metrics: {
          ...(pred.trend_data || {}),
          ...(pred.metrics_snapshot || {}),
        },
        originalData: pred,
        createdAt: pred.created_at,
        thumbnailUrl,
      });
    });

    // Transform budget recommendations
    (budgetRecs || []).filter(b => b.status === 'pending').forEach(rec => {
      const priority = rec.confidence >= 85 ? 'high' : rec.confidence >= 70 ? 'medium' : 'low';
      const actionLabel = rec.action_type === 'increase' ? 'Increase Budget'
        : rec.action_type === 'decrease' ? 'Decrease Budget'
        : rec.action_type === 'reallocate' ? 'Reallocate Budget'
        : rec.action_type === 'pause' ? 'Pause Spending' : 'Review';

      unified.push({
        id: rec.id,
        type: 'budget',
        channel: rec.channel,
        title: rec.entity_name,
        subtitle: `${actionLabel}${rec.suggested_change ? ` (${rec.suggested_change > 0 ? '+' : ''}${rec.suggested_change.toFixed(0)}%)` : ''}`,
        status: rec.status as any,
        priority,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
        recommendedAction: rec.recommended_action || actionLabel,
        metrics: rec.metrics_snapshot as Record<string, any> || undefined,
        originalData: rec,
        createdAt: rec.created_at,
      });
    });

    // Sort by priority (high first) then confidence
    return unified.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });
  }, [keywordRecs, creativeRecs, budgetRecs, metaThumbnails, molocoThumbnails]);

  // Apply filters
  const filteredRecommendations = useMemo(() => {
    return unifiedRecommendations.filter(rec => {
      if (filterType !== 'all' && rec.type !== filterType) return false;
      if (filterChannel !== 'all' && rec.channel !== filterChannel) return false;
      if (filterPriority !== 'all' && rec.priority !== filterPriority) return false;
      return true;
    });
  }, [unifiedRecommendations, filterType, filterChannel, filterPriority]);

  // Count by type
  const countByType = useMemo(() => ({
    keyword: unifiedRecommendations.filter(r => r.type === 'keyword').length,
    creative: unifiedRecommendations.filter(r => r.type === 'creative').length,
    budget: unifiedRecommendations.filter(r => r.type === 'budget').length,
  }), [unifiedRecommendations]);

  // Count by priority
  const countByPriority = useMemo(() => ({
    high: unifiedRecommendations.filter(r => r.priority === 'high').length,
    medium: unifiedRecommendations.filter(r => r.priority === 'medium').length,
    low: unifiedRecommendations.filter(r => r.priority === 'low').length,
  }), [unifiedRecommendations]);

  const handleApply = async (rec: UnifiedRecommendation, customBid?: number) => {
    if (rec.type === 'keyword') {
      const keywordData = rec.originalData as AIRecommendation;
      if (keywordData.recommendation_type === 'increase_bid' || keywordData.recommendation_type === 'decrease_bid') {
        if (keywordData.keyword_id) {
          const bidToApply = customBid || keywordData.suggested_action?.suggested_value;
          if (bidToApply) {
            await applyBidChange.mutateAsync({
              keyword_id: keywordData.keyword_id,
              new_bid: bidToApply,
            });
          }
        }
      }
      updateKeywordStatus.mutate({ id: rec.id, status: 'applied' });
    } else if (rec.type === 'creative') {
      const creativeData = rec.originalData as FatiguePrediction;
      // Only pause Meta ads for now
      if (creativeData.platform === 'meta' && creativeData.fatigue_status !== 'healthy') {
        await pauseCreative.mutateAsync({
          creative_id: creativeData.creative_id,
          creative_name: creativeData.creative_name,
          platform: creativeData.platform,
        });
      }
      updateCreativeStatus.mutate({ id: rec.id, status: 'rotated' });
    } else if (rec.type === 'budget') {
      updateBudgetStatus.mutate({ id: rec.id, status: 'applied' });
    }
  };

  const handleDismiss = (rec: UnifiedRecommendation) => {
    if (rec.type === 'keyword') {
      updateKeywordStatus.mutate({ id: rec.id, status: 'dismissed' });
    } else if (rec.type === 'creative') {
      updateCreativeStatus.mutate({ id: rec.id, status: 'dismissed' });
    } else if (rec.type === 'budget') {
      updateBudgetStatus.mutate({ id: rec.id, status: 'dismissed' });
    }
  };

  const uniqueChannels = [...new Set(unifiedRecommendations.map(r => r.channel))];

  return (
    <>
      <Helmet>
        <title>AI Recommendations | GrowthOS</title>
        <meta name="description" content="AI-powered optimization recommendations for ads, keywords, and budgets" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-muted-foreground text-sm">
            AI-powered recommendations generated automatically every Monday and Friday at 8am
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterType === 'all' && "ring-2 ring-primary"
            )}
            onClick={() => setFilterType('all')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{unifiedRecommendations.length}</div>
                  <div className="text-xs text-muted-foreground">Total Active</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterType === 'creative' && "ring-2 ring-purple-500"
            )}
            onClick={() => setFilterType('creative')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                  <Film className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{countByType.creative}</div>
                  <div className="text-xs text-muted-foreground">Creative Fatigue</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterType === 'keyword' && "ring-2 ring-blue-500"
            )}
            onClick={() => setFilterType('keyword')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                  <Search className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{countByType.keyword}</div>
                  <div className="text-xs text-muted-foreground">Keyword Recs</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterType === 'budget' && "ring-2 ring-green-500"
            )}
            onClick={() => setFilterType('budget')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{countByType.budget}</div>
                  <div className="text-xs text-muted-foreground">Budget Recs</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Recommendations ({filteredRecommendations.length})
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="keyword">Keywords ({countByType.keyword})</SelectItem>
                    <SelectItem value="creative">Creatives ({countByType.creative})</SelectItem>
                    <SelectItem value="budget">Budget ({countByType.budget})</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {uniqueChannels.map(ch => (
                      <SelectItem key={ch} value={ch}>
                        {channelConfig[ch]?.label || ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading recommendations...
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-2">No recommendations yet</p>
                <p className="text-sm text-muted-foreground">
                  Recommendations are generated automatically every Monday and Friday at 8am
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredRecommendations.map(rec => {
                  // Determine if this recommendation can be applied automatically
                  let canApply = false;
                  
                  if (rec.type === 'keyword') {
                    const keywordData = rec.originalData as AIRecommendation;
                    canApply = keywordData.recommendation_type !== 'pause' &&
                      !!keywordData.keyword_id &&
                      !!keywordData.suggested_action?.suggested_value;
                  } else if (rec.type === 'creative') {
                    const creativeData = rec.originalData as FatiguePrediction;
                    // Can pause Meta creatives that are fatigued or fatiguing
                    canApply = creativeData.platform === 'meta' && 
                      creativeData.fatigue_status !== 'healthy';
                  }
                  
                  const isApplying = (isApplyingBid && rec.type === 'keyword') || 
                    (isPausingCreative && rec.type === 'creative');
                  
                  return (
                    <RecommendationCard
                      key={`${rec.type}-${rec.id}`}
                      recommendation={rec}
                      onApply={(customBid) => handleApply(rec, customBid)}
                      onDismiss={() => handleDismiss(rec)}
                      isApplying={isApplying}
                      canApply={canApply}
                      initialOpen={rec.id === expandedRecId}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
