import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { DashboardOptionsMenu } from '@/components/dashboard/DashboardOptionsMenu';
import { DateRangeFilter, DateRangeOption, getDateRange, getPreviousPeriod, CustomDateRange } from '@/components/DateRangeFilter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: config, isLoading } = useDashboardConfig(slug || '');
  const queryClient = useQueryClient();
  
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('mtd');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  
  const dateRange = getDateRange(dateRangeOption, customRange);
  const prevDateRange = getPreviousPeriod(dateRangeOption, customRange);
  
  const startDateStr = dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const endDateStr = format(dateRange.endDate, 'yyyy-MM-dd');
  const prevStartDateStr = prevDateRange?.startDate ? format(prevDateRange.startDate, 'yyyy-MM-dd') : undefined;
  const prevEndDateStr = prevDateRange?.endDate ? format(prevDateRange.endDate, 'yyyy-MM-dd') : undefined;

  const handleConfigChange = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-config', slug] });
  };

  if (!slug) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-5 w-72" />
            </div>
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!config) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{config.name || slug}</h1>
              {config.description && (
                <p className="text-sm md:text-base text-muted-foreground line-clamp-2">{config.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <DateRangeFilter
                selectedOption={dateRangeOption}
                onChange={setDateRangeOption}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
              <DashboardOptionsMenu 
                dashboardSlug={slug} 
                onConfigChange={handleConfigChange}
              />
            </div>
          </div>
        </div>

        {/* Configurable Dashboard */}
        <ConfigurableDashboard
          dashboardSlug={slug}
          startDate={startDateStr}
          endDate={endDateStr}
          prevStartDate={prevStartDateStr}
          prevEndDate={prevEndDateStr}
        />
      </div>
    </DashboardLayout>
  );
}
