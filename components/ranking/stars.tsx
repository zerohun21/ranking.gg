import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 읽기 전용 별 5개 (0.5 단위) */
export function Stars({ value, size = 12, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-px", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-muted-foreground/40" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-[#ffb400] text-[#ffb400]" style={{ width: size, height: size }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
