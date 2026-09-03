import { formatScore, stars5 } from "@/lib/format";
import { Stars } from "./stars";
import { cn } from "@/lib/utils";

export function Score({ score, size = "md", showStars = true, className }: { score: number | string | null | undefined; size?: "sm" | "md" | "lg" | "xl"; showStars?: boolean; className?: string }) {
  const n = Number(score ?? 0);
  const cls = { sm: "text-sm", md: "text-base", lg: "text-2xl", xl: "text-4xl" }[size];
  return (
    <span className={cn("inline-flex flex-col items-start leading-none", className)}>
      <span className={cn("font-extrabold tabular", cls, n >= 8.5 ? "text-tier-s" : n >= 7.5 ? "text-tier-a" : n >= 6.5 ? "text-tier-b" : n > 0 ? "text-foreground" : "text-muted-foreground")}>{formatScore(n)}</span>
      {showStars && n > 0 && <Stars value={stars5(n)} size={size === "xl" ? 16 : size === "lg" ? 14 : 10} className="mt-1" />}
    </span>
  );
}
