"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Flame } from "lucide-react";
import { BattleCard } from "./battle-card";
import { Button } from "@/components/ui/button";
import type { BattleCard as BattleCardT } from "@/lib/db/queries/home";

/** 연속 대결: 카드 하나 → 투표 → "다음 대결" → 큐 소진 시 API 로 리필 */
export function BattleArena({ initial, loggedIn, categorySlug }: { initial: BattleCardT[]; loggedIn: boolean; categorySlug?: string }) {
  const t = useTranslations("battle");
  const [queue, setQueue] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [voted, setVoted] = useState(false);
  const [seen, setSeen] = useState<number[]>(initial.map((b) => b.id));
  const current = queue[idx];

  const next = async () => {
    setVoted(false);
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      return;
    }
    const res = await fetch(`/api/battles?random=1&n=5${categorySlug ? `&category=${categorySlug}` : ""}&exclude=${seen.slice(-30).join(",")}`);
    const more: BattleCardT[] = res.ok ? await res.json() : [];
    if (!more.length) {
      setIdx(0);
      return;
    }
    setQueue((q) => [...q, ...more]);
    setSeen((s) => [...s, ...more.map((b) => b.id)]);
    setIdx(idx + 1);
  };

  if (!current) return <p className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t("noBattles")}</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold">
          {streak > 0 && <Flame className="h-3.5 w-3.5 text-tier-s" />}
          {streak > 0 ? t("streak", { n: streak }) : t("sub")}
        </span>
        <span className="tabular">{idx + 1} / {queue.length}</span>
      </div>
      <BattleCard
        key={current.id}
        battle={current}
        loggedIn={loggedIn}
        size="lg"
        onVoted={() => {
          setVoted(true);
          setStreak((s) => s + 1);
        }}
      />
      <div className="flex justify-center">
        <Button size="lg" onClick={next} className={voted ? "animate-pulse bg-primary hover:bg-primary/90" : ""} variant={voted ? "default" : "outline"}>
          {t("next")} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
