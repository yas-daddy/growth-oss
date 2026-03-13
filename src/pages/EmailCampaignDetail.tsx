import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings2, HelpCircle, Upload, X, ChevronDown, ChevronUp, Mail, ChevronsUpDown, Save, Plus, Trash2, ArrowLeft, Copy, Database, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmailCampaign, EmailCampaignSchedule, CustomContentBlock, CustomMockAttribute, CustomPayloadField } from '@/hooks/useEmailCampaigns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast, toast } from '@/hooks/use-toast';
import { renderLiquid, renderLiquidText, extractAssignStatements, LiquidContext, ContentBlockMap } from '@/lib/liquidRenderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import stakemateLogo from '@/assets/stakemate-logo.png';
import { EmailImageLibraryDialog } from '@/components/email/EmailImageLibraryDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

function useLiquidRender(template: string | null, context: LiquidContext, contentBlocks?: ContentBlockMap) {
  const [html, setHtml] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!template) { setHtml(null); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await renderLiquid(template, context, contentBlocks);
        setHtml(result);
      } catch (err) {
        console.error('Liquid render error:', err);
        setHtml(template);
      }
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [template, context, contentBlocks]);

  return html;
}

function useLiquidTextRender(text: string, context: LiquidContext, assignPrefix?: string) {
  const [rendered, setRendered] = useState(text);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!text) { setRendered(''); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await renderLiquidText(text, context, assignPrefix);
        setRendered(result);
      } catch {
        setRendered(text);
      }
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [text, context, assignPrefix]);

  return rendered;
}

function EmailThumbnail({ schedule, htmlTemplate, context, contentBlocks }: { schedule: EmailCampaignSchedule; htmlTemplate: string | null; context: LiquidContext; contentBlocks?: ContentBlockMap }) {
  const scheduleContext = useMemo<LiquidContext>(() => {
    const entryProps: Record<string, string> = {
      email_title: schedule.email_title || '',
      pre_header: schedule.pre_header || '',
      header_title: schedule.header_title || '',
      body_copy: schedule.body_copy || '',
      cta_text: schedule.cta_text || '',
      cta_url: schedule.cta_url || '',
      image_url: schedule.image_url || '',
      offer_validity_seconds: schedule.offer_validity_hours ? String(Math.round(schedule.offer_validity_hours * 3600)) : '',
    };
    return {
      ...context,
      ...entryProps,
      canvas_entry_properties: entryProps,
    };
  }, [schedule, context]);

  const renderedHtml = useLiquidRender(htmlTemplate, scheduleContext, contentBlocks);

  if (!renderedHtml) return <div className="w-16 h-20 bg-muted rounded flex items-center justify-center"><Mail className="h-4 w-4 text-muted-foreground" /></div>;

  return (
    <div className="w-16 h-20 rounded border overflow-hidden relative">
      <iframe
        srcDoc={renderedHtml}
        className="w-[320px] h-[400px] border-0 pointer-events-none"
        style={{ transform: 'scale(0.05)', transformOrigin: 'top left' }}
        sandbox="allow-same-origin"
        title="Email thumbnail"
      />
    </div>
  );
}

function getStatus(schedule: EmailCampaignSchedule): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (schedule.status === 'cancelled') return { label: 'Cancelled', variant: 'destructive' };
  if (schedule.status === 'failed') return { label: 'Failed', variant: 'destructive' };
  if (schedule.status === 'scheduled' && new Date(schedule.scheduled_at) <= new Date()) {
    return { label: 'Sent', variant: 'default' };
  }
  return { label: 'Scheduled', variant: 'secondary' };
}

