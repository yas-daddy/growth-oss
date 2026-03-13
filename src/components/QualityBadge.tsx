import { Badge } from '@/components/ui/badge';
import { QualityRank } from '@/hooks/useQualityRanking';

interface QualityBadgeProps {
  rank: QualityRank | null;
  size?: 'sm' | 'md';
}

export function QualityBadge({ rank, size = 'md' }: QualityBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : '';

  if (!rank) {
    return (
      <span className="inline-flex">
        <Badge variant="outline" className="text-muted-foreground">
          N/A
        </Badge>
      </span>
    );
  }

  switch (rank) {
    case 'Best':
      return (
        <span className="inline-flex">
          <Badge className={`bg-success/10 text-success border-success/30 hover:bg-success/20 ${sizeClasses}`}>
            Best
          </Badge>
        </span>
      );
    case 'Good':
      return (
        <span className="inline-flex">
          <Badge className={`bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 ${sizeClasses}`}>
            Good
          </Badge>
        </span>
      );
    case 'Average':
      return (
        <span className="inline-flex">
          <Badge className={`bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 ${sizeClasses}`}>
            Average
          </Badge>
        </span>
      );
    case 'Bad':
      return (
        <span className="inline-flex">
          <Badge className={`bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 ${sizeClasses}`}>
            Bad
          </Badge>
        </span>
      );
    default:
      return null;
  }
}