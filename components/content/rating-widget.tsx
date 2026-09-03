"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { StarInput } from "@/components/ranking/star-input";
import { LoginSheet } from "@/components/auth/login-sheet";
import { Button } from "@/components/ui/button";
import { rateContent, deleteRating } from "@/app/actions/rating";

export function RatingWidget({ contentId, initial, loggedIn }: { contentId: number; initial: number | null; loggedIn: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState<number | null>(initial);
  const [login, setLogin] = useState(false);
  const [pending, start] = useTransition();

  const apply = (v: number) => {
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
        toast.success(t("content.rankChanged", { rank: d.rank, dir: delta > 0 ? t("content.up") : t("content.down"), delta: `${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}` }), { duration: 5000 });
      } else toast.success(t("content.rated", { score: v.toFixed(1) }));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm font-bold">{value ? t("content.yourRating") : t("content.rate")}</span>
      <StarInput value={value} onChange={apply} size={32} disabled={pending} />
      {value && (
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => apply(0)} disabled={pending}>
          <Trash2 className="mr-1 h-3 w-3" /> {t("common.delete")}
        </Button>
      )}
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
