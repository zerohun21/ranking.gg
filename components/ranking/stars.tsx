import { cn } from "@/lib/utils";

/** 읽기 전용 별 5개 (0.5 단위) — SVG 대신 텍스트 글리프 + 그라디언트 클리핑 (DOM 1개) */
export function Stars({ value, size = 12, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={cn("inline-block select-none leading-none tracking-[-0.05em]", className)}
      style={{ fontSize: size, backgroundImage: `linear-gradient(90deg,#ffb400 ${pct}%,var(--star-empty,#6b7280) ${pct}%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
      aria-label={`${value} / 5`}
      role="img"
    >
      ★★★★★
    </span>
  );
}
