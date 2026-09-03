"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** 헤더 검색창 (자동완성은 이후 단계에서 CommandPalette 로 확장) */
export function SearchBox({ placeholder, className, size = "md" }: { placeholder: string; className?: string; size?: "md" | "xl" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", size === "xl" ? "h-5 w-5" : "h-4 w-4")} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-border bg-card text-card-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary",
          size === "xl" ? "h-14 pl-11 pr-4 text-base shadow-lg" : "h-9 pl-9 pr-3 text-sm",
        )}
      />
    </form>
  );
}
