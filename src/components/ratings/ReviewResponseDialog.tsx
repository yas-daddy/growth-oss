import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGenerateAISuggestion } from '@/hooks/useReviewSettings';
import { useToast } from '@/hooks/use-toast';

interface ReviewResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: {
    id: string;
    stars: number;
    title: string | null;
    text: string | null;
    author: string | null;
    source: string;
    existingResponse?: string | null;
  } | null;
  onSubmit: (reviewId: string, responseText: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ReviewResponseDialog({ 
  open, 
  onOpenChange, 
  review, 
  onSubmit,
  isSubmitting 
}: ReviewResponseDialogProps) {
  const { toast } = useToast();
  const [responseText, setResponseText] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const generateSuggestion = useGenerateAISuggestion();

  // Generate AI suggestion when dialog opens
  useEffect(() => {
    if (open && review && !review.existingResponse) {
      setShowEditor(false);
      setResponseText('');
      generateAISuggestion();
    } else if (open && review?.existingResponse) {
      // If there's already a response, go straight to editor
      setShowEditor(true);
      setResponseText('');
    }
  }, [open, review?.id]);

  const generateAISuggestion = () => {
    if (!review) return;
    
    generateSuggestion.mutate({
      stars: review.stars,
      title: review.title,
      text: review.text,
      author: review.author,
      source: review.source,
    }, {
      onSuccess: (result) => {
        setResponseText(result.suggestion);
        setShowEditor(true);
      },
      onError: (error) => {
        toast({
          title: "AI Suggestion Failed",
          description: error instanceof Error ? error.message : "Failed to generate suggestion",
          variant: "destructive",
        });
        setShowEditor(true); // Still show editor so user can write manually
      }
    });
  };

  // Platform-specific character limits
  const getMaxLength = () => {
    if (review?.source === 'Google Play') return 350;
    if (review?.source === 'App Store') return 5970;
    return 4096; // Trustpilot
  };
  
  const maxLength = getMaxLength();
  const isOverLimit = responseText.length > maxLength;

  const handleSubmit = async () => {
    if (!review || !responseText.trim() || isOverLimit) return;
    try {
      await onSubmit(review.id, responseText.trim());
      // Only close and reset on success
      setResponseText('');
      setShowEditor(false);
      onOpenChange(false);
    } catch {
      // Error is handled by parent - dialog stays open
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResponseText('');
      setShowEditor(false);
      generateSuggestion.reset();
    }
    onOpenChange(newOpen);
  };

  if (!review) return null;

  const isGenerating = generateSuggestion.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Respond to Review</DialogTitle>
          <DialogDescription>
            Your response will be posted publicly on {review.source}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Review preview */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.stars
                        ? 'fill-warning text-warning'
                        : 'fill-muted text-muted'
                    }`}
                  />
                ))}
              </div>
              <Badge variant="secondary" className="text-xs">{review.source}</Badge>
            </div>
            {review.title && (
              <p className="font-medium text-sm">{review.title}</p>
            )}
            {review.text && (
              <p className="text-sm text-muted-foreground">{review.text}</p>
            )}
            {review.author && (
              <p className="text-xs text-muted-foreground">— {review.author}</p>
            )}
          </div>

          {review.existingResponse && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium text-primary mb-1">Your previous response:</p>
              <p className="text-sm">{review.existingResponse}</p>
            </div>
          )}

          {/* AI Generating State */}
          {isGenerating && !showEditor && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="relative">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Generating AI suggestion...</p>
            </div>
          )}

          {/* Response editor */}
          {showEditor && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="response">
                  {responseText && !review.existingResponse ? 'AI Suggested Response' : 'Your Response'}
                </Label>
                {!review.existingResponse && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateAISuggestion}
                    disabled={isGenerating}
                    className="text-xs gap-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Regenerate
                  </Button>
                )}
              </div>
              <Textarea
                id="response"
                placeholder="Write a professional, helpful response..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={5}
                maxLength={maxLength}
                className={isOverLimit ? 'border-destructive' : ''}
              />
              <p className={`text-xs text-right ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {responseText.length}/{maxLength}
                {review?.source === 'Google Play' && responseText.length > 300 && (
                  <span className="ml-2">(Google Play limit: 350)</span>
                )}
              </p>
              {responseText && !review.existingResponse && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Edit the suggestion above before submitting
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!responseText.trim() || isSubmitting || isGenerating || isOverLimit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Response'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
