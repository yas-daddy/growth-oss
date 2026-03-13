import { cn } from "@/lib/utils";

interface ImpressionShareBarProps {
  low: number;
  high: number;
  className?: string;
}

export function ImpressionShareBar({ low, high, className }: ImpressionShareBarProps) {
  // Use the midpoint for the progress visualization
  const midpoint = (low + high) / 2;
  
  // Color based on share level
  const getBarColor = () => {
    if (midpoint >= 70) return "bg-success";
    if (midpoint >= 40) return "bg-primary";
    if (midpoint >= 20) return "bg-yellow-500";
    return "bg-muted-foreground";
  };

  return (
    <div className={cn("flex items-center gap-2 min-w-[120px]", className)}>
      <div className="relative h-2 w-16 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", getBarColor())}
          style={{ width: `${midpoint}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {low}-{high}%
      </span>
    </div>
  );
}
