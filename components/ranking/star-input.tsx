"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 0.5 단위 인터랙티브 별 5개 — 호버 프리뷰, 클릭 확정, 같은 값 재클릭은 onChange(0) */
export function StarInput({ value, onChange, size = 28, disabled, className }: { value: number | null; onChange: (v: number) => void; size?: number; disabled?: boolean; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const calc = (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientX - rect.left < rect.width / 2;
    return i - (half ? 0.5 : 0);
  };
  return (
    <div className={cn("inline-flex items-center gap-0.5", disabled && "pointer-events-none opacity-60", className)} onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, shown - (i - 1)));
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value != null && Math.ceil(value) === i}
            aria-label={`${i}`}
            className="relative block cursor-pointer transition-transform hover:scale-110"
            style={{ width: size, height: size }}
            onMouseMove={(e) => setHover(calc(e, i))}
            onClick={(e) => {
              const v = calc(e, i);
              onChange(value === v ? 0 : v);
            }}
          >
            <Star className="absolute inset-0 text-muted-foreground/40" style={{ width: size, height: size }} strokeWidth={1.5} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-[#ffb400] text-[#ffb400]" style={{ width: size, height: size }} strokeWidth={1.5} />
            </span>
          </button>
        );
      })}
      <span className="ml-2 min-w-[2.5ch] text-sm font-bold tabular text-[#ffb400]">{shown ? shown.toFixed(1) : ""}</span>
    </div>
  );
}
