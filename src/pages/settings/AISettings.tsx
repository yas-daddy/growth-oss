import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReviewSettings, useUpdateReviewSettings, DEFAULT_PROMPT, DEFAULT_INSIGHTS_PROMPT, DEFAULT_EMAIL_COPY_PROMPT } from '@/hooks/useReviewSettings';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AISettings() {
  const { toast } = useToast();
  const { data: reviewSettings } = useReviewSettings();
  const updateSettingsMutation = useUpdateReviewSettings();
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_PROMPT);
  const [insightsPrompt, setInsightsPrompt] = useState(DEFAULT_INSIGHTS_PROMPT);
  const [emailCopyPrompt, setEmailCopyPrompt] = useState(DEFAULT_EMAIL_COPY_PROMPT);

  useEffect(() => {
    if (reviewSettings?.ai_prompt) setAiPrompt(reviewSettings.ai_prompt);
    if (reviewSettings?.insights_prompt) setInsightsPrompt(reviewSettings.insights_prompt);
    if (reviewSettings?.email_copy_prompt) setEmailCopyPrompt(reviewSettings.email_copy_prompt);
  }, [reviewSettings]);

  const handleSavePrompt = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ aiPrompt });
      toast({ title: "Saved", description: "Review training prompt has been updated" });
    } catch {
      toast({ title: "Error", description: "Failed to save prompt", variant: "destructive" });
    }
  };

  const handleSaveInsightsPrompt = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ insightsPrompt });
      toast({ title: "Saved", description: "Insights prompt has been updated" });
    } catch {
      toast({ title: "Error", description: "Failed to save prompt", variant: "destructive" });
    }
  };

  const handleSaveEmailCopyPrompt = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ emailCopyPrompt });
      toast({ title: "Saved", description: "Email copy generation prompt has been updated" });
    } catch {
      toast({ title: "Error", description: "Failed to save prompt", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review AI Training</h1>
          <p className="text-muted-foreground">Customize how AI generates responses and insights</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Review Response Prompt</CardTitle>
          </div>
          <CardDescription>This prompt guides AI when generating suggested responses to customer reviews.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={6} className="font-mono text-sm" />
          <div className="flex items-center gap-2">
            <Button onClick={handleSavePrompt} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Prompt'}
            </Button>
            <Button variant="outline" onClick={() => setAiPrompt(DEFAULT_PROMPT)}>Reset to Default</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Review Insights Prompt</CardTitle>
          </div>
          <CardDescription>This prompt is used when generating insights from negative reviews.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={insightsPrompt} onChange={(e) => setInsightsPrompt(e.target.value)} rows={8} className="font-mono text-sm" />
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveInsightsPrompt} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Prompt'}
            </Button>
            <Button variant="outline" onClick={() => setInsightsPrompt(DEFAULT_INSIGHTS_PROMPT)}>Reset to Default</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Email Copy Generation Prompt</CardTitle>
          </div>
          <CardDescription>This prompt is used when generating email campaign copy (pre-header, header, body, push) from an email title.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={emailCopyPrompt} onChange={(e) => setEmailCopyPrompt(e.target.value)} rows={10} className="font-mono text-sm" />
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveEmailCopyPrompt} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Prompt'}
            </Button>
            <Button variant="outline" onClick={() => setEmailCopyPrompt(DEFAULT_EMAIL_COPY_PROMPT)}>Reset to Default</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
