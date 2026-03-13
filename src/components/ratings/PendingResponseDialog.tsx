import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PendingResponse, useApproveResponse, useRejectResponse } from "@/hooks/usePendingResponses";
import { Loader2, Check, X, Star, Edit2 } from "lucide-react";

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= stars ? "fill-warning text-warning" : "fill-muted text-muted"}`}
        />
      ))}
    </div>
  );
}

interface PendingResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingResponse: PendingResponse | null;
}

export function PendingResponseDialog({
  open,
  onOpenChange,
  pendingResponse,
}: PendingResponseDialogProps) {
  const approveResponse = useApproveResponse();
  const rejectResponse = useRejectResponse();
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  // Reset state when dialog opens/closes or pendingResponse changes
  useEffect(() => {
    if (open && pendingResponse) {
      setEditedText(pendingResponse.ai_response);
      setIsEditing(false);
    }
  }, [open, pendingResponse?.id]);

  const handleApprove = () => {
    if (!pendingResponse) return;
    approveResponse.mutate(
      {
        pendingResponse,
        responseText: editedText,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleReject = () => {
    if (!pendingResponse) return;
    rejectResponse.mutate(pendingResponse.id, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  // Platform-specific character limits
  const getMaxLength = () => {
    if (pendingResponse?.platform === "Google Play") return 350;
    if (pendingResponse?.platform === "App Store") return 5970;
    return 4096; // Trustpilot
  };

  const maxLength = getMaxLength();
  const isOverLimit = editedText.length > maxLength;

  if (!pendingResponse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Review AI Response</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Review preview */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <StarRating stars={pendingResponse.review_stars} />
              <Badge variant="secondary" className="text-xs">
                {pendingResponse.platform}
              </Badge>
              {pendingResponse.review_author && (
                <span className="text-xs text-muted-foreground">
                  by {pendingResponse.review_author}
                </span>
              )}
            </div>
            {pendingResponse.review_title && (
              <p className="font-medium text-sm">{pendingResponse.review_title}</p>
            )}
            {pendingResponse.review_text && (
              <p className="text-sm text-muted-foreground">{pendingResponse.review_text}</p>
            )}
          </div>

          {/* AI Suggested Response */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">AI Suggested Response</p>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="text-xs gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-1">
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={6}
                  placeholder="Edit the response..."
                  className={isOverLimit ? "border-destructive" : ""}
                />
                <p
                  className={`text-xs text-right ${
                    isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}
                >
                  {editedText.length}/{maxLength}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/50 border-l-2 border-primary">
                <p className="text-sm">{pendingResponse.ai_response}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={rejectResponse.isPending || approveResponse.isPending}
            className="sm:mr-auto"
          >
            {rejectResponse.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1" />
            )}
            Reject
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={approveResponse.isPending || rejectResponse.isPending || isOverLimit}
          >
            {approveResponse.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Approve & Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
