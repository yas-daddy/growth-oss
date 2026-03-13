import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Apple, Facebook, Zap, Link, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useMetaCampaigns, MetaCampaign } from '@/hooks/useMetaCampaigns';
import { useAppleCampaigns, AppleCampaign } from '@/hooks/useAppleCampaigns';
import { useMolocoCampaigns, MolocoCampaign } from '@/hooks/useMolocoCampaigns';
import { formatDistanceToNow } from 'date-fns';
import { DateRangeFilter, DateRangeOption, getDateRange } from '@/components/DateRangeFilter';

// Filter campaigns by date range
function filterCampaignsByDateRange<T extends { start_date?: string | null; date_start?: string | null }>(
  campaigns: T[],
  startDate: Date | null,
  endDate: Date
): T[] {
  if (!startDate) return campaigns; // Lifetime - return all
  
  return campaigns.filter(campaign => {
    const campaignStart = campaign.start_date || campaign.date_start;
    if (!campaignStart) return true; // Include campaigns without dates
    
    const campaignDate = new Date(campaignStart);
    return campaignDate >= startDate && campaignDate <= endDate;
  });
}

export default function AdPlatformSettings() {
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('lifetime');
  const dateRange = getDateRange(dateRangeOption);

  const { campaigns, summary, isLoading, syncCampaigns, isSyncing } = useMetaCampaigns();
  const { 
    campaigns: appleCampaigns, 
    isLoading: isAppleLoading, 
    syncCampaigns: syncAppleCampaigns, 
    isSyncing: isAppleSyncing,
    isConnected: isAppleConnected,
    lastSynced: appleLastSynced,
  } = useAppleCampaigns();
  const {
    campaigns: molocoCampaigns,
    isLoading: isMolocoLoading,
    syncCampaigns: syncMolocoCampaigns,
    isSyncing: isMolocoSyncing,
    isConnected: isMolocoConnected,
    lastSynced: molocoLastSynced,
  } = useMolocoCampaigns();

  // Filter campaigns based on date range
  const filteredMetaCampaigns = useMemo(() => 
    filterCampaignsByDateRange(campaigns, dateRange.startDate, dateRange.endDate),
    [campaigns, dateRange.startDate, dateRange.endDate]
  );

  const filteredAppleCampaigns = useMemo(() => 
    filterCampaignsByDateRange(appleCampaigns, dateRange.startDate, dateRange.endDate),
    [appleCampaigns, dateRange.startDate, dateRange.endDate]
  );

  const filteredMolocoCampaigns = useMemo(() => 
    filterCampaignsByDateRange(molocoCampaigns, dateRange.startDate, dateRange.endDate),
    [molocoCampaigns, dateRange.startDate, dateRange.endDate]
  );

  // Calculate filtered totals for Apple
  const filteredAppleTotals = useMemo(() => {
    const totalSpend = filteredAppleCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalInstalls = filteredAppleCampaigns.reduce((sum, c) => sum + c.conversions, 0);
    return { totalSpend, totalInstalls };
  }, [filteredAppleCampaigns]);

  // Calculate filtered totals for Moloco
  const filteredMolocoTotals = useMemo(() => {
    const totalSpend = filteredMolocoCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalInstalls = filteredMolocoCampaigns.reduce((sum, c) => sum + c.installs, 0);
    const avgCpa = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
    return { totalSpend, totalInstalls, avgCpa };
  }, [filteredMolocoCampaigns]);

  // Calculate filtered totals for Meta
  const filteredMetaSummary = useMemo(() => {
    const totalSpend = filteredMetaCampaigns.reduce((sum, c) => sum + Number(c.spend), 0);
    const totalInstalls = filteredMetaCampaigns.reduce((sum, c) => sum + c.installs, 0);
    const avgCpa = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
    return { totalSpend, totalInstalls, avgCpa };
  }, [filteredMetaCampaigns]);

  const isMetaConnected = campaigns.length > 0 || (summary?.totalCampaigns ?? 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure and monitor your advertising channels
          </p>
        </div>
        <DateRangeFilter 
          selectedOption={dateRangeOption} 
          onChange={setDateRangeOption} 
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Meta Ads Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Facebook className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">Meta Ads</CardTitle>
                  <CardDescription className="text-sm">
                    Facebook and Instagram advertising campaigns
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMetaConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        Connected
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Synced
                      </Badge>
                    </>
                  )}
                </div>
                {summary?.lastSyncedAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(summary.lastSyncedAt), { addSuffix: true })}
                  </span>
                )}
              </div>

              {isMetaConnected ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-2xl font-bold">£{filteredMetaSummary.totalSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</p>
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredMetaSummary.totalInstalls?.toLocaleString() || '0'}</p>
                    <p className="text-xs text-muted-foreground">Installs</p>
                  </div>
                </div>
              ) : null}

              <Button 
                className="w-full gap-2" 
                variant={isMetaConnected ? "outline" : "default"}
                onClick={() => syncCampaigns()}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isSyncing ? 'Syncing...' : isMetaConnected ? 'Sync Now' : 'Sync Campaigns'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Apple Search Ads Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Apple className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">Apple Search Ads</CardTitle>
                  <CardDescription className="text-sm">
                    Track app install campaigns on the App Store
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAppleConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        Connected
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Synced
                      </Badge>
                    </>
                  )}
                </div>
                {appleLastSynced && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(appleLastSynced, { addSuffix: true })}
                  </span>
                )}
              </div>

              {isAppleConnected ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-2xl font-bold">£{filteredAppleTotals.totalSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</p>
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredAppleTotals.totalInstalls?.toLocaleString() || '0'}</p>
                    <p className="text-xs text-muted-foreground">Installs</p>
                  </div>
                </div>
              ) : null}

              <Button 
                className="w-full gap-2" 
                variant={isAppleConnected ? "outline" : "default"}
                onClick={() => syncAppleCampaigns()}
                disabled={isAppleSyncing}
              >
                {isAppleSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isAppleSyncing ? 'Syncing...' : isAppleConnected ? 'Sync Now' : 'Sync Campaigns'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Moloco Ads Card */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">Moloco Ads</CardTitle>
                  <CardDescription className="text-sm">
                    Machine learning powered mobile advertising
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMolocoConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        Connected
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Synced
                      </Badge>
                    </>
                  )}
                </div>
                {molocoLastSynced && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(molocoLastSynced, { addSuffix: true })}
                  </span>
                )}
              </div>

              {isMolocoConnected ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-2xl font-bold">£{filteredMolocoTotals.totalSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</p>
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredMolocoTotals.totalInstalls?.toLocaleString() || '0'}</p>
                    <p className="text-xs text-muted-foreground">Installs</p>
                  </div>
                </div>
              ) : null}

              <Button 
                className="w-full gap-2" 
                variant={isMolocoConnected ? "outline" : "default"}
                onClick={() => syncMolocoCampaigns()}
                disabled={isMolocoSyncing}
              >
                {isMolocoSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isMolocoSyncing ? 'Syncing...' : isMolocoConnected ? 'Sync Now' : 'Sync Campaigns'}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Meta Campaigns Table */}
      {isMetaConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meta Campaign Performance</CardTitle>
                <CardDescription>
                  Detailed metrics for all synced campaigns
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Avg CPA</p>
                <p className="text-2xl font-bold text-primary">
                  £{filteredMetaSummary.avgCpa?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMetaCampaigns.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Installs</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMetaCampaigns.map((campaign: MetaCampaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {campaign.campaign_name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.installs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.cpa).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  No campaign data yet. Click "Sync Campaigns" to fetch data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Apple Campaigns Table */}
      {isAppleConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Apple Search Ads Performance</CardTitle>
                <CardDescription>
                  Detailed metrics for all synced campaigns
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Total Installs</p>
                <p className="text-2xl font-bold text-primary">
                  {filteredAppleTotals.totalInstalls?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isAppleLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAppleCampaigns.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Taps</TableHead>
                      <TableHead className="text-right">Installs</TableHead>
                      <TableHead className="text-right">Avg CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppleCampaigns.map((campaign: AppleCampaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {campaign.campaign_name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.taps.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.avg_cpa || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  No campaign data yet. Click "Sync Campaigns" to fetch data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Moloco Campaigns Table */}
      {isMolocoConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Moloco Campaign Performance</CardTitle>
                <CardDescription>
                  Detailed metrics for all synced campaigns
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Avg CPA</p>
                <p className="text-2xl font-bold text-primary">
                  £{filteredMolocoTotals.avgCpa?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isMolocoLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMolocoCampaigns.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Installs</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMolocoCampaigns.map((campaign: MolocoCampaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {campaign.campaign_name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {campaign.installs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(campaign.cpa || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  No campaign data yet. Click "Sync Campaigns" to fetch data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Platform Performance Chart Placeholder */}
      {!isMetaConnected && !isAppleConnected && !isMolocoConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Performance</CardTitle>
            <CardDescription>
              Compare metrics across all connected platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
              <div className="text-center">
                <Link className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect at least one platform to view performance data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
