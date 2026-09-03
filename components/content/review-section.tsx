"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Flag, Trash2, MessageSquare, Pencil, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Stars } from "@/components/ranking/stars";
import { LoginSheet } from "@/components/auth/login-sheet";
import { CommentThread } from "./comment-thread";
import { createReview, deleteReview, updateReview } from "@/app/actions/review";
import { toggleReaction } from "@/app/actions/reaction";
import { reportTarget } from "@/app/actions/report";
import { relativeTime } from "@/lib/format";
import type { ReviewRow, ReviewSort } from "@/lib/db/queries/content";
import { cn } from "@/lib/utils";

type Viewer = { id: string; isAdmin: boolean; nickname: string } | null;

export function ReviewSection({ contentId, initial, viewer, myRating, myReview }: { contentId: number; initial: ReviewRow[]; viewer: Viewer; myRating: number | null; myReview: ReviewRow | null }) {
  const t = useTranslations("content");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [sort, setSort] = useState<ReviewSort>("best");
  const [rows, setRows] = useState<ReviewRow[]>(initial);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(initial.length < 10);
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState(false);
  const [body, setBody] = useState(myReview?.body ?? "");
  const [spoiler, setSpoiler] = useState(myReview?.isSpoiler ?? false);
  const [editing, setEditing] = useState(!myReview);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [openThreads, setOpenThreads] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  const load = async (s: ReviewSort, p: number, replace: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/reviews?contentId=${contentId}&sort=${s}&page=${p}`);
    const data: ReviewRow[] = res.ok ? await res.json() : [];
    setRows((r) => (replace ? data : [...r, ...data.filter((d) => !r.some((x) => x.id === d.id))]));
    setDone(data.length < 10);
    setLoading(false);
  };
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !loading) {
        const np = page + 1;
        setPage(np);
        load(sort, np, false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, done, loading, sort]);

  const changeSort = (s: ReviewSort) => {
    setSort(s);
    setPage(1);
    load(s, 1, true);
  };

  const submit = () => {
    if (!viewer) return setLogin(true);
    if (!myRating) return toast.error(t("reviewNeedsRating"));
    start(async () => {
      const res = myReview && !editing ? { ok: true as const } : myReview ? await updateReview({ reviewId: myReview.id, body, isSpoiler: spoiler }) : await createReview({ contentId, body, isSpoiler: spoiler });
      if (!res.ok) {
        toast.error(res.error === "reviewNeedsRating" ? t("reviewNeedsRating") : tc(res.error === "rateLimited" ? "rateLimited" : res.error === "invalid" ? "error" : "error"));
        return;
      }
      toast.success(t("reviewPosted"));
      setEditing(false);
      router.refresh();
      load(sort, 1, true);
    });
  };
  const remove = (r: ReviewRow) =>
    start(async () => {
      const res = await deleteReview(r.id);
      if (!res.ok) return;
      toast(t("reviewDeleted"));
      setRows((x) => x.filter((y) => y.id !== r.id));
      if (r.id === myReview?.id) {
        setBody("");
        setEditing(true);
        router.refresh();
      }
    });
  const react = (r: ReviewRow, kind: "like" | "dislike") => {
    if (!viewer) return setLogin(true);
    start(async () => {
      const res = await toggleReaction({ targetType: "review", targetId: r.id, kind });
      if (res.ok) setRows((x) => x.map((y) => (y.id === r.id ? { ...y, likeCount: res.data!.likeCount, dislikeCount: res.data!.dislikeCount, myReaction: res.data!.mine } : y)));
    });
  };
  const report = (r: ReviewRow) => {
    if (!viewer) return setLogin(true);
    start(async () => {
      const res = await reportTarget({ targetType: "review", targetId: r.id, reason: "inappropriate" });
      if (res.ok) toast.success(t(res.data?.duplicate ? "alreadyReported" : "reported"));
    });
  };

  const SORTS: ReviewSort[] = ["best", "newest", "high", "low"];
  const sortLabel: Record<ReviewSort, string> = { best: t("sortBest"), newest: t("sortNewest"), high: t("sortHigh"), low: t("sortLow") };

  return (
    <section className="space-y-3">
      {/* 작성 폼 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">{myReview && !editing ? tc("you") + " · " + tc("reviews") : t("writeReview")}</h3>
          {myRating ? <Stars value={myRating} size={14} /> : <span className="text-xs text-muted-foreground">{t("reviewNeedsRating")}</span>}
        </div>
        {myReview && !editing ? (
          <div className="text-sm">
            <p className="whitespace-pre-wrap">{myReview.body}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> {tc("edit")}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs text-lose" onClick={() => remove(myReview)}>
                <Trash2 className="mr-1 h-3 w-3" /> {tc("delete")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("reviewPlaceholder")} rows={3} maxLength={2000} className="text-sm" onFocus={() => !viewer && setLogin(true)} />
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-xs font-normal">
                <Checkbox checked={spoiler} onCheckedChange={(v) => setSpoiler(!!v)} /> {t("spoilerCheck")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular">{body.trim().length}/2000</span>
                {myReview && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(false)}>
                    {tc("cancel")}
                  </Button>
                )}
                <Button size="sm" className="h-8" onClick={submit} disabled={pending || body.trim().length < 10}>
                  {tc("submit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 정렬 */}
      <div className="flex items-center gap-1">
        <h3 className="mr-auto text-sm font-bold">{tc("reviews")}</h3>
        {SORTS.map((s) => (
          <button key={s} type="button" onClick={() => changeSort(s)} className={cn("rounded-md px-2 py-1 text-xs font-semibold", sort === s ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent")}>
            {sortLabel[s]}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const hidden = r.isSpoiler && !revealed.has(r.id);
          return (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={r.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">{r.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <Link href={`/u/${encodeURIComponent(r.nickname)}`} className="font-semibold text-foreground hover:underline">{r.nickname}</Link>
                {r.score && <Stars value={Number(r.score)} size={12} />}
                {r.isSpoiler && <span className="inline-flex items-center gap-0.5 rounded bg-lose/15 px-1 text-[10px] font-semibold text-lose"><EyeOff className="h-3 w-3" /> {tc("spoiler")}</span>}
                <span className="ml-auto" suppressHydrationWarning>{relativeTime(r.createdAt, locale)}</span>
              </div>
              <div className="relative mt-2">
                <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", hidden && "select-none blur-sm")}>{r.body}</p>
                {hidden && (
                  <button type="button" onClick={() => setRevealed((s) => new Set(s).add(r.id))} className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                    <span className="rounded-md bg-card/90 px-3 py-1.5 shadow">{tc("showSpoiler")}</span>
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <button type="button" onClick={() => react(r, "like")} className={cn("inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent", r.myReaction === "like" && "text-win font-bold")}>
                  <ThumbsUp className="h-3.5 w-3.5" /> {r.likeCount}
                </button>
                <button type="button" onClick={() => react(r, "dislike")} className={cn("inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent", r.myReaction === "dislike" && "text-lose font-bold")}>
                  <ThumbsDown className="h-3.5 w-3.5" /> {r.dislikeCount}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenThreads((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                  className={cn("inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent", openThreads.has(r.id) && "text-primary")}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> {openThreads.has(r.id) ? tc("hideReplies") : tc("replies", { count: r.commentCount })}
                </button>
                <button type="button" onClick={() => report(r)} className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent" aria-label={tc("report")}>
                  <Flag className="h-3.5 w-3.5" />
                </button>
                {(viewer?.id === r.userId || viewer?.isAdmin) && (
                  <button type="button" onClick={() => remove(r)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent hover:text-lose" aria-label={tc("delete")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {openThreads.has(r.id) && (
                <div className="mt-3 border-t border-border pt-2">
                  <CommentThread targetType="review" targetId={r.id} viewer={viewer} compact />
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("noReviews")}</li>}
      </ul>
      {!done && <div ref={sentinel} className="py-4 text-center text-xs text-muted-foreground">{loading ? tc("loading") : ""}</div>}
      <LoginSheet open={login} onOpenChange={setLogin} />
    </section>
  );
}
