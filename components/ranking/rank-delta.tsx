import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function RankDelta({ delta, prevRank, isNew, className }: { delta: number | null | undefined; prevRank?: number | null; isNew?: boolean; className?: string }) {
  const showNew = isNew || (prevRank == null && delta == null);
  if (showNew) return <span className={cn("inline-flex items-center rounded bg-tier-b/15 px-1.5 py-0.5 text-[11px] font-bold text-tier-b", className)}>NEW</span>;
  if (!delta) return <span className={cn("inline-flex items-center text-xs text-muted-foreground", className)}><Minus className="h-3 w-3" /></span>;
  const up = delta > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold tabular", up ? "text-up" : "text-down", className)}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta)}
    </span>
  );
}
