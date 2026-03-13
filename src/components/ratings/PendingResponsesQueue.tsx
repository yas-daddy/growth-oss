import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { usePendingResponses, useApproveResponse, useRejectResponse, PendingResponse } from "@/hooks/usePendingResponses";
import { Loader2, Check, X, MessageSquare, Star, Edit2, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export function PendingResponsesQueue() {
  const { data: pendingResponses, isLoading } = usePendingResponses();
  const approveResponse = useApproveResponse();
  const rejectResponse = useRejectResponse();
  const [editingResponse, setEditingResponse] = useState<PendingResponse | null>(null);
  const [editedText, setEditedText] = useState("");

  const handleApprove = (response: PendingResponse, text?: string) => {
    approveResponse.mutate({
      pendingResponse: response,
      responseText: text || response.ai_response,
    });
    setEditingResponse(null);
  };

  const handleEdit = (response: PendingResponse) => {
    setEditedText(response.ai_response);
    setEditingResponse(response);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pendingResponses || pendingResponses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Pending Responses
          </CardTitle>
          <CardDescription>AI-generated responses awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No pending responses. All caught up!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Pending Responses
            <Badge variant="secondary" className="ml-2">
              {pendingResponses.length}
            </Badge>
          </CardTitle>
          <CardDescription>AI-generated responses awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingResponses.map((response) => (
            <div key={response.id} className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{response.platform}</Badge>
                    <StarRating stars={response.review_stars} />
                    <span className="text-xs text-muted-foreground">
                      by {response.review_author || "Anonymous"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(response.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {response.review_title && (
                    <p className="font-medium text-sm">{response.review_title}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {response.review_text || "(No review text)"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/50 border-l-2 border-primary">
                <p className="text-xs text-muted-foreground mb-1">AI Suggested Response:</p>
                <p className="text-sm">{response.ai_response}</p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rejectResponse.mutate(response.id)}
                  disabled={rejectResponse.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(response)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(response)}
                  disabled={approveResponse.isPending}
                >
                  {approveResponse.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Approve & Post
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editingResponse} onOpenChange={() => setEditingResponse(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Response</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingResponse && (
              <>
                <div className="p-3 rounded-md bg-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <StarRating stars={editingResponse.review_stars} />
                    <span className="text-xs text-muted-foreground">
                      {editingResponse.review_author}
                    </span>
                  </div>
                  <p className="text-sm">{editingResponse.review_text}</p>
                </div>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={6}
                  placeholder="Edit the response..."
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editedText.length} characters
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingResponse(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingResponse && handleApprove(editingResponse, editedText)}
              disabled={approveResponse.isPending}
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
    </>
  );
}
