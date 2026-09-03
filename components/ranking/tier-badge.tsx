import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/db/schema";

const CLS: Record<Tier, string> = {
  S: "bg-tier-s text-white",
  A: "bg-tier-a text-white",
  B: "bg-tier-b text-white",
  C: "bg-tier-c text-white",
  D: "bg-tier-d text-white",
};
const SIZE = { sm: "h-6 w-6 text-xs", md: "h-8 w-8 text-sm", lg: "h-12 w-12 text-xl", xl: "h-16 w-16 text-3xl" };

export function TierBadge({ tier, size = "md", className }: { tier: Tier | null | undefined; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-extrabold leading-none shadow-sm tabular", SIZE[size], tier ? CLS[tier] : "bg-muted text-muted-foreground", className)}
      aria-label={tier ? `Tier ${tier}` : "Unranked"}
    >
      {tier ?? "?"}
    </span>
  );
}
