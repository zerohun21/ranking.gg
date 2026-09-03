import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "xl" }) {
  return (
    <Link href="/" className={cn("inline-flex items-baseline font-extrabold tracking-tight select-none", size === "xl" ? "text-5xl sm:text-6xl" : "text-xl", className)}>
      <span className="text-header-foreground">RANKING</span>
      <span className="text-[#00d5ff]">.GG</span>
    </Link>
  );
}
