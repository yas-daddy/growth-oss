import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useReportDefinitions, ReportDefinition } from '@/hooks/useReportDefinitions';
import { Report, TableReport, FunnelReport } from '@/components/reports';
import { Skeleton } from '@/components/ui/skeleton';

interface ConfigurableDashboardProps {
  dashboardSlug: string;
  startDate: string;
  endDate: string;
  prevStartDate?: string;
  prevEndDate?: string;
}

export function ConfigurableDashboard({ 
  dashboardSlug, 
  startDate, 
  endDate,
  prevStartDate,
  prevEndDate,
}: ConfigurableDashboardProps) {
  const { data: config, isLoading: configLoading } = useDashboardConfig(dashboardSlug);
  const { data: allReports, isLoading: reportsLoading } = useReportDefinitions();

  const isLoading = configLoading || reportsLoading;

  const reports = (config?.report_slugs || [])
    .map(slug => allReports?.find(r => r.slug === slug))
    .filter((r): r is ReportDefinition => !!r);

  // Group consecutive reports by type for proper grid rendering
  const groupedReports: { type: string; reports: ReportDefinition[] }[] = [];
  reports.forEach(report => {
    const lastGroup = groupedReports[groupedReports.length - 1];
    if (lastGroup && lastGroup.type === report.report_type) {
      lastGroup.reports.push(report);
    } else {
      groupedReports.push({ type: report.report_type, reports: [report] });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No reports configured. Use the menu to edit this dashboard and add reports.
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {groupedReports.map((group, groupIndex) => {
            if (group.type === 'kpi') {
              return (
                <div key={groupIndex} className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
                  {group.reports.map(report => (
                    <Report
                      key={report.slug}
                      slug={report.slug}
                      startDate={startDate}
                      endDate={endDate}
                      prevStartDate={prevStartDate}
                      prevEndDate={prevEndDate}
                    />
                  ))}
                </div>
              );
            }
            if (group.type === 'chart') {
              return (
                <div key={groupIndex} className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
                  {group.reports.map(report => (
                    <div key={report.slug} className="overflow-x-auto">
                      <div className="min-w-[320px]">
                        <Report
                          slug={report.slug}
                          startDate={startDate}
                          endDate={endDate}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (group.type === 'table') {
              return (
                <div key={groupIndex} className="space-y-4 md:space-y-6">
                  {group.reports.map(report => (
                    <div key={report.slug} className="overflow-x-auto">
                      <div className="min-w-[320px]">
                        <TableReport
                          slug={report.slug}
                          startDate={startDate}
                          endDate={endDate}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (group.type === 'funnel') {
              return (
                <div key={groupIndex} className="space-y-4 md:space-y-6">
                  {group.reports.map(report => (
                    <FunnelReport
                      key={report.slug}
                      slug={report.slug}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  ))}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
