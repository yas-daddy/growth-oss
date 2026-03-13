import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { QualityBadge } from '@/components/QualityBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReportDefinition } from '@/hooks/useReportDefinitions';
import { useQualityRanking, QualityRank } from '@/hooks/useQualityRanking';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TableColumnConfig {
  key: string;
  header: string;
  type: 'text' | 'currency' | 'currency_decimal' | 'number' | 'percentage' | 'badge' | 'progress' | 'qualityBadge';
  badgeColors?: Record<string, { bg: string; text: string }>;
  badgeLabels?: Record<string, string>;
}

export interface TableReportConfig {
  columns: TableColumnConfig[];
  description?: string;
  sortable?: boolean;
}

interface TableReportProps {
  slug: string;
  startDate?: string;
  endDate?: string;
}

// Badge color mapping
const DEFAULT_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  ad: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  affiliate: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
  earned: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  // Media source mappings
  'Facebook Ads': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  'Apple Search Ads': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200' },
  'moloco_int': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
  'Organic': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
};

const DEFAULT_BADGE_LABELS: Record<string, string> = {
  ad: 'Ad Platform',
  affiliate: 'Affiliate',
  earned: 'Earned Media',
  'Facebook Ads': 'Meta',
  'Apple Search Ads': 'Apple',
  'moloco_int': 'Moloco',
  'Organic': 'Organic',
};

// Format cell value based on type
function formatCellValue(value: unknown, type: TableColumnConfig['type']): string {
  if (value === null || value === undefined) return '—';
  
  const numValue = Number(value);
  
  switch (type) {
    case 'currency':
      return `£${Math.round(numValue).toLocaleString()}`;
    case 'currency_decimal':
      return `£${numValue.toFixed(2)}`;
    case 'number':
      return numValue.toLocaleString();
    case 'percentage':
      return `${numValue.toFixed(1)}%`;
    default:
      return String(value);
  }
}

// Calculate quality rank from avg_net_per_ftd values using quartiles
function calculateQualityRank(value: number, allValues: number[]): QualityRank | null {
  if (!value || value <= 0 || allValues.length === 0) return null;
  
  const positiveValues = allValues.filter(v => v > 0).sort((a, b) => a - b);
  if (positiveValues.length === 0) return null;
  
  const q1 = positiveValues[Math.floor(positiveValues.length * 0.25)] || 0;
  const q2 = positiveValues[Math.floor(positiveValues.length * 0.5)] || 0;
  const q3 = positiveValues[Math.floor(positiveValues.length * 0.75)] || 0;
  
  if (value >= q3) return 'Best';
  if (value >= q2) return 'Good';
  if (value >= q1) return 'Average';
  return 'Bad';
}

type SortDirection = 'asc' | 'desc' | null;

