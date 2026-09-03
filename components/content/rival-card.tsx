"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { Poster } from "./poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { LoginSheet } from "@/components/auth/login-sheet";
import { createBattle, voteBattle } from "@/app/actions/battle";
import { contentHref, formatScore } from "@/lib/format";
import type { RivalRow } from "@/lib/db/queries/content";
import { cn } from "@/lib/utils";

type Me = { id: number; title: string; slug: string; posterUrl: string | null; rank: number | null; tier: RivalRow["tier"]; bayesianScore: string; ratingCount: number; eloWins: number; eloLosses: number };

export function RivalCard({ me, rival, categorySlug, loggedIn, label }: { me: Me; rival: RivalRow; categorySlug: string; loggedIn: boolean; label: string }) {
  const t = useTranslations("content");
  const tb = useTranslations("battle");
  const [login, setLogin] = useState(false);
  const [voted, setVoted] = useState<"me" | "rival" | null>(null);
  const [pending, start] = useTransition();

  const vote = (side: "me" | "rival") => {
    if (!loggedIn) return setLogin(true);
    start(async () => {
      const cb = await createBattle({ contentAId: me.id, contentBId: rival.id });
      if (!cb.ok) {
        toast.error("error");
        return;
      }
      const aIsMe = Math.min(me.id, rival.id) === me.id;
      const choice: "a" | "b" = (side === "me") === aIsMe ? "a" : "b";
      const res = await voteBattle({ battleId: cb.data!.id, choice });
      if (res.ok) {
        setVoted(side);
        toast.success(tb("voted"));
      }
    });
  };

  const Col = ({ c, side }: { c: Me | RivalRow; side: "me" | "rival" }) => (
    <div className={cn("flex flex-1 flex-col items-center gap-1 rounded-md p-2 text-center", voted === side && "bg-primary/10 ring-1 ring-primary")}>
      <Link href={contentHref(categorySlug, c.slug)}>
        <Poster src={c.posterUrl} alt={c.title} size="md" />
      </Link>
      <div className="line-clamp-1 w-full text-xs font-bold">{c.title}</div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <TierBadge tier={c.tier} size="sm" /> #{c.rank ?? "–"}
      </div>
      <div className="text-sm font-extrabold tabular">{formatScore(c.bayesianScore)}</div>
      <div className="text-[10px] text-muted-foreground tabular">{c.ratingCount.toLocaleString()} · {t("battleRecord", { wins: c.eloWins, losses: c.eloLosses })}</div>
      <button type="button" disabled={pending || !!voted} onClick={() => vote(side)} className={cn("mt-1 w-full rounded-md py-1 text-xs font-bold text-white", side === "me" ? "bg-win" : "bg-lose", (pending || voted) && "opacity-60")}>
        {voted === side ? tb("voted") : tb("pick")}
      </button>
    </div>
  );

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold">{label}</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground"><Swords className="h-3 w-3" /> {t("rivalQuestion")}</span>
      </div>
      <div className="flex items-stretch gap-2">
        <Col c={me} side="me" />
        <div className="flex items-center text-xs font-black text-muted-foreground">VS</div>
        <Col c={rival} side="rival" />
      </div>
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
