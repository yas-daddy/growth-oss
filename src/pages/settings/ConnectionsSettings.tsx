import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CheckCircle2, Plug, Loader2, Unplug, ChevronDown, HelpCircle, Facebook } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProviderConnections, useUpsertProviderConnection, useDisconnectProvider } from '@/hooks/useProviderConnections';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
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
  setupGuide: string[];
  fields: ProviderField[];
}

interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  currency: string;
}

interface MetaPage {
  id: string;
  name: string;
  instagram_business_account_id: string | null;
}

const PROVIDERS: ProviderDef[] = [
  {
    type: 'meta_ads',
    label: 'Meta Ads',
    category: 'Ad Platform',
    method: 'oauth',
    description: 'Facebook & Instagram advertising. Connect via Facebook Login to sync campaigns, ads, and performance data.',
    fields: [],
    setupGuide: [],
  },
  {
    type: 'apple_search_ads',
    label: 'Apple Search Ads',
    category: 'Ad Platform',
    method: 'api_key',
    description: 'App Store search advertising. Sync keyword bids, campaigns, and conversion data.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'SEARCHADS.xxxx' },
      { key: 'team_id', label: 'Team ID', type: 'text', placeholder: 'Your team ID' },
      { key: 'key_id', label: 'Key ID', type: 'text', placeholder: 'Your key ID' },
      { key: 'private_key', label: 'Private Key', type: 'textarea', placeholder: '-----BEGIN EC PRIVATE KEY-----\n...' },
      { key: 'org_id_apple', label: 'Org ID', type: 'text', placeholder: 'Your Apple Search Ads Org ID' },
    ],
    setupGuide: [
      'Sign in at searchads.apple.com with your Apple ID.',
      'Click on your account name in the top-right corner, then go to "Settings".',
      'Click the "API" tab at the top of the page.',
      'Under "Client API Certificates", click "Create API Certificate". Choose an "Account Admin" or "Account Read Only" role.',
      'After creating the certificate, you\'ll see your Client ID (starts with "SEARCHADS."), Team ID, and Key ID.',
      'Click "Download" to save the private key file (.key). Open it in a text editor and copy the full contents including the BEGIN/END lines.',
      'Your Org ID is visible in the top-right of the Apple Search Ads dashboard next to your account name.',
    ],
  },
  {
    type: 'moloco',
    label: 'Moloco',
    category: 'Ad Platform',
    method: 'api_key',
    description: 'Programmatic mobile advertising platform for performance marketing.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Moloco API key' },
      { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'Your Moloco ad account ID' },
      { key: 'platform_id', label: 'Platform ID', type: 'text', placeholder: 'e.g., ROULETTE' },
    ],
    setupGuide: [
      'Log in to your Moloco dashboard at dashboard.moloco.com.',
      'Navigate to "Settings" in the left sidebar.',
      'Under the "API" section, you\'ll find your API Key. Click "Show" or "Copy" to get it.',
      'Your Ad Account ID is displayed at the top of the Settings page or in your account dropdown.',
      'The Platform ID is your app identifier used in Moloco (e.g., "ROULETTE"). You can find it under Campaign settings or ask your Moloco account manager.',
    ],
  },
  {
    type: 'appsflyer',
    label: 'AppsFlyer',
    category: 'Attribution',
    method: 'api_key',
    description: 'Mobile attribution and marketing analytics platform.',
    fields: [
      { key: 'api_token', label: 'API Token (V2)', type: 'password', placeholder: 'Your AppsFlyer API token' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'e.g., id123456789 or com.example.app' },
    ],
    setupGuide: [
      'Log in to your AppsFlyer dashboard at hq1.appsflyer.com.',
      'Click on your email/avatar in the top-right corner and select "Security Center".',
      'Scroll down to "API Tokens" and find your V2 API Token. Click the copy icon.',
      'Your App ID is your app\'s identifier: for iOS it starts with "id" followed by numbers (e.g., id123456789), for Android it\'s your package name (e.g., com.example.app).',
    ],
  },
  {
    type: 'mixpanel',
    label: 'Mixpanel',
    category: 'Analytics',
    method: 'api_key',
    description: 'Product analytics for tracking user engagement and retention.',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'Your Mixpanel project ID' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Your Mixpanel API secret' },
    ],
    setupGuide: [
      'Log in to mixpanel.com and open the project you want to connect.',
      'Click the gear icon ⚙️ in the top-right corner to open Project Settings.',
      'Under "Project Details", you\'ll see your Project ID (a numeric value). Copy it.',
      'On the same page, scroll to "API Secret" and click "Show" to reveal it. Copy it.',
    ],
  },
  {
    type: 'app_store',
    label: 'App Store Connect',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync iOS app reviews and respond directly from GrowthOS.',
    fields: [
      { key: 'key_id', label: 'Key ID', type: 'text', placeholder: 'Your API key ID' },
      { key: 'issuer_id', label: 'Issuer ID', type: 'text', placeholder: 'Your issuer ID' },
      { key: 'private_key', label: 'Private Key (.p8)', type: 'textarea', placeholder: '-----BEGIN PRIVATE KEY-----\n...' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'e.g., 123456789' },
    ],
    setupGuide: [
      'Sign in at appstoreconnect.apple.com.',
      'Go to "Users and Access" from the top navigation.',
      'Click the "Integrations" tab, then select "App Store Connect API" in the sidebar.',
      'Click the "+" button to create a new API key. Give it a name and select "Admin" or "Developer" access.',
      'Once created, you\'ll see the Key ID in the list. Your Issuer ID is shown at the top of the page.',
      'Click "Download API Key" to get the .p8 file. ⚠️ You can only download this once! Open it in a text editor and copy the full contents.',
      'For your App ID: go to "Apps" in App Store Connect, click your app, and find the Apple ID in the "App Information" section.',
    ],
  },
  {
    type: 'google_play',
    label: 'Google Play Console',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync Android app reviews and respond directly from GrowthOS.',
    fields: [
      { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '{"type": "service_account", ...}', helpText: 'Paste the full JSON key file contents' },
      { key: 'package_name', label: 'Package Name', type: 'text', placeholder: 'com.example.app' },
    ],
    setupGuide: [
      'Go to console.cloud.google.com and select (or create) the project linked to your app.',
      'Open the hamburger menu ☰ → "IAM & Admin" → "Service Accounts".',
      'Click "+ Create Service Account". Give it a name like "growthOS-reviews" and click "Create and Continue".',
      'Skip the optional role steps and click "Done".',
      'Click on the new service account, go to the "Keys" tab, click "Add Key" → "Create new key" → choose JSON → click "Create". A file will download.',
      'Open the downloaded JSON file in a text editor and paste the entire contents into the field below.',
      'Now go to play.google.com/console. Open "Settings" → "API access". Find your service account and click "Grant access".',
      'Give it "View app information and download bulk reports" + "Reply to reviews" permissions, then click "Invite user".',
      'Your Package Name is your Android app ID (e.g., com.example.app), visible in the Play Console URL or app dashboard.',
    ],
  },
  {
    type: 'trustpilot',
    label: 'Trustpilot',
    category: 'Reviews',
    method: 'api_key',
    description: 'Sync and manage Trustpilot customer reviews.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Trustpilot API key' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Your Trustpilot API secret' },
      { key: 'business_unit_id', label: 'Business Unit ID', type: 'text', placeholder: 'Your Trustpilot business unit ID' },
      { key: 'username', label: 'Trustpilot Username', type: 'text', placeholder: 'your@email.com' },
      { key: 'password', label: 'Trustpilot Password', type: 'password', placeholder: 'Your password' },
    ],
    setupGuide: [
      'Log in to your Trustpilot Business account at businessapp.b2b.trustpilot.com.',
      'Go to "Integrations" in the left sidebar, then click on "API" or "Developers".',
      'Create an application if you don\'t already have one. You\'ll receive an API Key and API Secret.',
      'Your Business Unit ID can be found in the URL when viewing your Trustpilot business page, or under "Business Settings". It\'s a long alphanumeric string.',
      'The username and password are your Trustpilot login credentials — the same email and password you used to sign in.',
    ],
  },
  {
    type: 'google_search_console',
    label: 'Google Search Console',
    category: 'SEO',
    method: 'api_key',
    description: 'Track search performance, impressions, and click-through rates.',
    fields: [
      { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', placeholder: '{"type": "service_account", ...}' },
      { key: 'site_url', label: 'Site URL', type: 'text', placeholder: 'https://example.com' },
    ],
    setupGuide: [
      'Go to console.cloud.google.com and select (or create) a project.',
      'Enable the "Google Search Console API": go to "APIs & Services" → "Library", search for "Search Console API", and click "Enable".',
      'Create a Service Account: go to "IAM & Admin" → "Service Accounts" → "+ Create Service Account". Name it and click through the steps.',
      'Click on the service account, go to "Keys" tab → "Add Key" → "Create new key" → JSON. A file will download.',
      'Copy the service account email address (looks like name@project.iam.gserviceaccount.com).',
      'Go to search.google.com/search-console. Open your property, then go to "Settings" → "Users and permissions" → "Add user".',
      'Paste the service account email, set permission to "Full", and click "Add".',
      'Open the downloaded JSON file in a text editor and paste the full contents into the field below.',
    ],
  },
];

