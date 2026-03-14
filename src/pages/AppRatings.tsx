import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Apple, Play, MessageSquare, RefreshCw, Loader2, Reply, Sparkles, AlertCircle, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import { useTrustpilotStats, useSyncTrustpilotReviews, useTrustpilotReviews, useRespondToTrustpilotReview } from '@/hooks/useTrustpilotReviews';
import { useGooglePlayStats, useSyncGooglePlayReviews, useGooglePlayReviews, useRespondToGooglePlayReview } from '@/hooks/useGooglePlayReviews';
import { useAppStoreStats, useSyncAppStoreReviews, useAppStoreReviews, useRespondToAppStoreReview } from '@/hooks/useAppStoreReviews';
import { useTypeformStats, useTypeformReviewsWithFeedback } from '@/hooks/useTypeformSurveys';
import { useAnalyzeReviews } from '@/hooks/useReviewSettings';
import { ReviewResponseDialog } from '@/components/ratings/ReviewResponseDialog';
import { PendingResponsesQueue } from '@/components/ratings/PendingResponsesQueue';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DateRangeFilter, DateRangeOption, getDateRange, getPreviousPeriod, CustomDateRange } from '@/components/DateRangeFilter';


interface ReviewForResponse {
  id: string;
  stars: number;
  title: string | null;
  text: string | null;
  author: string | null;
  source: 'App Store' | 'Google Play' | 'Trustpilot' | 'Typeform';
  existingResponse?: string | null;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            star <= Math.round(rating)
              ? 'fill-warning text-warning'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  );
}

