"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Swords, MessageSquare } from "lucide-react";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { LoginSheet } from "@/components/auth/login-sheet";
import { voteBattle } from "@/app/actions/battle";
import { contentHref, formatScore } from "@/lib/format";
import type { BattleCard as BattleCardT } from "@/lib/db/queries/home";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/db/schema";

export function BattleCard({ battle, loggedIn, size = "md", onVoted, showComments = true }: { battle: BattleCardT; loggedIn: boolean; size?: "md" | "lg"; onVoted?: (choice: "a" | "b") => void; showComments?: boolean }) {
  const t = useTranslations("battle");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [votes, setVotes] = useState({ a: battle.votesA, b: battle.votesB });
  const [choice, setChoice] = useState<"a" | "b" | null>(battle.myChoice ?? null);
  const [login, setLogin] = useState(false);
  const [pending, start] = useTransition();
  const total = votes.a + votes.b;
  const pa = total ? Math.round((votes.a / total) * 100) : 50;

  const vote = (c: "a" | "b") => {
    if (choice) return;
    if (!loggedIn) {
      // 비로그인: 로컬 미리보기만
      setChoice(c);
      setVotes((v) => ({ ...v, [c]: v[c] + 1 }));
      toast(t("previewOnly"));
      onVoted?.(c);
      return;
    }
    start(async () => {
      const res = await voteBattle({ battleId: battle.id, choice: c });
      if (!res.ok) {
        toast.error(tc(res.error === "rateLimited" ? "rateLimited" : "error"));
        return;
      }
      setVotes({ a: res.data!.votesA, b: res.data!.votesB });
      setChoice(res.data!.choice);
      onVoted?.(res.data!.choice);
    });
  };

  const Side = ({ side, item }: { side: "a" | "b"; item: BattleCardT["a"] }) => {
    const pct = side === "a" ? pa : 100 - pa;
    const won = choice && pct >= 50;
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 overflow-hidden rounded-lg border-2 p-3 transition-all", choice === side ? (side === "a" ? "border-win bg-win/10" : "border-lose bg-lose/10") : "border-transparent", !choice && "cursor-pointer hover:bg-accent/60")} onClick={() => vote(side)} role="button" aria-pressed={choice === side}>
        <Poster src={item.posterUrl} alt={item.title} size="lg" className={cn("shrink-0 ring-1 ring-black/10", size === "lg" ? "h-[200px] w-[150px] sm:h-[240px] sm:w-[180px]" : "h-[150px] w-[112px]")} sizes="180px" />
        <div className="w-full text-center">
          <div className={cn("line-clamp-1 font-bold", size === "lg" ? "text-base" : "text-sm")}>{item.title}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <TierBadge tier={item.tier as Tier | null} size="sm" />
            <span>#{item.rank ?? "–"}</span>
            <span className="tabular">{formatScore(item.score)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground tabular">{t("record", { wins: item.wins, losses: item.losses })} · ELO {Math.round(item.elo)}</div>
        </div>
        {choice ? (
          <div className={cn("text-2xl font-black tabular", won ? (side === "a" ? "text-win" : "text-lose") : "text-muted-foreground")}>{pct}%</div>
        ) : (
          <span className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-white">{t("pick")}</span>
        )}
      </div>
    );
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", pending && "opacity-70")}>
      <div className="relative flex items-stretch gap-2">
        <Side side="a" item={battle.a} />
        <div className="flex flex-col items-center justify-center">
          <span className="rounded-full bg-header px-2 py-1 text-xs font-black text-white">{t("vs")}</span>
          <Swords className="mt-1 h-4 w-4 text-muted-foreground" />
        </div>
        <Side side="b" item={battle.b} />
      </div>
      {/* 결과 바 */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          <div className="h-full bg-win transition-all duration-700" style={{ width: `${choice ? pa : 50}%` }} />
          <div className="h-full bg-lose transition-all duration-700" style={{ width: `${choice ? 100 - pa : 50}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular">{total.toLocaleString(locale === "en" ? "en-US" : "ko-KR")} {tc("votes")}</span>
        <div className="flex items-center gap-3">
          <Link href={contentHref(battle.categorySlug, battle.a.slug)} className="hover:underline">{battle.a.title.slice(0, 12)}</Link>
          <Link href={contentHref(battle.categorySlug, battle.b.slug)} className="hover:underline">{battle.b.title.slice(0, 12)}</Link>
          {showComments && (
            <Link href={`/battle/${battle.id}`} className="inline-flex items-center gap-1 hover:underline">
              <MessageSquare className="h-3 w-3" /> {tc("comments")}
            </Link>
          )}
        </div>
      </div>
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
