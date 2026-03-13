import { useMemo } from 'react';
import { useAppsFlyerEvents } from './useAppsFlyerCampaigns';

export type QualityRank = 'Best' | 'Good' | 'Average' | 'Bad';

interface CampaignQuality {
  mediaSource: string;
  campaignName: string;
  ftds: number;
  netRevenue: number;
  avgNetDepositPerFTD: number;
  rank: QualityRank;
}

interface ChannelQuality {
  mediaSource: string;
  ftds: number;
  netRevenue: number;
  avgNetDepositPerFTD: number;
  rank: QualityRank;
}

export function useQualityRanking(startDate: string, endDate: string) {
  const { data: ftdEvents = [], isLoading: ftdLoading } = useAppsFlyerEvents('first_time_deposit', startDate, endDate);
  const { data: revenueEvents = [], isLoading: revenueLoading } = useAppsFlyerEvents('net_revenue', startDate, endDate);

  const { campaignRankings, channelRankings, isLoading } = useMemo(() => {
    if (ftdLoading || revenueLoading) {
      return { campaignRankings: [], channelRankings: [], isLoading: true };
    }

    // Events are already filtered by date at the query level
    const filteredFTDs = ftdEvents;
    const filteredRevenue = revenueEvents;

    // Build campaign FTD map
    const campaignFTDMap = new Map<string, number>();
    for (const event of filteredFTDs) {
      const key = `${event.media_source}|${event.campaign_name}`;
      campaignFTDMap.set(key, (campaignFTDMap.get(key) || 0) + event.event_count);
    }

    // Build campaign revenue map
    const campaignRevenueMap = new Map<string, number>();
    for (const event of filteredRevenue) {
      const key = `${event.media_source}|${event.campaign_name}`;
      campaignRevenueMap.set(key, (campaignRevenueMap.get(key) || 0) + (event.event_revenue || 0));
    }

    // Calculate avg net deposit per FTD for each campaign
    const campaigns: CampaignQuality[] = [];
    const allKeys = new Set([...campaignFTDMap.keys(), ...campaignRevenueMap.keys()]);
    
    for (const key of allKeys) {
      const [mediaSource, campaignName] = key.split('|');
      const ftds = campaignFTDMap.get(key) || 0;
      const netRevenue = campaignRevenueMap.get(key) || 0;
      
      // Only include campaigns with at least 1 FTD
      if (ftds > 0) {
        campaigns.push({
          mediaSource,
          campaignName,
          ftds,
          netRevenue,
          avgNetDepositPerFTD: netRevenue / ftds,
          rank: 'Average', // Will be assigned below
        });
      }
    }

    // Sort by avg net deposit per FTD descending
    campaigns.sort((a, b) => b.avgNetDepositPerFTD - a.avgNetDepositPerFTD);

    // Assign quartile rankings
    const total = campaigns.length;
    const assignRank = (index: number): QualityRank => {
      if (total === 0) return 'Average';
      const percentile = index / total;
      if (percentile < 0.25) return 'Best';
      if (percentile < 0.5) return 'Good';
      if (percentile < 0.75) return 'Average';
      return 'Bad';
    };

    const rankedCampaigns = campaigns.map((c, i) => ({
      ...c,
      rank: assignRank(i),
    }));

    // Aggregate by channel (weighted average by FTDs)
    const channelMap = new Map<string, { ftds: number; netRevenue: number }>();
    for (const campaign of rankedCampaigns) {
      const existing = channelMap.get(campaign.mediaSource) || { ftds: 0, netRevenue: 0 };
      existing.ftds += campaign.ftds;
      existing.netRevenue += campaign.netRevenue;
      channelMap.set(campaign.mediaSource, existing);
    }

    const channels: ChannelQuality[] = [];
    for (const [mediaSource, data] of channelMap.entries()) {
      if (data.ftds > 0) {
        channels.push({
          mediaSource,
          ftds: data.ftds,
          netRevenue: data.netRevenue,
          avgNetDepositPerFTD: data.netRevenue / data.ftds,
          rank: 'Average',
        });
      }
    }

    // Sort channels and assign rankings
    channels.sort((a, b) => b.avgNetDepositPerFTD - a.avgNetDepositPerFTD);
    const channelTotal = channels.length;
    const rankedChannels = channels.map((c, i) => ({
      ...c,
      rank: assignRank(i <= 0 ? 0 : i / channelTotal < 0.25 ? 0 : i),
    }));

    // Re-assign channel rankings properly
    for (let i = 0; i < rankedChannels.length; i++) {
      const percentile = i / channelTotal;
      if (percentile < 0.25) rankedChannels[i].rank = 'Best';
      else if (percentile < 0.5) rankedChannels[i].rank = 'Good';
      else if (percentile < 0.75) rankedChannels[i].rank = 'Average';
      else rankedChannels[i].rank = 'Bad';
    }

    return {
      campaignRankings: rankedCampaigns,
      channelRankings: rankedChannels,
      isLoading: false,
    };
  }, [ftdEvents, revenueEvents, startDate, endDate, ftdLoading, revenueLoading]);

  const getCampaignRanking = (mediaSource: string, campaignName: string): QualityRank | null => {
    const campaign = campaignRankings.find(
      c => c.mediaSource === mediaSource && c.campaignName === campaignName
    );
    return campaign?.rank || null;
  };

  const getChannelRanking = (mediaSource: string): QualityRank | null => {
    const channel = channelRankings.find(c => c.mediaSource === mediaSource);
    return channel?.rank || null;
  };

  return {
    campaignRankings,
    channelRankings,
    getCampaignRanking,
    getChannelRanking,
    isLoading,
  };
}