export default function ConnectionsSettings() {
  const { isOrgAdmin } = useOrganization();
  const { data: connections, isLoading } = useProviderConnections();
  const upsertConnection = useUpsertProviderConnection();
  const disconnectProvider = useDisconnectProvider();

  const [searchParams, setSearchParams] = useSearchParams();
  const [connectDialog, setConnectDialog] = useState<ProviderDef | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [guideOpen, setGuideOpen] = useState(false);

  // Meta OAuth state
  const [metaOAuthLoading, setMetaOAuthLoading] = useState(false);
  const [metaAccountDialog, setMetaAccountDialog] = useState(false);
  const [metaAdAccounts, setMetaAdAccounts] = useState<MetaAdAccount[]>([]);
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [metaSaving, setMetaSaving] = useState(false);
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);

  const getConnection = (providerType: string) =>
    connections?.find(c => c.provider === providerType && c.status === 'connected');

  // Handle Meta OAuth callback
  const handleMetaCallback = useCallback(async (code: string) => {
    setMetaOAuthLoading(true);
    try {
      const redirectUri = `${window.location.origin}/settings/connections`;
      const { data, error } = await supabase.functions.invoke('meta-oauth-callback', {
        body: { code, redirect_uri: redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMetaAccessToken(data.access_token);
      setMetaAdAccounts(data.ad_accounts || []);
      setMetaPages(data.pages || []);

      // Auto-select if only one account
      if (data.ad_accounts?.length === 1) {
        setSelectedAdAccount(data.ad_accounts[0].id);
      }
      if (data.pages?.length === 1) {
        setSelectedPage(data.pages[0].id);
      }

      setMetaAccountDialog(true);
    } catch (err: any) {
      console.error('Meta OAuth error:', err);
      toast.error(err.message || 'Failed to connect to Facebook');
    } finally {
      setMetaOAuthLoading(false);
    }
  }, []);

  // Check for OAuth callback on mount
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state === 'meta_callback') {
      // Clean up URL params
      searchParams.delete('code');
      searchParams.delete('state');
      setSearchParams(searchParams, { replace: true });
      handleMetaCallback(code);
    }
  }, [searchParams, setSearchParams, handleMetaCallback]);

  const handleMetaOAuthStart = async () => {
    setMetaOAuthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-app-id');
      if (error) throw error;
      if (!data?.app_id) throw new Error('Meta App not configured');

      const redirectUri = `${window.location.origin}/settings/connections`;
      const scope = 'ads_read,ads_management,pages_read_engagement,pages_show_list';
      const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${data.app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=meta_callback`;

      window.location.href = oauthUrl;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Facebook login');
      setMetaOAuthLoading(false);
    }
  };

  const handleMetaAccountSave = async () => {
    if (!selectedAdAccount) {
      toast.error('Please select an ad account');
      return;
    }
    setMetaSaving(true);
    try {
      const selectedPageObj = metaPages.find(p => p.id === selectedPage);
      const { data, error } = await supabase.functions.invoke('meta-oauth-save', {
        body: {
          access_token: metaAccessToken,
          ad_account_id: selectedAdAccount,
          page_id: selectedPage || null,
          instagram_actor_id: selectedPageObj?.instagram_business_account_id || null,
          display_name: metaAdAccounts.find(a => a.id === selectedAdAccount)?.name || 'Meta Ads',
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Meta Ads connected successfully via Facebook Login');
      setMetaAccountDialog(false);
      // Refresh connections
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Meta connection');
    } finally {
      setMetaSaving(false);
    }
  };

  const openConnectDialog = (provider: ProviderDef) => {
    // For Meta, start OAuth flow instead of showing form
    if (provider.type === 'meta_ads' && !showAdvancedMeta) {
      handleMetaOAuthStart();
      return;
    }
    const existing = connections?.find(c => c.provider === provider.type);
    const initialData: Record<string, string> = {};
    provider.fields.forEach(f => {
      initialData[f.key] = (existing?.credentials as any)?.[f.key] || '';
    });
    setFormData(initialData);
    setGuideOpen(false);
    setConnectDialog(provider);
  };

  const handleConnect = async () => {
    if (!connectDialog) return;
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

  const categories = [...new Set(PROVIDERS.map(p => p.category))];

  // Advanced Meta fields for manual token entry
  const advancedMetaFields: ProviderField[] = [
    { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Your long-lived access token', helpText: 'Generate from Facebook Business Settings → System Users' },
    { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789' },
  ];

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
                const isMetaProvider = provider.type === 'meta_ads';

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
                                  {isMetaProvider ? (
                                    <Button size="sm" variant="outline" onClick={handleMetaOAuthStart} disabled={metaOAuthLoading}>
                                      {metaOAuthLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Facebook className="h-3 w-3 mr-1" />}
                                      Reconnect
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => openConnectDialog(provider)}>
                                      Edit
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDisconnectDialog(provider.type)}>
                                    <Unplug className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                isMetaProvider ? (
                                  <div className="flex flex-col gap-1">
                                    <Button size="sm" onClick={handleMetaOAuthStart} disabled={metaOAuthLoading}>
                                      {metaOAuthLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Facebook className="h-3 w-3 mr-1" />}
                                      Connect with Facebook
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => openConnectDialog(provider)}>
                                    <Plug className="h-3 w-3 mr-1" /> Connect
                                  </Button>
                                )
                              )}
                            </>
                          )}
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

      {/* Meta Account Selector Dialog */}
      <Dialog open={metaAccountDialog} onOpenChange={setMetaAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Ad Account</DialogTitle>
            <DialogDescription>
              Choose which Meta ad account to connect to GrowthOS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {metaAdAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No ad accounts found. Make sure your Facebook account has access to at least one ad account.
              </p>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad Account</Label>
                <div className="grid gap-2">
                  {metaAdAccounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAdAccount(account.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        selectedAdAccount === account.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">{account.id} · {account.currency}</p>
                      </div>
                      {selectedAdAccount === account.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {metaPages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Facebook Page (optional)</Label>
                <div className="grid gap-2">
                  <button
                    onClick={() => setSelectedPage('')}
                    className={`flex items-center p-3 rounded-lg border text-left transition-colors text-sm ${
                      !selectedPage ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    None
                  </button>
                  {metaPages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPage(page.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        selectedPage === page.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{page.name}</p>
                        {page.instagram_business_account_id && (
                          <p className="text-xs text-muted-foreground">Has Instagram business account</p>
                        )}
                      </div>
                      {selectedPage === page.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaAccountDialog(false)}>Cancel</Button>
            <Button onClick={handleMetaAccountSave} disabled={!selectedAdAccount || metaSaving}>
              {metaSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Connect Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Dialog (non-Meta providers) */}
      <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect {connectDialog?.label}</DialogTitle>
            <DialogDescription>Enter your credentials below to connect this service.</DialogDescription>
          </DialogHeader>

          {/* Setup Guide */}
          {connectDialog && connectDialog.setupGuide.length > 0 && (
            <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <HelpCircle className="h-3.5 w-3.5" />
                    How to get these credentials
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${guideOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-lg border bg-muted/50 p-4 mb-4">
                  <ol className="space-y-2.5">
                    {connectDialog.setupGuide.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

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
