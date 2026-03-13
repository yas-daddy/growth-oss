import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'accent';
  invertColors?: boolean; // When true, positive = bad (red), negative = good (green)
  subtitle?: string;
  customContent?: ReactNode;
}

export function KPICard({ 
  title, 
  value, 
  change, 
  icon,
  variant = 'default',
  invertColors = false,
  subtitle,
  customContent
}: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0;
  
  // For inverted metrics (like CPA), positive change is bad, negative is good
  const isGood = invertColors ? isNegative : isPositive;
  const isBad = invertColors ? isPositive : isNegative;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg",
      variant === 'primary' && "border-primary/20 bg-primary/5",
      variant === 'accent' && "border-accent/20 bg-accent/5"
    )}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-xl md:text-2xl font-bold tracking-tight">{value}</p>
            {customContent}
            {subtitle && (
              <p className="text-[10px] md:text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={cn(
              "p-2 md:p-2.5 rounded-lg flex-shrink-0",
              variant === 'primary' && "bg-primary/10 text-primary",
              variant === 'accent' && "bg-accent/10 text-accent",
              variant === 'default' && "bg-muted text-muted-foreground"
            )}>
              {icon}
            </div>
          )}
        </div>
        
        {change !== undefined && (
          <div className="mt-3 md:mt-4 flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1 text-xs md:text-sm font-medium",
              isGood && "text-success",
              isBad && "text-destructive",
              isNeutral && "text-muted-foreground"
            )}>
              {isPositive && <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />}
              {isNegative && <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />}
              {isNeutral && <Minus className="h-3 w-3 md:h-4 md:w-4" />}
              <span>{isPositive ? '+' : ''}{Math.round(change)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}