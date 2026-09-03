"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { useSearchHits } from "@/components/search/command-palette";
import { Poster } from "@/components/content/poster";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoginSheet } from "@/components/auth/login-sheet";
import { createBattle } from "@/app/actions/battle";
import type { SearchHit } from "@/lib/db/queries/search";

function Picker({ label, value, onPick, categoryId }: { label: string; value: SearchHit | null; onPick: (h: SearchHit | null) => void; categoryId?: number }) {
  const [q, setQ] = useState("");
  const { hits } = useSearchHits(q);
  const filtered = categoryId ? hits.filter((h) => h.categoryId === categoryId) : hits;
  return (
    <div className="flex-1 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border p-2">
          <Poster src={value.posterUrl} alt={value.title} size="xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{value.title}</div>
            <div className="text-[11px] text-muted-foreground">{value.categoryIcon} {value.categoryName}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onPick(null)}>✕</Button>
        </div>
      ) : (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색…" className="h-9 text-sm" />
          {q && filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
              {filtered.slice(0, 8).map((h) => (
                <li key={h.id}>
                  <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { onPick(h); setQ(""); }}>
                    <Poster src={h.posterUrl} alt={h.title} size="xs" className="h-8 w-6" />
                    <span className="truncate">{h.title}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{h.categoryIcon}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CreateBattleForm({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations("battle");
  const router = useRouter();
  const [a, setA] = useState<SearchHit | null>(null);
  const [b, setB] = useState<SearchHit | null>(null);
  const [login, setLogin] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 text-sm font-bold">{t("create")}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{t("createDesc")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Picker label={t("pickA")} value={a} onPick={setA} />
        <div className="hidden pt-8 text-xs font-black text-muted-foreground sm:block">VS</div>
        <Picker label={t("pickB")} value={b} onPick={setB} categoryId={a?.categoryId} />
      </div>
      <Button
        className="mt-3 w-full"
        disabled={!a || !b || a.id === b.id || pending}
        onClick={() => {
          if (!loggedIn) return setLogin(true);
          start(async () => {
            const res = await createBattle({ contentAId: a!.id, contentBId: b!.id });
            if (!res.ok) {
              toast.error("error");
              return;
            }
            toast.success(t("created"));
            router.push(`/battle/${res.data!.id}`);
          });
        }}
      >
        <Swords className="mr-1 h-4 w-4" /> {t("create")}
      </Button>
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
