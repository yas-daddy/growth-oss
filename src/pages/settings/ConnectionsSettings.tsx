import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Database, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMetaCampaigns } from '@/hooks/useMetaCampaigns';
import { useAppleCampaigns } from '@/hooks/useAppleCampaigns';
import { useMolocoCampaigns } from '@/hooks/useMolocoCampaigns';
import { useAppsFlyerCampaigns, useSyncAppsFlyer } from '@/hooks/useAppsFlyerCampaigns';
import { useMixpanelEvents, useSyncMixpanel } from '@/hooks/useMixpanel';
import { useTrustpilotStats, useSyncTrustpilotReviews } from '@/hooks/useTrustpilotReviews';
import { useGooglePlayStats, useSyncGooglePlayReviews } from '@/hooks/useGooglePlayReviews';
import { useAppStoreStats, useSyncAppStoreReviews } from '@/hooks/useAppStoreReviews';
import { useTypeformStats } from '@/hooks/useTypeformSurveys';
import { useOrganicInstallsStats, useSyncOrganicInstalls, useSearchConsoleStats, useSyncSearchConsole } from '@/hooks/useOrganicInstalls';

import { useUserRole } from '@/hooks/useUserRole';
import { formatDistanceToNow } from 'date-fns';

export default function ConnectionsSettings() {
  const { canSyncData } = useUserRole();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState<{ name: string; onSync: () => void } | null>(null);

  const { campaigns: metaCampaigns, summary: metaSummary, syncCampaigns: syncMeta, isSyncing: isMetaSyncing } = useMetaCampaigns();
  const { isConnected: isAppleConnected, lastSynced: appleLastSynced, syncCampaigns: syncApple, isSyncing: isAppleSyncing } = useAppleCampaigns();
  const { isConnected: isMolocoConnected, lastSynced: molocoLastSynced, syncCampaigns: syncMoloco, isSyncing: isMolocoSyncing } = useMolocoCampaigns();
  const { data: appsFlyerCampaigns } = useAppsFlyerCampaigns();
  const { mutate: syncAppsFlyer, isPending: isAppsFlyerSyncing } = useSyncAppsFlyer();
  const { data: mixpanelEvents } = useMixpanelEvents();
  const { mutate: syncMixpanel, isPending: isMixpanelSyncing } = useSyncMixpanel();
  const { stats: trustpilotStats } = useTrustpilotStats();
  const { mutate: syncTrustpilot, isPending: isTrustpilotSyncing } = useSyncTrustpilotReviews();
  const { stats: googlePlayStats } = useGooglePlayStats();
  const { mutate: syncGooglePlay, isPending: isGooglePlaySyncing } = useSyncGooglePlayReviews();
  const { stats: appStoreStats } = useAppStoreStats();
  const { mutate: syncAppStore, isPending: isAppStoreSyncing } = useSyncAppStoreReviews();
  const { stats: typeformStats } = useTypeformStats();
  const { data: organicInstallsStats } = useOrganicInstallsStats();
  const { mutate: syncOrganicInstalls, isPending: isOrganicInstallsSyncing } = useSyncOrganicInstalls();
  const { data: searchConsoleStats } = useSearchConsoleStats();
  const { mutate: syncSearchConsole, isPending: isSearchConsoleSyncing } = useSyncSearchConsole();

  const isMetaConnected = metaCampaigns.length > 0 || (metaSummary?.totalCampaigns ?? 0) > 0;
  const isAppsFlyerConnected = (appsFlyerCampaigns?.length ?? 0) > 0;
  const appsFlyerLastSynced = appsFlyerCampaigns?.[0]?.synced_at ? new Date(appsFlyerCampaigns[0].synced_at) : null;
  const isMixpanelConnected = (mixpanelEvents?.length ?? 0) > 0;
  const mixpanelLastSynced = mixpanelEvents?.[0]?.synced_at ? new Date(mixpanelEvents[0].synced_at) : null;

  const apiConnections = [
    { name: 'Meta Ads', type: 'Ad Platform', isConnected: isMetaConnected, lastSynced: metaSummary?.lastSyncedAt ? new Date(metaSummary.lastSyncedAt) : null, onSync: syncMeta, isSyncing: isMetaSyncing },
    { name: 'Apple Search Ads', type: 'Ad Platform', isConnected: isAppleConnected, lastSynced: appleLastSynced, onSync: syncApple, isSyncing: isAppleSyncing },
    { name: 'Moloco Ads', type: 'Ad Platform', isConnected: isMolocoConnected, lastSynced: molocoLastSynced, onSync: syncMoloco, isSyncing: isMolocoSyncing },
    { name: 'AppsFlyer', type: 'Attribution', isConnected: isAppsFlyerConnected, lastSynced: appsFlyerLastSynced, onSync: () => syncAppsFlyer(), isSyncing: isAppsFlyerSyncing },
    { name: 'Mixpanel', type: 'Analytics', isConnected: isMixpanelConnected, lastSynced: mixpanelLastSynced, onSync: () => syncMixpanel(undefined), isSyncing: isMixpanelSyncing },
    { name: 'App Store Reviews', type: 'App Ratings', isConnected: appStoreStats.totalReviews > 0, lastSynced: appStoreStats.lastSynced ? new Date(appStoreStats.lastSynced) : null, onSync: () => syncAppStore(), isSyncing: isAppStoreSyncing },
    { name: 'Google Play Reviews', type: 'App Ratings', isConnected: googlePlayStats.totalReviews > 0, lastSynced: googlePlayStats.lastSynced ? new Date(googlePlayStats.lastSynced) : null, onSync: () => syncGooglePlay(), isSyncing: isGooglePlaySyncing },
    { name: 'Trustpilot Reviews', type: 'App Ratings', isConnected: trustpilotStats.totalReviews > 0, lastSynced: trustpilotStats.lastSynced ? new Date(trustpilotStats.lastSynced) : null, onSync: () => syncTrustpilot(), isSyncing: isTrustpilotSyncing },
    { name: 'Typeform Surveys', type: 'Surveys (Webhook)', isConnected: typeformStats.totalResponses > 0, lastSynced: typeformStats.lastSynced ? new Date(typeformStats.lastSynced) : null, onSync: null, isSyncing: false },
    { name: 'Google Search Console', type: 'Brand Visibility', isConnected: (searchConsoleStats?.totalRecords ?? 0) > 0, lastSynced: searchConsoleStats?.lastSynced ? new Date(searchConsoleStats.lastSynced) : null, onSync: () => syncSearchConsole(), isSyncing: isSearchConsoleSyncing },
    { name: 'App Store Analytics', type: 'Brand Visibility', isConnected: (organicInstallsStats?.totalRecords ?? 0) > 0, lastSynced: organicInstallsStats?.lastSynced ? new Date(organicInstallsStats.lastSynced) : null, onSync: () => syncOrganicInstalls(), isSyncing: isOrganicInstallsSyncing },
    
  ];

  const handleSyncClick = (api: { name: string; onSync: () => void }) => {
    setPendingSync(api);
    setSyncConfirmOpen(true);
  };

  const handleConfirmSync = () => {
    if (pendingSync) pendingSync.onSync();
    setSyncConfirmOpen(false);
    setPendingSync(null);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Connections</h1>
          <p className="text-muted-foreground">Connected platforms and their sync status</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1">
            {apiConnections.map((api) => (
              <div key={api.name} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {api.isConnected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{api.name}</p>
                    <p className="text-xs text-muted-foreground">{api.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {api.lastSynced && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(api.lastSynced, { addSuffix: true })}
                    </span>
                  )}
                  <Badge variant="outline" className={api.isConnected ? "text-green-500 border-green-500/30" : "text-muted-foreground"}>
                    {api.isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                  {canSyncData && api.onSync && (
                    <Button variant="ghost" size="sm" onClick={() => handleSyncClick(api as any)} disabled={api.isSyncing} className="h-8 w-8 p-0">
                      <RefreshCw className={`h-4 w-4 ${api.isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Refresh Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to force refresh {pendingSync?.name}? This will re-sync all data from the source.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmSync}>Force Refresh</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