function CopyLiquidButton({ propKey }: { propKey: string }) {
  const liquid = `{{canvas_entry_properties.\${${propKey}}}}`;
  return (
    <button
      type="button"
      className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title={`Copy: ${liquid}`}
      onClick={() => {
        navigator.clipboard.writeText(liquid);
        toast({ title: 'Copied', description: liquid });
      }}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

export default function EmailCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const {
    schedules, schedulesLoading, settings, settingsLoading,
    saveSettings, scheduleBroadcast, cancelBroadcast, uploadImage,
  } = useEmailCampaign(campaignId || '');
  const { toast } = useToast();

  // Form state
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [emailTitle, setEmailTitle] = useState('');
  const [preHeader, setPreHeader] = useState('');
  const [headerTitle, setHeaderTitle] = useState('');
  const [bodyCopy, setBodyCopy] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [offerHours, setOfferHours] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // Image library dialog
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);

  // Add payload field dialog
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<'input' | 'textarea'>('input');

  // Pre-populate form from saved defaults
  useEffect(() => {
    if (settings && !defaultsLoaded) {
      if (settings.default_email_title) setEmailTitle(settings.default_email_title);
      if (settings.default_pre_header) setPreHeader(settings.default_pre_header);
      if (settings.default_header_title) setHeaderTitle(settings.default_header_title);
      if (settings.default_body_copy) setBodyCopy(settings.default_body_copy);
      if (settings.default_cta_text) setCtaText(settings.default_cta_text);
      if (settings.default_cta_url) setCtaUrl(settings.default_cta_url);
      if (settings.default_offer_hours) setOfferHours(String(settings.default_offer_hours));
      if (settings.default_push_title) setPushTitle(settings.default_push_title);
      if (settings.default_push_body) setPushBody(settings.default_push_body);
      setDefaultsLoaded(true);
    }
  }, [settings, defaultsLoaded]);

  const handleSaveDefaults = () => {
    if (!settings) return;
    saveSettings.mutate({
      html_template: settings.html_template || '',
      canvas_id: settings.canvas_id || '',
      mock_first_name: settings.mock_first_name,
      mock_net_deposits: settings.mock_net_deposits,
      cb_hero_without_cta: settings.cb_hero_without_cta || undefined,
      cb_header_title: settings.cb_header_title || undefined,
      cb_body_copy: settings.cb_body_copy || undefined,
      cb_cta: settings.cb_cta || undefined,
      cb_footer: settings.cb_footer || undefined,
      custom_content_blocks: settings.custom_content_blocks || undefined,
      custom_mock_attributes: settings.custom_mock_attributes || undefined,
      custom_payload_fields: settings.custom_payload_fields || undefined,
      default_email_title: emailTitle || undefined,
      default_pre_header: preHeader || undefined,
      default_header_title: headerTitle || undefined,
      default_body_copy: bodyCopy || undefined,
      default_cta_text: ctaText || undefined,
      default_cta_url: ctaUrl || undefined,
      default_offer_hours: offerHours ? Number(offerHours) : undefined,
      default_push_title: pushTitle || undefined,
      default_push_body: pushBody || undefined,
    });
  };

  const handleAddPayloadField = () => {
    if (!newFieldLabel || !newFieldKey || !settings) return;
    const existingFields = settings.custom_payload_fields || [];
    const newField: CustomPayloadField = { key: newFieldKey, label: newFieldLabel, type: newFieldType };
    saveSettings.mutate({
      html_template: settings.html_template || '',
      canvas_id: settings.canvas_id || '',
      mock_first_name: settings.mock_first_name,
      mock_net_deposits: settings.mock_net_deposits,
      cb_hero_without_cta: settings.cb_hero_without_cta || undefined,
      cb_header_title: settings.cb_header_title || undefined,
      cb_body_copy: settings.cb_body_copy || undefined,
      cb_cta: settings.cb_cta || undefined,
      cb_footer: settings.cb_footer || undefined,
      custom_content_blocks: settings.custom_content_blocks || undefined,
      custom_mock_attributes: settings.custom_mock_attributes || undefined,
      custom_payload_fields: [...existingFields, newField],
    });
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldType('input');
    setAddFieldOpen(false);
  };

  // Dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState<EmailCampaignSchedule | null>(null);
  const [settingsHtml, setSettingsHtml] = useState('');
  const [settingsCanvasId, setSettingsCanvasId] = useState('');
  const [settingsMockFirstName, setSettingsMockFirstName] = useState('John');
  const [settingsMockNetDeposits, setSettingsMockNetDeposits] = useState('500');
  const [cbHero, setCbHero] = useState('');
  const [cbHeaderTitle, setCbHeaderTitle] = useState('');
  const [cbBodyCopy, setCbBodyCopy] = useState('');
  const [cbCta, setCbCta] = useState('');
  const [cbFooter, setCbFooter] = useState('');
  const [customBlocks, setCustomBlocks] = useState<CustomContentBlock[]>([]);
  const [customMockAttrs, setCustomMockAttrs] = useState<CustomMockAttribute[]>([]);
  const [settingsName, setSettingsName] = useState('');

  const openSettings = useCallback(() => {
    setSettingsName(settings?.name || '');
    setSettingsHtml(settings?.html_template || '');
    setSettingsCanvasId(settings?.canvas_id || '');
    setSettingsMockFirstName(settings?.mock_first_name || 'John');
    setSettingsMockNetDeposits(settings?.mock_net_deposits || '500');
    setCbHero(settings?.cb_hero_without_cta || '');
    setCbHeaderTitle(settings?.cb_header_title || '');
    setCbBodyCopy(settings?.cb_body_copy || '');
    setCbCta(settings?.cb_cta || '');
    setCbFooter(settings?.cb_footer || '');
    setCustomBlocks(settings?.custom_content_blocks || []);
    setCustomMockAttrs(settings?.custom_mock_attributes || []);
    setSettingsOpen(true);
  }, [settings]);

  const handleSaveSettings = () => {
    saveSettings.mutate({
      name: settingsName || undefined,
      html_template: settingsHtml,
      canvas_id: settingsCanvasId,
      mock_first_name: settingsMockFirstName,
      mock_net_deposits: settingsMockNetDeposits,
      cb_hero_without_cta: cbHero || undefined,
      cb_header_title: cbHeaderTitle || undefined,
      cb_body_copy: cbBodyCopy || undefined,
      cb_cta: cbCta || undefined,
      cb_footer: cbFooter || undefined,
      custom_content_blocks: customBlocks.filter(b => b.key && b.html),
      custom_mock_attributes: customMockAttrs.filter(a => a.key && a.value),
    });
    setSettingsOpen(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  const processImageFile = async (file: File) => {
    setImageFile(file);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file);
    }
  };

  const handleSchedule = () => {
    if (!emailTitle || !scheduledAt) return;
    scheduleBroadcast.mutate({
      image_url: imageUrl || undefined,
      email_title: emailTitle,
      pre_header: preHeader || undefined,
      header_title: headerTitle || undefined,
      body_copy: bodyCopy ? bodyCopy.replace(/\n/g, '<br>') : undefined,
      cta_text: ctaText || undefined,
      cta_url: ctaUrl || undefined,
      offer_validity_hours: offerHours ? Number(offerHours) : undefined,
      push_title: pushTitle || undefined,
      push_body: pushBody || undefined,
      scheduled_at: new Date(scheduledAt).toISOString(),
      extra_properties: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    }, {
      onSuccess: () => {
        setEmailTitle(''); setPreHeader(''); setHeaderTitle(''); setBodyCopy('');
        setCtaText(''); setCtaUrl(''); setOfferHours(''); setScheduledAt('');
        setImageUrl(''); setImageFile(null); setPushTitle(''); setPushBody('');
        setCustomFieldValues({});
      },
    });
  };

  // Liquid context for the live preview
  const liquidContext = useMemo<LiquidContext>(() => {
    const entryProps: Record<string, string> = {
      email_title: emailTitle || 'Email Title',
      pre_header: preHeader || 'Pre-header text',
      header_title: headerTitle || 'Header Title',
      body_copy: bodyCopy ? bodyCopy.replace(/\n/g, '<br>') : 'Body copy goes here...',
      cta_text: ctaText || 'Claim Now',
      cta_url: ctaUrl || '#',
      image_url: imageUrl || 'https://placehold.co/600x200/1a1a2e/ffffff?text=Header+Image',
      offer_validity_seconds: offerHours ? String(Math.round(Number(offerHours) * 3600)) : '0',
      push_title: pushTitle || '',
      push_body: pushBody || '',
      ...customFieldValues,
    };
    return {
      first_name: settings?.mock_first_name || 'John',
      // Spread entry props at top level so content blocks that reference bare variables (e.g. cta_text) work
      ...entryProps,
      canvas_entry_properties: entryProps,
      custom_attribute: {
        'All Time Net Deposits': settings?.mock_net_deposits || '500',
        // Merge custom mock attributes
        ...(settings?.custom_mock_attributes || []).reduce((acc, attr) => {
          if (attr.key && attr.value) acc[attr.key] = attr.value;
          return acc;
        }, {} as Record<string, string>),
      },
    };
  }, [emailTitle, preHeader, headerTitle, bodyCopy, ctaText, ctaUrl, imageUrl, offerHours, pushTitle, pushBody, customFieldValues, settings?.mock_first_name, settings?.mock_net_deposits, settings?.custom_mock_attributes]);

  // Content blocks map from settings
  const contentBlocks = useMemo<ContentBlockMap>(() => {
    const map: ContentBlockMap = {};
    if (settings?.cb_hero_without_cta) map['email_hero_without_cta'] = settings.cb_hero_without_cta;
    if (settings?.cb_header_title) map['email_header_title'] = settings.cb_header_title;
    if (settings?.cb_body_copy) map['email_body_copy'] = settings.cb_body_copy;
    if (settings?.cb_cta) map['email_cta'] = settings.cb_cta;
    if (settings?.cb_footer) map['email_footer'] = settings.cb_footer;
    // Add custom content blocks
    if (settings?.custom_content_blocks) {
      for (const block of settings.custom_content_blocks) {
        if (block.key && block.html) map[block.key] = block.html;
      }
    }
    return map;
  }, [settings?.cb_hero_without_cta, settings?.cb_header_title, settings?.cb_body_copy, settings?.cb_cta, settings?.cb_footer, settings?.custom_content_blocks]);

  // Base context for history items (without form-specific canvas_entry_properties)
  const baseContext = useMemo<LiquidContext>(() => ({
    first_name: settings?.mock_first_name || 'John',
    canvas_entry_properties: {},
    custom_attribute: {
      'All Time Net Deposits': settings?.mock_net_deposits || '500',
    },
  }), [settings?.mock_first_name, settings?.mock_net_deposits]);

  const assignPrefix = useMemo(() => extractAssignStatements(settings?.html_template || ''), [settings?.html_template]);

  const previewHtml = useLiquidRender(settings?.html_template || null, liquidContext, contentBlocks);
  const renderedSubject = useLiquidTextRender(emailTitle || 'Email Title', liquidContext, assignPrefix);
  const renderedPreHeader = useLiquidTextRender(preHeader || 'Pre-header text', liquidContext, assignPrefix);
  const renderedPushTitle = useLiquidTextRender(pushTitle, liquidContext, assignPrefix);
  const renderedPushBody = useLiquidTextRender(pushBody, liquidContext, assignPrefix);

  const offerSeconds = offerHours ? Math.round(Number(offerHours) * 3600).toLocaleString() : null;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/email-campaigns')} title="Back to campaigns">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={openSettings} title="Settings">
          <Settings2 className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} title="Help">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{settings?.name || 'Campaign'}</h1>
      </div>

      {/* Main content: form + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Details form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Campaign Details</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setAddFieldOpen(true)} title="Add Payload Field" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSaveDefaults} disabled={saveSettings.isPending} title="Save as Defaults" className="h-7 w-7">
              <Save className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image upload */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Header Image</Label>
                {!imageUrl && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setImageLibraryOpen(true)}>
                    <Database className="h-3 w-3" />
                    Library
                  </Button>
                )}
              </div>
              {imageUrl ? (
                <div className="relative mt-1">
                  <img src={imageUrl} alt="Header" className="w-full h-32 object-cover rounded-md border" />
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-background/80" onClick={() => { setImageUrl(''); setImageFile(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label
                  className={`mt-1 flex items-center justify-center h-24 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center text-muted-foreground text-sm">
                    <Upload className="h-5 w-5 mb-1" />
                    {uploading ? 'Uploading...' : 'Drag & drop or click to upload'}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <div>
              <Label className="flex items-center gap-1.5">Email Title * <CopyLiquidButton propKey="email_title" /></Label>
              <div className="flex gap-2 mt-1">
                <Textarea value={emailTitle} onChange={e => setEmailTitle(e.target.value)} placeholder="Subject line" className="min-h-[38px] flex-1" rows={1} />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-[38px] w-[38px]"
                  disabled={!emailTitle.trim() || generatingCopy}
                  title="Generate copy with AI"
                  onClick={async () => {
                    setGeneratingCopy(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('generate-email-copy', {
                        body: { email_title: emailTitle },
                      });
                      if (error) throw error;
                      if (data.pre_header) setPreHeader(data.pre_header);
                      if (data.header_title) setHeaderTitle(data.header_title);
                      if (data.body_copy) setBodyCopy(data.body_copy);
                      if (data.push_title) setPushTitle(data.push_title);
                      if (data.push_body) setPushBody(data.push_body);
                      toast({ title: 'Copy generated', description: 'AI has populated the fields below' });
                    } catch (err) {
                      console.error('Generate copy error:', err);
                      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
                    } finally {
                      setGeneratingCopy(false);
                    }
                  }}
                >
                  {generatingCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div><Label className="flex items-center gap-1.5">Pre-header <CopyLiquidButton propKey="pre_header" /></Label><Textarea value={preHeader} onChange={e => setPreHeader(e.target.value)} placeholder="Pre-header text" className="mt-1 min-h-[38px]" rows={1} /></div>
            <div><Label className="flex items-center gap-1.5">Header Title <CopyLiquidButton propKey="header_title" /></Label><Textarea value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} placeholder="Header title in template" className="mt-1 min-h-[38px]" rows={1} /></div>
            <div><Label className="flex items-center gap-1.5">Body Copy <CopyLiquidButton propKey="body_copy" /></Label><Textarea value={bodyCopy} onChange={e => setBodyCopy(e.target.value)} placeholder="Main body content" className="mt-1" rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="flex items-center gap-1.5">CTA Text <CopyLiquidButton propKey="cta_text" /></Label><Input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Claim Now" className="mt-1" /></div>
              <div><Label className="flex items-center gap-1.5">CTA URL <CopyLiquidButton propKey="cta_url" /></Label><Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://..." className="mt-1" /></div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">Offer Validity (hours) <CopyLiquidButton propKey="offer_validity_seconds" /></Label>
              <Input type="number" value={offerHours} onChange={e => setOfferHours(e.target.value)} placeholder="48" className="mt-1" min="0" />
              {offerSeconds && <p className="text-xs text-muted-foreground mt-1">= {offerSeconds} seconds</p>}
            </div>
            {/* Dynamic custom payload fields */}
            {(settings?.custom_payload_fields || []).length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Custom Payload Fields</p>
                {(settings?.custom_payload_fields || []).map((field) => (
                  <div key={field.key}>
                    <Label className="flex items-center gap-1.5">{field.label} <CopyLiquidButton propKey={field.key} /></Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        value={customFieldValues[field.key] || ''}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.label}
                        className="mt-1"
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={customFieldValues[field.key] || ''}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.label}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Push notification copy */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Push Notification Copy</p>
              <div><Label className="flex items-center gap-1.5">Push Title <CopyLiquidButton propKey="push_title" /></Label><Textarea value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="Push notification title" className="mt-1 min-h-[38px]" rows={1} /></div>
              <div><Label className="flex items-center gap-1.5">Push Body <CopyLiquidButton propKey="push_body" /></Label><Textarea value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="Push notification body text" className="mt-1" rows={2} /></div>
            </div>
            <div>
              <Label>Schedule Time *</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleSchedule} disabled={!emailTitle || !scheduledAt || scheduleBroadcast.isPending} className="w-full">
              {scheduleBroadcast.isPending ? 'Scheduling...' : 'Schedule Broadcast'}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Live preview */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Live Preview</CardTitle></CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="space-y-3">
                {/* Subject line and pre-header */}
                <div className="border rounded-md p-3 bg-muted/30 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Subject:</span>
                    <span className="text-sm font-semibold truncate">{renderedSubject}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Pre-header:</span>
                    <span className="text-xs text-muted-foreground truncate">{renderedPreHeader}</span>
                  </div>
                </div>
                {/* Email body */}
                <div className="border rounded-md overflow-hidden" style={{ height: '550px' }}>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                </div>
                {/* Push notification preview */}
                {(pushTitle || pushBody) && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Push Notification</p>
                    <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                    {/* iOS-style blur overlay */}
                    <div className="absolute inset-0 backdrop-blur-xl bg-white/5" />
                    <div className="relative p-4">
                      {/* Time display */}
                      <p className="text-center text-white/60 text-[10px] font-medium tracking-wide uppercase mb-3">now</p>
                      {/* Notification card */}
                      <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 p-3 shadow-lg">
                        <div className="flex items-start gap-2.5">
                          {/* App icon */}
                          <img src={stakemateLogo} alt="Stakemate" className="w-9 h-9 rounded-lg shrink-0 shadow-md" />
                          <div className="flex-1 min-w-0">
                            {/* App name + time */}
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">Stakemate</span>
                              <span className="text-[10px] text-white/40">now</span>
                            </div>
                            {pushTitle && (
                              <p className="text-[13px] font-semibold text-white leading-tight">{renderedPushTitle}</p>
                            )}
                            {pushBody && (
                              <p className="text-[13px] text-white/75 leading-tight mt-0.5 line-clamp-3">{renderedPushBody}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <Mail className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No HTML template configured.</p>
                <p className="text-xs mt-1">Click the gear icon to paste your email template.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History section */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Broadcast History</CardTitle></CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts scheduled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => {
                  const status = getStatus(s);
                  const isExpanded = detailSchedule?.id === s.id;
                  return (
                    <>
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetailSchedule(isExpanded ? null : s)}>
                        <TableCell><EmailThumbnail schedule={s} htmlTemplate={settings?.html_template || null} context={baseContext} contentBlocks={contentBlocks} /></TableCell>
                        <TableCell className="font-medium">{s.email_title}</TableCell>
                        <TableCell className="text-sm">{format(new Date(s.scheduled_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.status === 'scheduled' && new Date(s.scheduled_at) > new Date() && (
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); cancelBroadcast.mutate(s.id); }}>
                                Cancel
                              </Button>
                            )}
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <ExpandedHistoryRow schedule={s} htmlTemplate={settings?.html_template || null} context={baseContext} contentBlocks={contentBlocks} />
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Campaign Settings</DialogTitle>
            <DialogDescription>Configure the HTML template, Canvas ID, and mock data for previews.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={settingsName} onChange={e => setSettingsName(e.target.value)} placeholder="Campaign name" className="mt-1" />
            </div>
            <div>
              <Label>Canvas ID</Label>
              <Input value={settingsCanvasId} onChange={e => setSettingsCanvasId(e.target.value)} placeholder="Braze Canvas ID" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mock First Name</Label>
                <Input value={settingsMockFirstName} onChange={e => setSettingsMockFirstName(e.target.value)} placeholder="John" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Used for {'{{first_name}}'} in preview</p>
              </div>
              <div>
                <Label>Mock All Time Net Deposits</Label>
                <Input value={settingsMockNetDeposits} onChange={e => setSettingsMockNetDeposits(e.target.value)} placeholder="500" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Used for {'{{custom_attribute.${All Time Net Deposits}}}'} in preview</p>
              </div>
            </div>
            {/* Custom Mock Attributes */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">Custom Mock Attributes</p>
                  <p className="text-xs text-muted-foreground">Add mock values for custom_attribute variables used in your template.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomMockAttrs(prev => [...prev, { key: '', value: '' }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {customMockAttrs.length > 0 && (
                <div className="space-y-2">
                  {customMockAttrs.map((attr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={attr.key}
                        onChange={e => {
                          const updated = [...customMockAttrs];
                          updated[idx] = { ...updated[idx], key: e.target.value };
                          setCustomMockAttrs(updated);
                        }}
                        placeholder="Attribute name (e.g. Favourite Team)"
                        className="text-sm flex-1"
                      />
                      <Input
                        value={attr.value}
                        onChange={e => {
                          const updated = [...customMockAttrs];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setCustomMockAttrs(updated);
                        }}
                        placeholder="Mock value"
                        className="text-sm flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setCustomMockAttrs(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>HTML Template</Label>
              <Textarea
                value={settingsHtml}
                onChange={e => setSettingsHtml(e.target.value)}
                placeholder="Paste your full Braze HTML email template here..."
                className="mt-1 font-mono text-xs"
                rows={16}
              />
            </div>
            {/* Content Block HTML fields */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Content Blocks</p>
              <p className="text-xs text-muted-foreground mb-3">Paste the HTML for each Braze Content Block used in your template.</p>
              <div className="space-y-2">
                {[
                  { label: 'Hero (no CTA)', key: 'email_hero_without_cta', value: cbHero, setter: setCbHero },
                  { label: 'Header Title', key: 'email_header_title', value: cbHeaderTitle, setter: setCbHeaderTitle },
                  { label: 'Body Copy', key: 'email_body_copy', value: cbBodyCopy, setter: setCbBodyCopy },
                  { label: 'CTA', key: 'email_cta', value: cbCta, setter: setCbCta },
                  { label: 'Footer', key: 'email_footer', value: cbFooter, setter: setCbFooter },
                ].map(({ label, key, value, setter }) => (
                  <Collapsible key={key}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors">
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{label}</span>
                      {value && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-auto">set</Badge>}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Textarea
                        value={value}
                        onChange={e => setter(e.target.value)}
                        placeholder={`Paste HTML for content_blocks.\${${key}}...`}
                        className="mt-1 font-mono text-xs"
                        rows={6}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
            {/* Custom Content Blocks */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">Custom Content Blocks</p>
                  <p className="text-xs text-muted-foreground">Add additional Braze Content Blocks as needed.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomBlocks(prev => [...prev, { key: '', label: '', html: '' }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Block
                </Button>
              </div>
              {customBlocks.length > 0 && (
                <div className="space-y-3">
                  {customBlocks.map((block, idx) => (
                    <div key={idx} className="border rounded-md p-3 space-y-2 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={block.label}
                            onChange={e => {
                              const updated = [...customBlocks];
                              updated[idx] = { ...updated[idx], label: e.target.value };
                              setCustomBlocks(updated);
                            }}
                            placeholder="Label (e.g. Promo Banner)"
                            className="text-sm"
                          />
                          <Input
                            value={block.key}
                            onChange={e => {
                              const updated = [...customBlocks];
                              updated[idx] = { ...updated[idx], key: e.target.value };
                              setCustomBlocks(updated);
                            }}
                            placeholder="Key (e.g. email_promo_banner)"
                            className="text-sm font-mono"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setCustomBlocks(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={block.html}
                        onChange={e => {
                          const updated = [...customBlocks];
                          updated[idx] = { ...updated[idx], html: e.target.value };
                          setCustomBlocks(updated);
                        }}
                        placeholder={`Paste HTML for content_blocks.\${${block.key || 'block_key'}}...`}
                        className="font-mono text-xs"
                        rows={4}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleSaveSettings} disabled={saveSettings.isPending} className="w-full">
              {saveSettings.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Library dialog */}
      <EmailImageLibraryDialog
        open={imageLibraryOpen}
        onOpenChange={setImageLibraryOpen}
        onSelect={(url) => { setImageUrl(url); setImageFile(null); }}
      />

      {/* Help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How Email Campaigns Work</DialogTitle>
            <DialogDescription>Scheduling broadcasts via Braze Canvas API</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This feature schedules Braze Canvas broadcasts with entry properties that replace liquid variables in your email template.</p>
            <div>
              <p className="font-medium mb-1">Canvas Entry Properties <span className="text-xs text-muted-foreground font-normal">(click to copy)</span>:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {[
                  { key: 'email_title', desc: 'Email subject line' },
                  { key: 'pre_header', desc: 'Pre-header text' },
                  { key: 'header_title', desc: 'Header title' },
                  { key: 'body_copy', desc: 'Main body content' },
                  { key: 'cta_text', desc: 'CTA button label' },
                  { key: 'cta_url', desc: 'CTA button URL' },
                  { key: 'image_url', desc: 'Header image URL' },
                  { key: 'offer_validity_seconds', desc: 'Offer validity in seconds' },
                  { key: 'push_title', desc: 'Push notification title' },
                  { key: 'push_body', desc: 'Push notification body' },
                  ...(settings?.custom_payload_fields || []).map(f => ({ key: f.key, desc: f.label })),
                ].map(({ key, desc }) => {
                  const liquid = `{{canvas_entry_properties.\${${key}}}}`;
                  return (
                    <li key={key}>
                      <code
                        className="text-xs bg-muted px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={() => { navigator.clipboard.writeText(liquid); toast({ title: 'Copied!', description: liquid }); }}
                      >{key}</code> — {desc}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Mock User Data <span className="text-xs text-muted-foreground font-normal">(click to copy)</span>:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>
                  <code
                    className="text-xs bg-muted px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => { navigator.clipboard.writeText('{{first_name}}'); toast({ title: 'Copied!', description: '{{first_name}}' }); }}
                  >first_name</code> — User's first name
                </li>
                <li>
                  <code
                    className="text-xs bg-muted px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => { navigator.clipboard.writeText('{{custom_attribute.${All Time Net Deposits}}}'); toast({ title: 'Copied!', description: '{{custom_attribute.${All Time Net Deposits}}}' }); }}
                  >{'custom_attribute.${All Time Net Deposits}'}</code> — Net deposits value
                </li>
              </ul>
            </div>
            <p className="text-muted-foreground">The preview uses LiquidJS to render your template with all Liquid logic (if/unless, filters, etc.) working correctly.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payload Field dialog */}
      <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Payload Field</DialogTitle>
            <DialogDescription>Define a new custom field for the campaign payload.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Display Label</Label>
              <Input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="e.g. Secondary Body Copy" className="mt-1" />
            </div>
            <div>
              <Label>Payload Key</Label>
              <Input value={newFieldKey} onChange={e => setNewFieldKey(e.target.value)} placeholder="e.g. body_copy_2" className="mt-1 font-mono" />
              <p className="text-xs text-muted-foreground mt-1">Used as {'{{canvas_entry_properties.${key}}}'}</p>
            </div>
            <div>
              <Label>Field Type</Label>
              <Select value={newFieldType} onValueChange={(v: 'input' | 'textarea') => setNewFieldType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="input">Short Text</SelectItem>
                  <SelectItem value="textarea">Multi-line Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddPayloadField} disabled={!newFieldLabel || !newFieldKey || saveSettings.isPending} className="w-full">
              {saveSettings.isPending ? 'Saving...' : 'Add Field'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpandedHistoryRow({ schedule, htmlTemplate, context, contentBlocks }: { schedule: EmailCampaignSchedule; htmlTemplate: string | null; context: LiquidContext; contentBlocks?: ContentBlockMap }) {
  const extraProps = (schedule.extra_properties || {}) as Record<string, string>;
  const scheduleContext = useMemo<LiquidContext>(() => ({
    ...context,
    canvas_entry_properties: {
      email_title: schedule.email_title || '',
      pre_header: schedule.pre_header || '',
      header_title: schedule.header_title || '',
      body_copy: schedule.body_copy || '',
      cta_text: schedule.cta_text || '',
      cta_url: schedule.cta_url || '',
      image_url: schedule.image_url || '',
      offer_validity_seconds: schedule.offer_validity_hours ? String(Math.round(schedule.offer_validity_hours * 3600)) : '',
      ...extraProps,
    },
  }), [schedule, context, extraProps]);

  const renderedHtml = useLiquidRender(htmlTemplate, scheduleContext, contentBlocks);

  return (
    <TableRow key={`${schedule.id}-detail`}>
      <TableCell colSpan={5}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-3">
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Pre-header:</span> {schedule.pre_header || '—'}</p>
            <p><span className="font-medium">Header Title:</span> {schedule.header_title || '—'}</p>
            <p><span className="font-medium">Body Copy:</span> {schedule.body_copy || '—'}</p>
            <p><span className="font-medium">CTA:</span> {schedule.cta_text || '—'} → {schedule.cta_url || '—'}</p>
            <p><span className="font-medium">Offer Validity:</span> {schedule.offer_validity_hours ? `${schedule.offer_validity_hours}h (${Math.round(schedule.offer_validity_hours * 3600).toLocaleString()}s)` : '—'}</p>
            {Object.entries(extraProps).map(([key, value]) => (
              <p key={key}><span className="font-medium">{key}:</span> {value || '—'}</p>
            ))}
            <p><span className="font-medium">Braze Schedule ID:</span> {schedule.braze_schedule_id || '—'}</p>
            {schedule.braze_response && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">Braze Response JSON</summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-40 overflow-auto">{JSON.stringify(schedule.braze_response, null, 2)}</pre>
              </details>
            )}
          </div>
          {renderedHtml && (
            <div className="border rounded-md overflow-hidden" style={{ height: '300px' }}>
              <iframe
                srcDoc={renderedHtml}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                title="Email detail preview"
              />
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
