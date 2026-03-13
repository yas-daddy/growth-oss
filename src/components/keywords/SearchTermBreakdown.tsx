import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImpressionShareBar } from '@/components/ui/impression-share-bar';
import { SignalBars } from '@/components/ui/signal-bars';
import { useAppleSearchTerms, SearchTermMetrics } from '@/hooks/useAppleSearchTerms';
import { KeywordColumnDef } from '@/hooks/useAppleKeywords';
import { cn } from '@/lib/utils';

interface SearchTermBreakdownProps {
  keywordId: string;
  startDate: string;
  endDate: string;
  visibleColumns: KeywordColumnDef[];
}

// Metrics NOT available at search term level (AppsFlyer attributed)
const UNAVAILABLE_METRICS = new Set(['af_installs', 'ftds', 'bets_placed', 'cpa_ftd', 'cpa_bet']);

const formatValue = (value: number | string, formatType: KeywordColumnDef['format']): string => {
  if (typeof value === 'string') return value;
  
  switch (formatType) {
    case 'currency':
      return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':
      return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'decimal':
      return value.toFixed(2);
    default:
      return String(value);
  }
};

function SearchTermRow({ 
  term, 
  visibleColumns 
}: { 
  term: SearchTermMetrics;
  visibleColumns: KeywordColumnDef[];
}) {
  // Map search term data to keyword column keys
  const getSearchTermValue = (colKey: string): number | string | null => {
    switch (colKey) {
      case 'keyword_text':
        return term.search_term_text;
      case 'match_type':
        return term.match_type || 'UNKNOWN';
      case 'spend':
        return term.spend;
      case 'impressions':
        return term.impressions;
      case 'taps':
        return term.taps;
      case 'installs':
        return term.installs;
      case 'ttr':
        return term.ttr;
      case 'cpt':
        return term.cpt;
      case 'cpi':
        return term.cpi;
      case 'impression_share_low':
        return term.impression_share_low;
      case 'impression_rank':
        return term.impression_rank;
      case 'search_popularity':
        return term.search_popularity;
      case 'bid_amount':
        return null; // No bid for search terms
      case 'campaign_name':
        return null; // Could be added if needed
      case 'adgroup_name':
        return null;
      default:
        return null;
    }
  };

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/50">
      {/* Expand column spacer */}
      <TableCell className="w-6 px-2"></TableCell>
      
      {visibleColumns.map(col => {
        const colKey = col.key as string;
        
        // AppsFlyer metrics not available at search term level
        if (UNAVAILABLE_METRICS.has(colKey)) {
          return (
            <TableCell key={colKey} className="text-muted-foreground text-right">
              N/A
            </TableCell>
          );
        }
        
        const value = getSearchTermValue(colKey);
        
        // Keyword text column - show search term with indent
        if (colKey === 'keyword_text') {
          return (
            <TableCell key={colKey} className="sticky left-8 bg-muted/30 z-10 pl-6">
              <span className="text-muted-foreground">↳</span>{' '}
              <span className="font-normal">{term.search_term_text}</span>
            </TableCell>
          );
        }
        
        // Match type badge
        if (colKey === 'match_type') {
          const matchType = term.match_type || 'UNKNOWN';
          return (
            <TableCell key={colKey}>
              <Badge variant="secondary" className="text-xs">{matchType}</Badge>
            </TableCell>
          );
        }
        
        // Impression share bar
        if (colKey === 'impression_share_low') {
          if (term.impression_share_low === null || term.impression_share_high === null) {
            return <TableCell key={colKey} className="text-muted-foreground">—</TableCell>;
          }
          return (
            <TableCell key={colKey}>
              <ImpressionShareBar low={term.impression_share_low} high={term.impression_share_high} />
            </TableCell>
          );
        }
        
        // Rank badge
        if (colKey === 'impression_rank') {
          if (term.impression_rank === null) {
            return <TableCell key={colKey} className="text-muted-foreground">—</TableCell>;
          }
          const rank = term.impression_rank;
          const rankDisplay = rank > 5 ? '>5' : String(rank);
          const rankColorClass = rank === 1 ? 'bg-success/10 text-success border-success/30' 
            : rank <= 3 ? 'bg-primary/10 text-primary border-primary/30'
            : rank <= 5 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
            : 'bg-destructive/10 text-destructive border-destructive/30';
          return (
            <TableCell key={colKey}>
              <Badge variant="outline" className={cn("text-xs font-normal", rankColorClass)}>
                {rankDisplay}
              </Badge>
            </TableCell>
          );
        }
        
        // Search popularity signal bars
        if (colKey === 'search_popularity') {
          if (term.search_popularity === null) {
            return <TableCell key={colKey} className="text-muted-foreground">—</TableCell>;
          }
          return (
            <TableCell key={colKey}>
              <SignalBars level={term.search_popularity} maxLevel={5} />
            </TableCell>
          );
        }
        
        // Null values
        if (value === null) {
          return <TableCell key={colKey} className="text-muted-foreground text-right">—</TableCell>;
        }
        
        // Standard formatted values - right align numeric columns
        const isNumeric = col.format === 'currency' || col.format === 'number' || col.format === 'percentage' || col.format === 'decimal';
        return (
          <TableCell key={colKey} className={isNumeric ? 'text-right' : ''}>
            {formatValue(value, col.format)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export function SearchTermBreakdown({ 
  keywordId, 
  startDate, 
  endDate, 
  visibleColumns 
}: SearchTermBreakdownProps) {
  const { data: searchTerms, isLoading, error } = useAppleSearchTerms(keywordId, startDate, endDate);
  const colSpan = visibleColumns.length + 1; // +1 for expand column

  if (isLoading) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell className="w-6 px-2"></TableCell>
        {visibleColumns.map((col, i) => (
          <TableCell key={col.key as string}>
            <Skeleton className="h-4 w-16" />
          </TableCell>
        ))}
      </TableRow>
    );
  }

  if (error) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-destructive/5 py-3 text-destructive text-sm text-center">
          Error loading search terms
        </TableCell>
      </TableRow>
    );
  }

  if (!searchTerms || searchTerms.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-3 text-muted-foreground text-sm text-center">
          No search term data for this keyword
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {searchTerms.map((term, idx) => (
        <SearchTermRow 
          key={term.search_term_text + idx} 
          term={term} 
          visibleColumns={visibleColumns}
        />
      ))}
    </>
  );
}

interface ExpandableKeywordRowProps {
  children: React.ReactNode;
  keywordId: string;
  startDate: string;
  endDate: string;
  visibleColumns: KeywordColumnDef[];
}

export function ExpandableKeywordRow({ 
  children, 
  keywordId, 
  startDate, 
  endDate, 
  visibleColumns 
}: ExpandableKeywordRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell className="w-6 px-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        {children}
      </TableRow>
      {isOpen && (
        <SearchTermBreakdown 
          keywordId={keywordId} 
          startDate={startDate} 
          endDate={endDate} 
          visibleColumns={visibleColumns}
        />
      )}
    </>
  );
}