export function TableReport({ slug, startDate, endDate }: TableReportProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: definition, isLoading: definitionLoading } = useReportDefinition(slug);
  const { getChannelRanking } = useQualityRanking(startDate, endDate);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const { data: tableData, isLoading: dataLoading } = useQuery({
    queryKey: ['table-report-data', slug, startDate, endDate],
    queryFn: async () => {
      if (!definition?.data_source || !startDate || !endDate) {
        return null;
      }

      const { data, error } = await supabase.rpc(
        definition.data_source as 'get_report_channel_performance' | 'get_report_affiliate_performance' | 'get_report_campaign_performance',
        { start_date: startDate, end_date: endDate }
      );

      if (error) {
        console.error(`Error calling ${definition.data_source}:`, error);
        throw error;
      }

      return data as Record<string, unknown>[];
    },
    enabled: !!user && !!definition?.data_source && !!startDate && !!endDate,
    staleTime: 30 * 1000,
  });

  const isLoading = definitionLoading || dataLoading;
  const config = definition?.config as unknown as TableReportConfig;
  const columns = config?.columns || [];
  const isSortable = config?.sortable ?? false;

  // Calculate quality values for campaign-level ranking
  const qualityValues = useMemo(() => {
    if (!tableData) return [];
    return tableData.map(row => Number(row.avg_net_per_ftd) || 0);
  }, [tableData]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!tableData || !sortColumn || !sortDirection) return tableData;
    
    return [...tableData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Numeric comparison
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
  }, [tableData, sortColumn, sortDirection]);

  const handleSort = (key: string) => {
    if (!isSortable) return;
    
    if (sortColumn === key) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  if (isLoading || !definition) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate max values for progress columns
  const maxValues: Record<string, number> = {};
  if (sortedData) {
    columns.forEach(col => {
      if (col.type === 'progress') {
        maxValues[col.key] = Math.max(...sortedData.map(row => Number(row[col.key]) || 0), 1);
      }
    });
  }

  // Render cell based on column type
  const renderCell = (row: Record<string, unknown>, column: TableColumnConfig) => {
    const value = row[column.key];

    switch (column.type) {
      case 'badge': {
        const strValue = String(value || '');
        const badgeColors = column.badgeColors || DEFAULT_BADGE_COLORS;
        const badgeLabels = column.badgeLabels || DEFAULT_BADGE_LABELS;
        const colors = badgeColors[strValue] || DEFAULT_BADGE_COLORS['ad'];
        const label = badgeLabels[strValue] || strValue;
        
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
            {label}
          </span>
        );
      }

      case 'progress': {
        const numValue = Number(value) || 0;
        const maxValue = maxValues[column.key] || 1;
        const percentage = (numValue / maxValue) * 100;
        
        return <Progress value={percentage} className="h-2 w-[100px]" />;
      }

      case 'qualityBadge': {
        // Check if we have campaign-level data (avg_net_per_ftd field)
        if ('avg_net_per_ftd' in row && column.key === 'avg_net_per_ftd') {
          const avgNetPerFtd = Number(row.avg_net_per_ftd) || 0;
          const rank = calculateQualityRank(avgNetPerFtd, qualityValues);
          return <QualityBadge rank={rank} size="sm" />;
        }
        
        // Fall back to channel-level ranking
        const channel = String(row.channel || row.affiliate_channel || row.media_source || '');
        const ranking = getChannelRanking(channel);
        return <QualityBadge rank={ranking} size="sm" />;
      }

      case 'percentage': {
        const numValue = Number(value) || 0;
        const isPositive = numValue >= 0;
        return (
          <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
            {formatCellValue(value, column.type)}
          </span>
        );
      }

      default:
        return <span>{formatCellValue(value, column.type)}</span>;
    }
  };

  const renderSortIcon = (key: string) => {
    if (!isSortable) return null;
    
    if (sortColumn !== key) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{definition.name}</CardTitle>
        {definition.description && (
          <CardDescription>{definition.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead 
                  key={col.key}
                  className={`${['currency', 'currency_decimal', 'number', 'percentage', 'progress', 'qualityBadge'].includes(col.type) ? 'text-right' : ''} ${isSortable ? 'cursor-pointer select-none hover:bg-muted/50' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  <div className={`flex items-center ${['currency', 'currency_decimal', 'number', 'percentage', 'progress', 'qualityBadge'].includes(col.type) ? 'justify-end' : ''}`}>
                    {col.header}
                    {renderSortIcon(col.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!sortedData || sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  No data available for selected period
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, index) => {
                const affiliateId = row.affiliate_id as string | undefined;
                const isClickable = !!affiliateId;
                return (
                <TableRow 
                  key={index}
                  className={isClickable ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={isClickable ? () => navigate(`/settings/affiliates/${affiliateId}`) : undefined}
                >
                  {columns.map(col => (
                    <TableCell 
                      key={col.key}
                      className={['currency', 'currency_decimal', 'number', 'percentage'].includes(col.type) ? 'text-right' : col.type === 'progress' ? 'w-[150px]' : ''}
                    >
                      {renderCell(row, col)}
                    </TableCell>
                  ))}
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