function StarDistributionBar({ count, total, stars, isActive, onClick }: { 
  count: number; 
  total: number; 
  stars: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div 
      className={`flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/10' : ''}`}
      onClick={onClick}
    >
      <span className={`text-sm w-8 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{stars}★</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-primary' : 'bg-warning'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-sm w-12 text-right ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{count}</span>
    </div>
  );
}

export default function AppRatings() {
  const { toast } = useToast();
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewForResponse | null>(null);
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('mtd');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [insights, setInsights] = useState<{ issues: string; features: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const analyzeReviewsMutation = useAnalyzeReviews();

  const { stats: trustpilotStats } = useTrustpilotStats();
  const { data: trustpilotReviews } = useTrustpilotReviews();
  const trustpilotSyncMutation = useSyncTrustpilotReviews();
  const trustpilotRespondMutation = useRespondToTrustpilotReview();

  const { stats: googlePlayStats } = useGooglePlayStats();
  const { data: googlePlayReviews } = useGooglePlayReviews();
  const googlePlaySyncMutation = useSyncGooglePlayReviews();
  const googlePlayRespondMutation = useRespondToGooglePlayReview();

  const { stats: appStoreStats } = useAppStoreStats();
  const { data: appStoreReviews } = useAppStoreReviews();
  const appStoreSyncMutation = useSyncAppStoreReviews();
  const appStoreRespondMutation = useRespondToAppStoreReview();

  // Typeform surveys
  const { stats: typeformStats } = useTypeformStats();
  const { data: typeformReviews } = useTypeformReviewsWithFeedback();

  // Channel weights for weighted average
  const { data: channelWeights } = useChannelWeights();

  const handleTrustpilotSync = async () => {
    try {
      const result = await trustpilotSyncMutation.mutateAsync();
      toast({
        title: "Sync Complete",
        description: `Synced ${result.totalReviews} reviews from Trustpilot`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync Trustpilot reviews",
        variant: "destructive",
      });
    }
  };

  const handleGooglePlaySync = async () => {
    try {
      const result = await googlePlaySyncMutation.mutateAsync();
      toast({
        title: "Sync Complete",
        description: `Synced ${result.totalReviews} reviews from Google Play`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync Google Play reviews",
        variant: "destructive",
      });
    }
  };

  const handleAppStoreSync = async () => {
    try {
      const result = await appStoreSyncMutation.mutateAsync();
      toast({
        title: "Sync Complete",
        description: `Synced ${result.reviewsCount} reviews from App Store`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync App Store reviews",
        variant: "destructive",
      });
    }
  };

  const handleSyncAll = async () => {
    await Promise.allSettled([
      trustpilotSyncMutation.mutateAsync(),
      googlePlaySyncMutation.mutateAsync(),
      appStoreSyncMutation.mutateAsync(),
    ]);
    toast({
      title: "Sync Complete",
      description: "All review sources have been synced",
    });
  };

  const isSyncing = trustpilotSyncMutation.isPending || googlePlaySyncMutation.isPending || appStoreSyncMutation.isPending;
  const isResponding = googlePlayRespondMutation.isPending || appStoreRespondMutation.isPending || trustpilotRespondMutation.isPending;

  const handleRespondToReview = async (reviewId: string, responseText: string) => {
    if (!selectedReview) return;

    try {
      if (selectedReview.source === 'App Store') {
        await appStoreRespondMutation.mutateAsync({ reviewId, responseText });
      } else if (selectedReview.source === 'Google Play') {
        await googlePlayRespondMutation.mutateAsync({ reviewId, responseText });
      } else if (selectedReview.source === 'Trustpilot') {
        await trustpilotRespondMutation.mutateAsync({ reviewId, responseText });
      }
      toast({
        title: "Response Submitted",
        description: `Your response has been posted to ${selectedReview.source}`,
      });
    } catch (error) {
      toast({
        title: "Response Failed",
        description: error instanceof Error ? error.message : "Failed to submit response",
        variant: "destructive",
      });
      throw error; // Re-throw so dialog stays open
    }
  };

  const openResponseDialog = (review: ReviewForResponse) => {
    setSelectedReview(review);
    setResponseDialogOpen(true);
  };

  const ratingsSources = [
    {
      id: 'apple',
      name: 'App Store',
      icon: Apple,
      rating: appStoreStats.averageRating,
      reviews: appStoreStats.totalReviews,
    },
    {
      id: 'google',
      name: 'Google Play',
      icon: Play,
      rating: googlePlayStats.averageRating,
      reviews: googlePlayStats.totalReviews,
    },
    {
      id: 'trustpilot',
      name: 'Trustpilot',
      icon: MessageSquare,
      rating: trustpilotStats.averageRating,
      reviews: trustpilotStats.totalReviews,
    },
    {
      id: 'typeform',
      name: 'Typeform',
      icon: FileText,
      rating: typeformStats.averageRating,
      reviews: typeformStats.totalResponses,
    },
  ];

  const connectedSources = ratingsSources.filter(s => s.reviews > 0);
  
  // Calculate weighted average rating
  const getWeightedAverage = (sources: typeof connectedSources) => {
    if (sources.length === 0) return 0;
    
    const weights = {
      'App Store': channelWeights?.app_store_weight ?? 1,
      'Google Play': channelWeights?.google_play_weight ?? 1,
      'Trustpilot': channelWeights?.trustpilot_weight ?? 1,
      'Typeform': channelWeights?.typeform_weight ?? 1,
    };
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    sources.forEach(source => {
      const weight = weights[source.name as keyof typeof weights] ?? 1;
      weightedSum += source.rating * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };
  
  const overallRating = getWeightedAverage(connectedSources);
  const totalReviewsCount = ratingsSources.reduce((sum, s) => sum + s.reviews, 0);

  // Combine all reviews for recent display
  const allReviews = [
    ...(trustpilotReviews || []).map(r => ({
      id: r.id,
      stars: r.stars,
      title: r.title,
      text: r.text,
      author: r.consumer_display_name,
      date: r.created_at,
      source: 'Trustpilot' as const,
      isVerified: r.is_verified,
      existingResponse: r.response_text,
      canRespond: true,
    })),
    ...(googlePlayReviews || []).map(r => ({
      id: r.id,
      stars: r.stars,
      title: r.title,
      text: r.text,
      author: r.author_name,
      date: r.review_created_at,
      source: 'Google Play' as const,
      isVerified: false,
      existingResponse: r.response_text || r.developer_reply_text,
      canRespond: true,
    })),
    ...(appStoreReviews || []).map(r => ({
      id: r.id,
      stars: r.stars,
      title: r.title,
      text: r.text,
      author: r.author_name,
      date: r.created_at,
      source: 'App Store' as const,
      isVerified: false,
      existingResponse: r.response_text,
      canRespond: true,
    })),
    // Only include Typeform surveys that have feedback text
    ...(typeformReviews || []).map(r => ({
      id: r.id,
      stars: r.rating,
      title: null,
      text: r.feedback_text,
      author: r.email,
      date: r.submitted_at,
      source: 'Typeform' as const,
      isVerified: false,
      existingResponse: null,
      canRespond: false, // No response mechanism for Typeform
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter reviews by date range
  const dateRange = getDateRange(dateRangeOption, customDateRange);
  const prevDateRange = getPreviousPeriod(dateRangeOption, customDateRange);
  
  const filteredReviews = allReviews.filter(review => {
    const reviewDate = new Date(review.date);
    if (dateRange.startDate && reviewDate < dateRange.startDate) return false;
    // Add 1 day to endDate to include reviews from the end date
    const endOfDay = new Date(dateRange.endDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    if (reviewDate > endOfDay) return false;
    return true;
  });
  
  // Filter reviews for previous period
  const prevFilteredReviews = prevDateRange ? allReviews.filter(review => {
    const reviewDate = new Date(review.date);
    if (prevDateRange.startDate && reviewDate < prevDateRange.startDate) return false;
    const endOfDay = new Date(prevDateRange.endDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    if (reviewDate > endOfDay) return false;
    return true;
  }) : [];

  // Calculate filtered stats from filteredReviews
  const filteredStarDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  filteredReviews.forEach(review => {
    if (review.stars >= 1 && review.stars <= 5) {
      filteredStarDistribution[review.stars]++;
    }
  });
  
  const filteredTotalReviews = filteredReviews.length;
  const prevFilteredTotalReviews = prevFilteredReviews.length;
  
  // Calculate per-source filtered stats
  const getFilteredSourceStats = (source: 'App Store' | 'Google Play' | 'Trustpilot' | 'Typeform', reviews: typeof filteredReviews) => {
    const sourceReviews = reviews.filter(r => r.source === source);
    const count = sourceReviews.length;
    const avgRating = count > 0 ? sourceReviews.reduce((sum, r) => sum + r.stars, 0) / count : 0;
    return { reviews: count, rating: avgRating };
  };

  const filteredSourceStats = {
    'App Store': getFilteredSourceStats('App Store', filteredReviews),
    'Google Play': getFilteredSourceStats('Google Play', filteredReviews),
    'Trustpilot': getFilteredSourceStats('Trustpilot', filteredReviews),
    'Typeform': getFilteredSourceStats('Typeform', filteredReviews),
  };
  
  const prevFilteredSourceStats = {
    'App Store': getFilteredSourceStats('App Store', prevFilteredReviews),
    'Google Play': getFilteredSourceStats('Google Play', prevFilteredReviews),
    'Trustpilot': getFilteredSourceStats('Trustpilot', prevFilteredReviews),
    'Typeform': getFilteredSourceStats('Typeform', prevFilteredReviews),
  };

  // Calculate weighted filtered average
  const calculateWeightedAverage = (sourceStats: typeof filteredSourceStats) => {
    const sources = Object.entries(sourceStats)
      .filter(([_, stats]) => stats.reviews > 0)
      .map(([name, stats]) => ({ name, ...stats }));
    
    if (sources.length === 0) return 0;
    
    const weights = {
      'App Store': channelWeights?.app_store_weight ?? 1,
      'Google Play': channelWeights?.google_play_weight ?? 1,
      'Trustpilot': channelWeights?.trustpilot_weight ?? 1,
      'Typeform': channelWeights?.typeform_weight ?? 1,
    };
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    sources.forEach(source => {
      const weight = weights[source.name as keyof typeof weights] ?? 1;
      weightedSum += source.rating * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };
  
  const filteredAverageRating = calculateWeightedAverage(filteredSourceStats);
  const prevFilteredAverageRating = calculateWeightedAverage(prevFilteredSourceStats);
  
  // Calculate percentage changes
  const calculateChange = (current: number, previous: number): number | undefined => {
    if (!prevDateRange) return undefined;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  const ratingChange = calculateChange(filteredAverageRating, prevFilteredAverageRating);
  const reviewsChange = calculateChange(filteredTotalReviews, prevFilteredTotalReviews);

  // Combined star distribution (for lifetime view, use original stats)
  const combinedStarDistribution: Record<number, number> = dateRangeOption === 'lifetime' 
    ? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    : filteredStarDistribution;
    
  if (dateRangeOption === 'lifetime') {
    [trustpilotStats.starDistribution, googlePlayStats.starDistribution, appStoreStats.starDistribution, typeformStats.starDistribution].forEach(dist => {
      Object.entries(dist).forEach(([star, count]) => {
        combinedStarDistribution[parseInt(star)] += count;
      });
    });
  }

  // Get negative reviews (1-3 stars) for insights
  const negativeReviews = filteredReviews.filter(r => r.stars <= 3);

  const handleGenerateInsights = async () => {
    if (negativeReviews.length === 0) {
      setInsights({ 
        issues: "No negative reviews to analyze in this period.", 
        features: "No negative reviews to analyze in this period." 
      });
      return;
    }

    try {
      const result = await analyzeReviewsMutation.mutateAsync(
        negativeReviews.map(r => ({
          stars: r.stars,
          title: r.title,
          text: r.text,
          source: r.source,
        }))
      );
      setInsights(result);
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze reviews",
        variant: "destructive",
      });
    }
  };

  // Reset insights and pagination when date range or star filter changes
  useEffect(() => {
    setInsights(null);
    setVisibleCount(10);
  }, [dateRangeOption, starFilter]);

  // Get the filtered reviews for display
  const displayReviews = filteredReviews.filter(review => starFilter === null || review.stars === starFilter);
  const hasMoreReviews = visibleCount < displayReviews.length;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreReviews) {
          setVisibleCount(prev => prev + 10);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreReviews]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Manager</h1>
          <p className="text-muted-foreground">
            Monitor ratings across app stores and review platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter 
            selectedOption={dateRangeOption} 
            onChange={setDateRangeOption}
            customRange={customDateRange}
            onCustomRangeChange={setCustomDateRange}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSyncAll}
            disabled={isSyncing}
            title="Sync All Reviews"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Overall Rating Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-6xl font-bold gradient-text">
                {dateRangeOption === 'lifetime' 
                  ? (overallRating > 0 ? overallRating.toFixed(2) : '—')
                  : (filteredAverageRating > 0 ? filteredAverageRating.toFixed(2) : '—')
                }
              </div>
              {(dateRangeOption === 'lifetime' ? overallRating : filteredAverageRating) > 0 && (
                <StarRating rating={dateRangeOption === 'lifetime' ? overallRating : filteredAverageRating} />
              )}
              <p className="text-sm text-muted-foreground mt-2">Overall Rating</p>
              {ratingChange !== undefined && dateRangeOption !== 'lifetime' && (
                <div className={`flex items-center justify-center gap-1 mt-1 text-sm font-medium ${
                  ratingChange > 0 ? 'text-success' : ratingChange < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {ratingChange > 0 && <TrendingUp className="h-4 w-4" />}
                  {ratingChange < 0 && <TrendingDown className="h-4 w-4" />}
                  {ratingChange === 0 && <Minus className="h-4 w-4" />}
                  <span>{ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)}%</span>
                </div>
              )}
            </div>
            <div className="h-16 w-px bg-border hidden md:block" />
            <div className="text-center">
              <div className="text-4xl font-bold">
                {(dateRangeOption === 'lifetime' ? totalReviewsCount : filteredTotalReviews).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {dateRangeOption === 'lifetime' ? 'Total Reviews' : `Reviews (${getDateRange(dateRangeOption).label})`}
              </p>
              {reviewsChange !== undefined && dateRangeOption !== 'lifetime' && (
                <div className={`flex items-center justify-center gap-1 mt-1 text-sm font-medium ${
                  reviewsChange > 0 ? 'text-success' : reviewsChange < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {reviewsChange > 0 && <TrendingUp className="h-4 w-4" />}
                  {reviewsChange < 0 && <TrendingDown className="h-4 w-4" />}
                  {reviewsChange === 0 && <Minus className="h-4 w-4" />}
                  <span>{reviewsChange > 0 ? '+' : ''}{Math.round(reviewsChange)}%</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rating Sources */}
      <div className="grid gap-6 md:grid-cols-3">
        {ratingsSources.map((source) => {
          const sourceStats = dateRangeOption === 'lifetime' 
            ? { rating: source.rating, reviews: source.reviews }
            : filteredSourceStats[source.name as keyof typeof filteredSourceStats];
          
          const prevSourceStats = prevFilteredSourceStats[source.name as keyof typeof prevFilteredSourceStats];
          const sourceReviewsChange = dateRangeOption !== 'lifetime' 
            ? calculateChange(sourceStats.reviews, prevSourceStats.reviews) 
            : undefined;
          
          return (
            <Card key={source.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <source.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{source.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <div className="text-3xl font-bold">
                      {sourceStats.reviews > 0 ? sourceStats.rating.toFixed(1) : '—'}
                    </div>
                    {sourceStats.reviews > 0 && <StarRating rating={sourceStats.rating} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {sourceStats.reviews.toLocaleString()} reviews
                    </p>
                    {sourceReviewsChange !== undefined && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        sourceReviewsChange > 0 ? 'text-success' : sourceReviewsChange < 0 ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {sourceReviewsChange > 0 && <TrendingUp className="h-3 w-3" />}
                        {sourceReviewsChange < 0 && <TrendingDown className="h-3 w-3" />}
                        {sourceReviewsChange === 0 && <Minus className="h-3 w-3" />}
                        {sourceReviewsChange > 0 ? '+' : ''}{Math.round(sourceReviewsChange)}%
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Star Distribution & Insights */}
      {(dateRangeOption === 'lifetime' ? totalReviewsCount : filteredTotalReviews) > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rating Distribution</CardTitle>
                  <CardDescription>
                    Click a rating to filter reviews {dateRangeOption !== 'lifetime' && `(${getDateRange(dateRangeOption).label})`}
                  </CardDescription>
                </div>
                {starFilter !== null && (
                  <Button variant="ghost" size="sm" onClick={() => setStarFilter(null)}>
                    Clear filter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <StarDistributionBar 
                    key={stars}
                    stars={stars}
                    count={combinedStarDistribution[stars] || 0}
                    total={dateRangeOption === 'lifetime' ? totalReviewsCount : filteredTotalReviews}
                    isActive={starFilter === stars}
                    onClick={() => setStarFilter(starFilter === stars ? null : stars)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insights Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>User Insights</CardTitle>
                    <CardDescription>
                      AI analysis of {negativeReviews.length} negative reviews
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInsights}
                  disabled={analyzeReviewsMutation.isPending}
                >
                  {analyzeReviewsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Analyze'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {analyzeReviewsMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">Analyzing reviews...</p>
                </div>
              ) : insights ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5 mb-1">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Issues & Bugs
                    </p>
                    <p className="text-sm text-muted-foreground">{insights.issues}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Feature Requests
                    </p>
                    <p className="text-sm text-muted-foreground">{insights.features}</p>
                  </div>
                </div>
              ) : negativeReviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No negative reviews in this period</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-2">
                    Click "Analyze" to generate AI insights from negative reviews
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Customize the analysis prompt in Settings
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Responses Queue */}
      <PendingResponsesQueue />

      {/* Recent Reviews */}
      {filteredReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Reviews</CardTitle>
            <CardDescription>
              {starFilter !== null 
                ? `Showing ${starFilter}-star reviews` 
                : (dateRangeOption === 'lifetime' ? 'Latest reviews from all sources' : `Reviews from ${dateRange.label.toLowerCase()}`)}
              {' '}({displayReviews.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayReviews
                .slice(0, visibleCount)
                .map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.stars} />
                      <Badge variant="secondary" className="text-xs">
                        {review.source}
                      </Badge>
                      {review.isVerified && (
                        <Badge variant="outline" className="text-xs">Verified</Badge>
                      )}
                      {review.existingResponse && (
                        <Badge variant="outline" className="text-xs text-success border-success">
                          Responded
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(review.date), 'MMM d, yyyy')}
                      </span>
                      {review.canRespond && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResponseDialog({
                            id: review.id,
                            stars: review.stars,
                            title: review.title,
                            text: review.text,
                            author: review.author,
                            source: review.source,
                            existingResponse: review.existingResponse,
                          })}
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {review.title && (
                    <h4 className="font-medium mb-1">{review.title}</h4>
                  )}
                  {review.text && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{review.text}</p>
                  )}
                  {review.author && (
                    <p className="text-xs text-muted-foreground mt-2">
                      — {review.author}
                    </p>
                  )}
                  {review.existingResponse && (
                    <div className="mt-3 pl-4 border-l-2 border-primary/30">
                      <p className="text-xs font-medium text-primary mb-1">Your response:</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{review.existingResponse}</p>
                    </div>
                  )}
                </div>
              ))}
              {/* Infinite scroll sentinel */}
              {hasMoreReviews && (
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ReviewResponseDialog
        open={responseDialogOpen}
        onOpenChange={setResponseDialogOpen}
        review={selectedReview}
        onSubmit={handleRespondToReview}
        isSubmitting={isResponding}
      />
    </div>
  );
}
