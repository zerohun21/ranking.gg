import { cn } from "@/lib/utils";

/** 별점 분포 미니 바 (10칸) */
export function DistBar({ dist, className, height = 16 }: { dist: number[]; className?: string; height?: number }) {
  const max = Math.max(1, ...dist);
  return (
    <span className={cn("inline-flex items-end gap-px", className)} style={{ height }} aria-hidden>
      {dist.map((d, i) => (
        <span
          key={i}
          className={cn("w-[5px] rounded-[1px]", i >= 7 ? "bg-tier-b" : i >= 4 ? "bg-muted-foreground/60" : "bg-lose/70")}
          style={{ height: `${Math.max(8, (d / max) * 100)}%` }}
          title={`${(i + 1) / 2}점: ${d}`}
        />
      ))}
    </span>
  );
}
export function distFromStats(s: { dist1: number; dist2: number; dist3: number; dist4: number; dist5: number; dist6: number; dist7: number; dist8: number; dist9: number; dist10: number }): number[] {
  return [s.dist1, s.dist2, s.dist3, s.dist4, s.dist5, s.dist6, s.dist7, s.dist8, s.dist9, s.dist10];
}
