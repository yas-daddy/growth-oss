import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useComplianceRules } from '@/hooks/useComplianceRules';
import { useComplianceCheck, ComplianceResult, uploadComplianceFile, extractVideoFrames } from '@/hooks/useComplianceCheck';
import { useComplianceHistory, useDismissComplianceResult } from '@/hooks/useComplianceHistory';
import { VideoCompliancePlayer } from '@/components/compliance/VideoCompliancePlayer';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Mail, Image, Video, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, 
  Loader2, Upload, FileCheck, ShieldCheck, ShieldAlert, ChevronDown, Clock, User, ShieldQuestion,
  MoreHorizontal, CheckCheck
} from 'lucide-react';

/** Normalize legacy `passed` boolean to new `status` field */
function getResultStatus(r: any): 'pass' | 'warning' | 'fail' {
  if (r.status) return r.status;
  return r.passed ? 'pass' : 'fail';
}

/** Calculate weighted compliance score excluding dismissed results */
function calcComplianceScore(results: any[]): number {
  const active = results.filter((r: any) => !r.dismissed_as);
  if (active.length === 0) return 100;
  const points = active.reduce((sum: number, r: any) => {
    const s = getResultStatus(r);
    return sum + (s === 'pass' ? 1 : s === 'warning' ? 0.5 : 0);
  }, 0);
  return Math.round((points / active.length) * 100);
}

type ContentType = 'email' | 'image' | 'video';

const contentTypeCards = [
  { type: 'email' as const, label: 'Email', description: 'Check email copy, header image and T&Cs', icon: Mail },
  { type: 'image' as const, label: 'Image', description: 'Check a static ad or creative image', icon: Image },
  { type: 'video' as const, label: 'Video', description: 'Check a video advert or creative', icon: Video },
];

