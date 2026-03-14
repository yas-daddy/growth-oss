import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, XCircle, Plug, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProviderConnections, useUpsertProviderConnection, useDisconnectProvider } from '@/hooks/useProviderConnections';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  placeholder: string;
  helpText?: string;
}

interface ProviderDef {
  type: string;
  label: string;
  category: string;
  method: 'oauth' | 'api_key';
  description: string;
  docsUrl: string;
  fields: ProviderField[];
  instructions: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    type: 'meta_ads',
    label: 'Meta Ads',
    category: 'Ad Platform',
    method: 'oauth',
    description: 'Facebook & Instagram advertising. Connect via OAuth to sync campaigns, ads, and performance data.',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis/',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Your long-lived access token', helpText: 'Generate from Facebook Business Settings → System Users' },
      { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789' },
    ],
    instructions: 'Go to Meta Business Suite → Settings → System Users → Generate Token with ads_read and ads_management permissions.',
  },
  {
    type: 'apple_search_ads',
    label: 'Apple Search Ads',
    category: 'Ad Platform',
    method: 'api_key',
    description: 'App Store search advertising. Sync keyword bids, campaigns, and conversion data.',
    docsUrl: 'https://developer.apple.com/documentation/apple_search_ads',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'SEARCHADS.xxxx' },
      { key: 'team_id', label: 'Team ID', type: 'text', placeholder: 'Your team ID' },
      { key: 'key_id', label: 'Key ID', type: 'text', placeholder: 'Your key ID' },
      { key: 'private_key', label: 'Private Key', type: 'textarea', placeholder: '-----BEGIN EC PRIVATE KEY-----\n...' },
      { key: 'org_id_apple', label: 'Org ID', type: 'text', placeholder: 'Your Apple Search Ads Org ID' },
    ],
    instructions: 'Go to Apple Search Ads → Settings → API → Create API certificate. Download the private key and enter the credentials below.',
  },
  {
    type: 'moloco',
    label: 'Moloco',
    category: 'Ad Platform',
    method: 'api_key',
    description: 'Programmatic mobile advertising platform for performance marketing.',
    docsUrl: 'https://moloco.com/docs',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Moloco API key' },
      { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'Your Moloco ad account ID' },
      { key: 'platform_id', label: 'Platform ID', type: 'text', placeholder: 'e.g., ROULETTE' },
    ],
    instructions: 'Contact your Moloco account manager to obtain API credentials, or find them in the Moloco dashboard under Settings.',
  },
  {
    type: 'appsflyer',
    label: 'AppsFlyer',
    category: 'Attribution',
    method: 'api_key',
    description: 'Mobile attribution and marketing analytics platform.',
    docsUrl: 'https://support.appsflyer.com/hc/en-us/articles/207034486',
    fields: [
      { key: 'api_token', label: 'API Token (V2)', type: 'password', placeholder: 'Your AppsFlyer API token' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'e.g., id123456789 or com.example.app' },
    ],
    instructions: 'Go to AppsFlyer Dashboard → Settings → API Access → Copy your V2 API Token.',
  },
  {
    type: 'mixpanel',
    label: 'Mixpanel',
    category: 'Analytics',
    method: 'api_key',
    description: 'Product analytics for tracking user engagement and retention.',
    docsUrl: 'https://developer.mixpanel.com/docs',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'Your Mixpanel project ID' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Your Mixpanel API secret' },
    ],
    instructions: 'Go to Mixpanel → Settings → Project Settings → find your Project ID and API Secret.',
  },
  {
    type: 'app_store',
    label: 'App Store Connect',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync iOS app reviews and respond directly from GrowthOS.',
    docsUrl: 'https://developer.apple.com/documentation/appstoreconnectapi',
    fields: [
      { key: 'key_id', label: 'Key ID', type: 'text', placeholder: 'Your API key ID' },
      { key: 'issuer_id', label: 'Issuer ID', type: 'text', placeholder: 'Your issuer ID' },
      { key: 'private_key', label: 'Private Key (.p8)', type: 'textarea', placeholder: '-----BEGIN PRIVATE KEY-----\n...' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'e.g., 123456789' },
    ],
    instructions: 'Go to App Store Connect → Users and Access → Integrations → App Store Connect API → Generate API Key.',
  },
  {
    type: 'google_play',
    label: 'Google Play Console',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync Android app reviews and respond directly from GrowthOS.',
    docsUrl: 'https://developers.google.com/android-publisher',
    fields: [
      { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '{"type": "service_account", ...}', helpText: 'Paste the full JSON key file contents' },
      { key: 'package_name', label: 'Package Name', type: 'text', placeholder: 'com.example.app' },
    ],
    instructions: 'Create a Service Account in Google Cloud Console, grant it access in Google Play Console, and download the JSON key file.',
  },
  {
    type: 'trustpilot',
    label: 'Trustpilot',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync and manage Trustpilot customer reviews.',
    docsUrl: 'https://documentation-apidocumentation.trustpilot.com/',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Trustpilot API key' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Your Trustpilot API secret' },
      { key: 'business_unit_id', label: 'Business Unit ID', type: 'text', placeholder: 'Your Trustpilot business unit ID' },
      { key: 'username', label: 'Trustpilot Username', type: 'text', placeholder: 'your@email.com' },
      { key: 'password', label: 'Trustpilot Password', type: 'password', placeholder: 'Your password' },
    ],
    instructions: 'Go to Trustpilot Business → Integrations → API to find your API key and Business Unit ID.',
  },
  {
    type: 'google_search_console',
    label: 'Google Search Console',
    category: 'SEO',
    method: 'api_key',
    description: 'Track search performance, impressions, and click-through rates.',
    docsUrl: 'https://developers.google.com/webmaster-tools/v1/how-tos/authorizing',
    fields: [
      { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '{"type": "service_account", ...}' },
      { key: 'site_url', label: 'Site URL', type: 'text', placeholder: 'https://example.com' },
    ],
    instructions: 'Create a Service Account in Google Cloud Console, add it as a user in Search Console, and download the JSON key.',
  },
];

