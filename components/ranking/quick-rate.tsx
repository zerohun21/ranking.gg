"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StarInput } from "./star-input";
import { LoginSheet } from "@/components/auth/login-sheet";
import { rateContent, deleteRating } from "@/app/actions/rating";
import { cn } from "@/lib/utils";

export function QuickRate({ contentId, title, loggedIn, initial, className }: { contentId: number; title: string; loggedIn: boolean; initial?: number | null; className?: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [value, setValue] = useState<number | null>(initial ?? null);
  const [pending, start] = useTransition();

  const onChange = (v: number) => {
    if (!loggedIn) return setLogin(true);
    start(async () => {
      const res = v === 0 ? await deleteRating(contentId) : await rateContent({ contentId, score: v });
      if (!res.ok) {
            toast.error(t(`common.${res.error === "rateLimited" ? "rateLimited" : res.error === "loginRequired" ? "loginRequired" : "error"}`));
            return;
          }
      setValue(v || null);
      const d = res.data!;
      if (v === 0) toast(t("content.ratingRemoved"));
      else if (d.rank && d.prevRank && d.rank !== d.prevRank) {
        const delta = d.prevRank - d.rank;
        toast.success(t("content.rankChanged", { rank: d.rank, dir: delta > 0 ? t("content.up") : t("content.down"), delta: `${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}` }));
      } else toast.success(t("content.rated", { score: v.toFixed(1) }));
      setOpen(false);
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn("inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary", value && "border-[#ffb400]/50 text-[#ffb400]", className)}
          onClick={(e) => {
            e.stopPropagation();
            if (!loggedIn) {
              e.preventDefault();
              setLogin(true);
            }
          }}
        >
          <Star className={cn("h-3.5 w-3.5", value && "fill-[#ffb400]")} /> {value ? value.toFixed(1) : t("ranking.quickRate")}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1 max-w-[220px] truncate text-xs font-semibold">{title}</div>
          <StarInput value={value} onChange={onChange} disabled={pending} />
        </PopoverContent>
      </Popover>
      <LoginSheet open={login} onOpenChange={setLogin} />
    </>
  );
}
