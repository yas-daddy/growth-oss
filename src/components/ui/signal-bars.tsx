import { cn } from "@/lib/utils";

interface SignalBarsProps {
  level: number; // 1-5, where 5 is highest/best
  maxLevel?: number;
  className?: string;
}

export function SignalBars({ level, maxLevel = 5, className }: SignalBarsProps) {
  // Clamp level between 1 and maxLevel
  const clampedLevel = Math.max(1, Math.min(level, maxLevel));
  
  return (
    <div className={cn("flex items-end gap-0.5 h-4", className)}>
      {Array.from({ length: maxLevel }).map((_, index) => {
        const barNumber = index + 1;
        const isActive = barNumber <= clampedLevel;
        // Height increases with each bar: 20%, 40%, 60%, 80%, 100%
        const heightPercent = (barNumber / maxLevel) * 100;
        
        return (
          <div
            key={barNumber}
            className={cn(
              "w-1.5 rounded-sm transition-colors",
              isActive 
                ? clampedLevel >= 4 
                  ? "bg-success" 
                  : clampedLevel >= 3 
                    ? "bg-primary" 
                    : "bg-muted-foreground"
                : "bg-secondary"
            )}
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
    </div>
  );
}
