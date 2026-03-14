import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plug, Target, ArrowRight, ArrowLeft, Check, Loader2, BarChart3 } from 'lucide-react';

const PROVIDERS = [
  { type: 'meta_ads', label: 'Meta Ads', method: 'oauth', description: 'Facebook & Instagram advertising' },
  { type: 'apple_search_ads', label: 'Apple Search Ads', method: 'api_key', description: 'App Store search advertising' },
  { type: 'moloco', label: 'Moloco', method: 'api_key', description: 'Programmatic mobile advertising' },
  { type: 'appsflyer', label: 'AppsFlyer', method: 'api_key', description: 'Mobile attribution & analytics' },
  { type: 'mixpanel', label: 'Mixpanel', method: 'api_key', description: 'Product analytics' },
  { type: 'app_store', label: 'App Store Connect', method: 'api_key', description: 'iOS app reviews & analytics' },
  { type: 'google_play', label: 'Google Play Console', method: 'api_key', description: 'Android app reviews & analytics' },
  { type: 'trustpilot', label: 'Trustpilot', method: 'api_key', description: 'Customer review management' },
  { type: 'google_search_console', label: 'Google Search Console', method: 'api_key', description: 'Search performance data' },
] as const;

const STEPS = [
  { icon: Building2, label: 'Create Organization', description: 'Set up your team workspace' },
  { icon: Plug, label: 'Connect Providers', description: 'Link your ad & analytics platforms' },
  { icon: Target, label: 'Conversion Events', description: 'Define your key optimization events' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch } = useOrganization();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 state
  const [orgName, setOrgName] = useState('');

  // Step 2 state - selected providers (just marking intent, actual connection in settings later)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // Step 3 state
  const [conversionEvents, setConversionEvents] = useState([
    { event_name: '', event_label: '', is_primary: true },
  ]);

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error('Please enter an organization name');
      return;
    }

    setIsSubmitting(true);
    try {
      const slug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim(), slug, created_by: user!.id })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ org_id: org.id, user_id: user!.id, role: 'owner' });

      if (memberError) throw memberError;

      // Also assign admin role in user_roles so RLS policies work
      await supabase
        .from('user_roles')
        .upsert({ user_id: user!.id, role: 'admin' }, { onConflict: 'user_id,role' });

      setCreatedOrgId(org.id);
      setStep(1);
      toast.success('Organization created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipProviders = () => {
    setStep(2);
  };

  const handleSaveProviders = () => {
    // Just move to next step — actual provider connection happens in settings
    setStep(2);
  };

  const toggleProvider = (type: string) => {
    setSelectedProviders(prev =>
      prev.includes(type) ? prev.filter(p => p !== type) : [...prev, type]
    );
  };

  const handleAddEvent = () => {
    setConversionEvents(prev => [...prev, { event_name: '', event_label: '', is_primary: false }]);
  };

  const handleRemoveEvent = (index: number) => {
    setConversionEvents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    setConversionEvents(prev => prev.map((e, i) => ({ ...e, is_primary: i === index })));
  };

  const handleFinish = async () => {
    if (!createdOrgId) return;

    setIsSubmitting(true);
    try {
      // Save conversion events (filter out empty ones)
      const validEvents = conversionEvents.filter(e => e.event_name.trim() && e.event_label.trim());
      if (validEvents.length > 0) {
        const { error: eventsError } = await supabase
          .from('conversion_events')
          .insert(validEvents.map(e => ({
            org_id: createdOrgId,
            event_name: e.event_name.trim(),
            event_label: e.event_label.trim(),
            is_primary: e.is_primary,
          })));
        if (eventsError) throw eventsError;
      }

      // Mark onboarding as completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user!.id);

      if (profileError) throw profileError;

      await refetch();
      toast.success('Setup complete! Welcome to GrowthOS.');
      navigate('/home', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">GrowthOS</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === step
                ? 'bg-primary text-primary-foreground'
                : i < step
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="w-full max-w-lg animate-fade-in">
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Create your organization</CardTitle>
              <CardDescription>This is your team's workspace where all data and settings are stored.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                />
              </div>
              <Button onClick={handleCreateOrg} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </>
        )}

        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Connect your providers</CardTitle>
              <CardDescription>Select the platforms you use. You can configure credentials later in Settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.type}
                    onClick={() => toggleProvider(p.type)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      selectedProviders.includes(p.type)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {p.method === 'oauth' ? 'OAuth' : 'API Key'}
                      </Badge>
                      {selectedProviders.includes(p.type) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button onClick={handleSaveProviders} className="flex-1">
                  {selectedProviders.length > 0 ? 'Continue' : 'Skip'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Define conversion events</CardTitle>
              <CardDescription>What events represent a conversion for your business? The primary event is used for CPA calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversionEvents.map((event, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSetPrimary(i)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                        event.is_primary
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer'
                      }`}
                    >
                      {event.is_primary ? '★ Primary' : 'Set as primary'}
                    </button>
                    {conversionEvents.length > 1 && (
                      <button
                        onClick={() => handleRemoveEvent(i)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Event Name (technical)</Label>
                      <Input
                        placeholder="e.g. purchase"
                        value={event.event_name}
                        onChange={(e) => {
                          const updated = [...conversionEvents];
                          updated[i] = { ...updated[i], event_name: e.target.value };
                          setConversionEvents(updated);
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Display Label</Label>
                      <Input
                        placeholder="e.g. Purchase"
                        value={event.event_label}
                        onChange={(e) => {
                          const updated = [...conversionEvents];
                          updated[i] = { ...updated[i], event_label: e.target.value };
                          setConversionEvents(updated);
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={handleAddEvent} className="w-full" size="sm">
                + Add another event
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button onClick={handleFinish} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Finish Setup
                  <Check className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