export default function ConnectionsSettings() {
  const { isOrgAdmin } = useOrganization();
  const { data: connections, isLoading } = useProviderConnections();
  const upsertConnection = useUpsertProviderConnection();
  const disconnectProvider = useDisconnectProvider();

  const [connectDialog, setConnectDialog] = useState<ProviderDef | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const getConnection = (providerType: string) =>
    connections?.find(c => c.provider === providerType && c.status === 'connected');

  const openConnectDialog = (provider: ProviderDef) => {
    // Pre-fill if already connected
    const existing = connections?.find(c => c.provider === provider.type);
    const initialData: Record<string, string> = {};
    provider.fields.forEach(f => {
      initialData[f.key] = (existing?.credentials as any)?.[f.key] || '';
    });
    setFormData(initialData);
    setConnectDialog(provider);
  };

  const handleConnect = async () => {
    if (!connectDialog) return;

    // Validate required fields
    const emptyFields = connectDialog.fields.filter(f => !formData[f.key]?.trim());
    if (emptyFields.length > 0) {
      toast.error(`Please fill in: ${emptyFields.map(f => f.label).join(', ')}`);
      return;
    }

    try {
      await upsertConnection.mutateAsync({
        provider: connectDialog.type,
        auth_method: connectDialog.method,
        credentials: formData,
        display_name: connectDialog.label,
      });
      toast.success(`${connectDialog.label} connected successfully`);
      setConnectDialog(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog) return;
    try {
      await disconnectProvider.mutateAsync(disconnectDialog);
      toast.success('Provider disconnected');
      setDisconnectDialog(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  // Group providers by category
  const categories = [...new Set(PROVIDERS.map(p => p.category))];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">Connect your ad platforms, analytics, and review services</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        categories.map(category => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">{category}</h2>
            <div className="grid gap-3">
              {PROVIDERS.filter(p => p.category === category).map(provider => {
                const connection = getConnection(provider.type);
                const isConnected = !!connection;

                return (
                  <Card key={provider.type} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isConnected ? 'bg-green-500/10' : 'bg-muted'
                          }`}>
                            {isConnected ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Plug className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm">{provider.label}</h3>
                              <Badge variant="outline" className="text-[10px]">
                                {provider.method === 'oauth' ? 'OAuth' : 'API Key'}
                              </Badge>
                              {isConnected && (
                                <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">
                                  Connected
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                            {connection?.last_synced_at && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Last synced: {new Date(connection.last_synced_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isOrgAdmin && (
                            <>
                              {isConnected ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openConnectDialog(provider)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDisconnectDialog(provider.type)}>
                                    <Unplug className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" onClick={() => openConnectDialog(provider)}>
                                  <Plug className="h-3 w-3 mr-1" /> Connect
                                </Button>
                              )}
                            </>
                          )}
                          <Button size="sm" variant="ghost" asChild>
                            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Connect Dialog */}
      <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect {connectDialog?.label}</DialogTitle>
            <DialogDescription>{connectDialog?.instructions}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {connectDialog?.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm">{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={4}
                    className="text-xs font-mono"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="text-sm"
                  />
                )}
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(null)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={upsertConnection.isPending}>
              {upsertConnection.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {getConnection(connectDialog?.type || '') ? 'Update' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Dialog */}
      <Dialog open={!!disconnectDialog} onOpenChange={() => setDisconnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Provider</DialogTitle>
            <DialogDescription>
              Are you sure? This will remove the stored credentials. You can reconnect later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectProvider.isPending}>
              {disconnectProvider.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
