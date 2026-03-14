import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportDefinition } from '@/hooks/useReportDefinitions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface FunnelReportProps {
  slug: string;
  startDate?: string;
  endDate?: string;
}

interface ConversionFunnelData {
  installs: number;
  signups: number;
  ftds: number;
  stds: number;
  install_to_signup: number;
  signup_to_ftd: number;
  ftd_to_std: number;
  install_to_std: number;
}

interface TopFunnelData {
  impressions: number;
  clicks: number;
  installs: number;
  ctr: number;
  install_rate: number;
}

type FunnelData = ConversionFunnelData | TopFunnelData;

interface FunnelStage {
  name: string;
  value: number;
  color: string;
  rate: number | null;
  rateLabel?: string;
}

function isTopFunnelData(data: FunnelData): data is TopFunnelData {
  return 'impressions' in data && 'ctr' in data;
}

export function FunnelReport({ slug, startDate, endDate }: FunnelReportProps) {
  const { data: definition, isLoading: defLoading } = useReportDefinition(slug);
  
  const { data: funnelData, isLoading: dataLoading } = useQuery({
    queryKey: ['funnel-report', slug, startDate, endDate],
    queryFn: async () => {
      if (!definition?.data_source || !startDate || !endDate) return null;
      
      const { data, error } = await (supabase.rpc as any)(definition.data_source, {
        start_date: startDate,
        end_date: endDate,
      });
      
      if (error) {
        console.error('Error fetching funnel data:', error);
        return null;
      }
      
      return data?.[0] as FunnelData | null;
    },
    enabled: !!definition?.data_source && !!startDate && !!endDate,
  });

  const isLoading = defLoading || dataLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="flex-1 h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!funnelData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{definition?.name || 'Funnel'}</CardTitle>
          <CardDescription>{definition?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[100px] flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build stages based on funnel type
  let stages: FunnelStage[];
  
  if (isTopFunnelData(funnelData)) {
    stages = [
      { 
        name: 'Impressions', 
        value: Number(funnelData.impressions), 
        color: 'bg-chart-1',
        rate: null,
      },
      { 
        name: 'Clicks', 
        value: Number(funnelData.clicks), 
        color: 'bg-chart-2',
        rate: Number(funnelData.ctr),
        rateLabel: 'CTR',
      },
      { 
        name: 'Installs', 
        value: Number(funnelData.installs), 
        color: 'bg-chart-3',
        rate: Number(funnelData.install_rate),
        rateLabel: 'Install Rate',
      },
    ];
  } else {
    stages = [
      { 
        name: 'Installs', 
        value: funnelData.installs, 
        color: 'bg-chart-1',
        rate: null,
      },
      { 
        name: 'Signups', 
        value: funnelData.signups, 
        color: 'bg-chart-2',
        rate: funnelData.install_to_signup,
      },
      { 
        name: 'FTDs', 
        value: funnelData.ftds, 
        color: 'bg-chart-3',
        rate: funnelData.signup_to_ftd,
      },
      { 
        name: 'STDs', 
        value: funnelData.stds, 
        color: 'bg-chart-4',
        rate: funnelData.ftd_to_std,
      },
    ];
  }

  const maxValue = stages[0].value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{definition?.name || 'Funnel'}</CardTitle>
        <CardDescription>{definition?.description || 'Progression through each stage'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-stretch gap-3">
          {stages.map((stage, index) => (
            <div key={stage.name} className="flex-1 flex items-center gap-3">
              <div className="flex-1 p-4 rounded-xl bg-muted/50 border border-border text-center relative overflow-hidden">
                <div 
                  className={`absolute inset-0 ${stage.color} opacity-10`}
                  style={{ 
                    clipPath: `polygon(0 0, ${Math.max(5, (stage.value / maxValue) * 100)}% 0, ${Math.max(5, (stage.value / maxValue) * 100)}% 100%, 0 100%)`
                  }}
                />
                <p className="text-2xl font-bold relative">{stage.value.toLocaleString()}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1 relative">
                  {stage.name}
                </p>
                {stage.rate !== null && (
                  <Badge variant="outline" className={`mt-2 ${stage.color.replace('bg-', 'text-')}`}>
                    {stage.rateLabel ? `${stage.rateLabel}: ` : ''}{stage.rate.toFixed(2)}%
                  </Badge>
                )}
              </div>
              {index < stages.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground/40 hidden lg:block flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