export default function ComplianceChecker() {
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState<ContentType | null>(null);

  // Email fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [terms, setTerms] = useState('');
  const [headerFile, setHeaderFile] = useState<File | null>(null);

  // Image/Video
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [videoDurationState, setVideoDurationState] = useState(0);

  // Progress for video
  const [videoProgress, setVideoProgress] = useState<string | null>(null);
  const [frameProgress, setFrameProgress] = useState(0);

  // Results
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [lastCheckId, setLastCheckId] = useState<string | null>(null);

  const { data: rules = [] } = useComplianceRules();
  const complianceMutation = useComplianceCheck();
  const dismissMutation = useDismissComplianceResult();

  const enabledRules = rules.filter(
    (r) => r.enabled && r.content_types.includes(contentType || '')
  );

  const handleMediaSelect = (file: File) => {
    setMediaFile(file);
    if (file.type.startsWith('image/')) {
      setMediaPreview(URL.createObjectURL(file));
      setVideoObjectUrl(null);
    } else if (file.type.startsWith('video/')) {
      setMediaPreview(null);
      setVideoObjectUrl(URL.createObjectURL(file));
    } else {
      setMediaPreview(null);
      setVideoObjectUrl(null);
    }
  };

  const isProcessing = complianceMutation.isPending || videoProgress !== null;

  const handleCheck = async () => {
    if (!contentType) return;

    try {
      let fileUrl: string | undefined;
      let frameUrls: string[] | undefined;
      let videoDuration: number | undefined;

      if (contentType === 'image') {
        if (!mediaFile) {
          toast({ title: 'Please upload a file', variant: 'destructive' });
          return;
        }
        fileUrl = await uploadComplianceFile(mediaFile);
      } else if (contentType === 'video') {
        if (!mediaFile) {
          toast({ title: 'Please upload a file', variant: 'destructive' });
          return;
        }
        setVideoProgress('Extracting frames...');
        setFrameProgress(0);

        const frames = await extractVideoFrames(mediaFile, (current, total) => {
          setVideoProgress(`Extracting frames (${current}/${total})...`);
          setFrameProgress(Math.round((current / total) * 100));
        });

        frameUrls = frames.map((f) => f.dataUrl);
        // Estimate duration from last frame timestamp
        videoDuration = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;
        setVideoDurationState(videoDuration);

        setVideoProgress('Running AI analysis (3 parallel checks)...');
        setFrameProgress(100);
      }

      let headerImageUrl: string | undefined;
      if (contentType === 'email' && headerFile) {
        headerImageUrl = await uploadComplianceFile(headerFile);
      }

      const ruleParams = enabledRules.map((r) => ({
        id: r.id,
        label: r.label,
        description: r.description,
      }));

      const result = await complianceMutation.mutateAsync({
        content_type: contentType,
        content:
          contentType === 'email'
            ? { subject, body, terms, header_image_url: headerImageUrl }
            : undefined,
        file_url: fileUrl,
        frame_urls: frameUrls,
        video_duration: videoDuration,
        rules: ruleParams,
      });

      setResults(result.results);
      setOverallStatus(result.overall_status);
      setLastCheckId((result as any).id || null);
      setStep(3);
    } catch (err: any) {
      toast({
        title: 'Compliance check failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setVideoProgress(null);
      setFrameProgress(0);
    }
  };

  const handleReset = () => {
    setStep(1);
    setContentType(null);
    setSubject('');
    setBody('');
    setTerms('');
    setHeaderFile(null);
    setMediaFile(null);
    setMediaPreview(null);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    setVideoObjectUrl(null);
    setVideoDurationState(0);
    setResults([]);
    setOverallStatus(null);
    setActiveResultId(null);
    setLastCheckId(null);
    setVideoProgress(null);
    setFrameProgress(0);
  };

  const getRuleLabel = (ruleId: string) => {
    return rules.find((r) => r.id === ruleId)?.label || ruleId;
  };

  const handleDismissLiveResult = async (ruleId: string, action: 'ignored' | 'resolved') => {
    if (!lastCheckId) return;
    try {
      const { updatedResults, newOverall } = await dismissMutation.mutateAsync({
        checkId: lastCheckId,
        ruleId,
        action,
      });
      // Update local state immediately
      setResults(updatedResults);
      setOverallStatus(newOverall);
    } catch {
      toast({ title: 'Failed to update result', variant: 'destructive' });
    }
  };

  /** Renders a single result card with optional dismiss menu */
  const renderResultCard = (result: any, options?: { isVideo?: boolean; checkId?: string; onDismiss?: (ruleId: string, action: 'ignored' | 'resolved') => void }) => {
    const status = getResultStatus(result);
    const isDismissed = !!result.dismissed_as;
    const effectiveStatus = isDismissed ? 'pass' : status;
    const hasTimestamps = options?.isVideo && (status === 'warning' || status === 'fail') && result.timestamps?.length;
    const showMenu = (status === 'warning' || status === 'fail') && !isDismissed;

    return (
      <Card
        key={result.rule_id}
        className={`transition-all ${
          effectiveStatus === 'pass'
            ? 'border-emerald-500/20'
            : status === 'warning'
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-destructive/30 bg-destructive/5'
        } ${hasTimestamps && !isDismissed ? 'cursor-pointer hover:ring-2 hover:ring-primary/30' : ''}`}
        onClick={() => {
          if (hasTimestamps && !isDismissed) {
            setActiveResultId(prev => prev === result.rule_id ? null : result.rule_id);
          }
        }}
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            {effectiveStatus === 'pass' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            ) : effectiveStatus === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className={`font-medium text-sm ${isDismissed ? 'line-through text-muted-foreground' : ''}`}>
                  {getRuleLabel(result.rule_id)}
                </p>
                {isDismissed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    Resolved
                  </Badge>
                )}
                {hasTimestamps && !isDismissed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                    {result.timestamps!.map((t: any) => `${t.start.toFixed(1)}s–${t.end.toFixed(1)}s`).join(', ')}
                  </Badge>
                )}
              </div>
              {(
                <>
                  <p className={`text-sm ${isDismissed ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>{result.reason}</p>
                  {result.excerpt && status !== 'pass' && (
                    <div className={`mt-2 p-2 rounded border ${
                      status === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-destructive/10 border-destructive/20'
                    }`}>
                      <p className={`text-xs font-mono ${status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}`}>"{result.excerpt}"</p>
                    </div>
                  )}
                </>
              )}
            </div>
            {showMenu && options?.onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  options.onDismiss!(result.rule_id, 'resolved');
                }}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Resolve
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-6 animate-fade-in ${step === 3 && contentType === 'video' && videoObjectUrl ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Compliance Officer</h1>
        <p className="text-muted-foreground">
          Check your marketing content against gambling advertising regulations
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-primary/40' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select content type */}
      {step === 1 && (
        <>
          {rules.length === 0 && (
            <Alert className="border-primary/30 bg-primary/5">
              <ShieldQuestion className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm">
                  No compliance rules configured yet. Add rules to start checking your content.
                </span>
                <Button asChild size="sm" variant="default">
                  <Link to="/settings/compliance">Add Rules</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {contentTypeCards.map((ct) => (
              <Card
                key={ct.type}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  contentType === ct.type ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => setContentType(ct.type)}
              >
                <CardContent className="pt-6 text-center space-y-3">
                  <ct.icon className="h-10 w-10 mx-auto text-primary" />
                  <div>
                    <p className="font-medium">{ct.label}</p>
                    <p className="text-xs text-muted-foreground">{ct.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="sm:col-span-3 flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!contentType}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* History - shown on step 1 */}
      {step === 1 && <ComplianceHistory rules={rules} getRuleLabel={getRuleLabel} />}

      {/* Step 2: Enter content */}
      {step === 2 && contentType === 'email' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email Content
            </CardTitle>
            <CardDescription>
              Enter the email copy you want to check for compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                placeholder="e.g. 🎰 Your exclusive offer awaits!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Body Copy</Label>
              <Textarea
                placeholder="Paste the email body text here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Header Image (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setHeaderFile(e.target.files?.[0] || null)}
              />
              {headerFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileCheck className="h-3 w-3" /> {headerFile.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Terms & Conditions / Offer Terms</Label>
              <Textarea
                placeholder="e.g. Min deposit £10. Wagering requirements 40x..."
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleCheck}
                disabled={(!subject && !body && !terms) || isProcessing}
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
                ) : (
                  <><ShieldCheck className="mr-2 h-4 w-4" /> Check Compliance</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (contentType === 'image' || contentType === 'video') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {contentType === 'image' ? <Image className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              {contentType === 'image' ? 'Image' : 'Video'} Upload
            </CardTitle>
            <CardDescription>
              Upload the {contentType} you want to check for compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept={contentType === 'image' ? 'image/*' : 'video/*'}
                className="hidden"
                id="media-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaSelect(file);
                }}
              />
              <label htmlFor="media-upload" className="cursor-pointer space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  {contentType === 'image' ? 'PNG, JPG, WEBP up to 20MB' : 'MP4, MOV, WEBM — frames extracted locally'}
                </p>
              </label>
            </div>
            {mediaFile && (
              <div className="space-y-2">
                <p className="text-sm flex items-center gap-1">
                  <FileCheck className="h-4 w-4 text-primary" /> {mediaFile.name}
                </p>
                {mediaPreview && (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg border"
                  />
                )}
              </div>
            )}

            {/* Video progress indicator */}
            {videoProgress && (
              <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <p className="text-sm font-medium">{videoProgress}</p>
                </div>
                <Progress value={frameProgress} className="h-2" />
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleCheck}
                disabled={!mediaFile || isProcessing}
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing...</>
                ) : (
                  <><ShieldCheck className="mr-2 h-4 w-4" /> Check Compliance</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div className="space-y-4">
          <Card className={
            overallStatus === 'pass' ? 'border-emerald-500/50' :
            overallStatus === 'warning' ? 'border-amber-500/50' :
            'border-destructive/50'
          }>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {overallStatus === 'pass' ? (
                  <ShieldCheck className="h-8 w-8 text-emerald-500" />
                ) : overallStatus === 'warning' ? (
                  <ShieldQuestion className="h-8 w-8 text-amber-500" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <p className="font-semibold text-lg">
                    {overallStatus === 'pass' ? 'All Checks Passed' :
                     overallStatus === 'warning' ? 'Needs Review' :
                     'Issues Found'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {calcComplianceScore(results)}% pass rate · {results.filter((r: any) => !r.dismissed_as && getResultStatus(r) === 'pass').length} passed, {results.filter((r: any) => !r.dismissed_as && (getResultStatus(r) === 'warning' || getResultStatus(r) === 'fail')).length} issues{results.some((r: any) => r.dismissed_as) ? `, ${results.filter((r: any) => r.dismissed_as).length} resolved` : ''}
                  </p>
                </div>
                <Badge
                  className={`ml-auto ${
                    overallStatus === 'pass'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : overallStatus === 'warning'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                      : 'bg-destructive/10 text-destructive border-destructive/30'
                  }`}
                >
                  {overallStatus === 'pass' ? 'COMPLIANT' : overallStatus === 'warning' ? 'NEEDS REVIEW' : 'NON-COMPLIANT'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Split layout for video, single column for others */}
          {contentType === 'video' && videoObjectUrl ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <VideoCompliancePlayer
                  videoUrl={videoObjectUrl}
                  duration={videoDurationState}
                  results={results}
                  activeResultId={activeResultId}
                />
              </div>
              <div className="grid gap-3 content-start">
                {results.map((result) =>
                  renderResultCard(result, {
                    isVideo: true,
                    checkId: lastCheckId || undefined,
                    onDismiss: lastCheckId ? handleDismissLiveResult : undefined,
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {results.map((result) =>
                renderResultCard(result, {
                  checkId: lastCheckId || undefined,
                  onDismiss: lastCheckId ? handleDismissLiveResult : undefined,
                })
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              Check Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const contentTypeIcon = {
  email: Mail,
  image: Image,
  video: Video,
};

function ComplianceHistory({ rules, getRuleLabel }: { rules: { id: string; label: string }[]; getRuleLabel: (id: string) => string }) {
  const { data: history = [], isLoading } = useComplianceHistory();
  const dismissMutation = useDismissComplianceResult();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading history...
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) return null;

  const handleDismiss = async (checkId: string, ruleId: string, action: 'ignored' | 'resolved') => {
    try {
      await dismissMutation.mutateAsync({ checkId, ruleId, action });
    } catch {
      // toast handled by invalidation
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" /> Check History
        </CardTitle>
        <CardDescription>Previous compliance checks by your team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((check) => {
          const Icon = contentTypeIcon[check.content_type as ContentType] || FileCheck;
          const score = calcComplianceScore(check.results);
          const scoreColor = score >= 90 ? 'text-emerald-500' : score >= 70 ? 'text-amber-500' : 'text-destructive';

          return (
            <Collapsible key={check.id}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full">
                  {check.thumbnail_url ? (
                    <img
                      src={check.thumbnail_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{check.ai_name || check.content_type.charAt(0).toUpperCase() + check.content_type.slice(1)}</span>
                      <Badge
                        variant="outline"
                        className={
                          check.overall_status === 'pass'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs'
                            : check.overall_status === 'warning'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs'
                            : 'bg-destructive/10 text-destructive border-destructive/30 text-xs'
                        }
                      >
                        {check.overall_status === 'pass' ? 'Pass' :
                         check.overall_status === 'warning' ? 'Review' :
                         'Issues'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <User className="h-3 w-3" />
                      <span>{check.user_name}</span>
                      <span>·</span>
                      <span>{format(new Date(check.created_at), 'dd MMM yyyy, HH:mm')}</span>
                      <span>·</span>
                      <span className={`font-medium ${scoreColor}`}>{score}% pass</span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 mt-1 mb-2 space-y-1.5 border-l-2 border-muted pl-4">
                  {check.results.map((result: any, idx: number) => {
                    const status = getResultStatus(result);
                    const isDismissed = !!result.dismissed_as;
                    const effectiveStatus = isDismissed ? 'pass' : status;
                    const showMenu = (status === 'warning' || status === 'fail') && !isDismissed;

                    return (
                      <div key={idx} className={`flex items-start gap-2 text-sm`}>
                        {effectiveStatus === 'pass' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        ) : effectiveStatus === 'warning' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium text-xs ${isDismissed ? 'text-muted-foreground' : ''}`}>
                              {getRuleLabel(result.rule_id)}
                            </span>
                            {isDismissed && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs ${isDismissed ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>{result.reason}</p>
                        </div>
                        {showMenu && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] px-1.5 flex-shrink-0"
                            onClick={() => handleDismiss(check.id, result.rule_id, 'resolved')}
                          >
                            <CheckCheck className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
