"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Flag, Trash2, CornerDownRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoginSheet } from "@/components/auth/login-sheet";
import { createComment, deleteComment } from "@/app/actions/comment";
import { toggleReaction } from "@/app/actions/reaction";
import { reportTarget } from "@/app/actions/report";
import { relativeTime } from "@/lib/format";
import type { CommentRow } from "@/lib/db/queries/content";
import { cn } from "@/lib/utils";

type Props = { targetType: "content" | "review" | "post" | "battle"; targetId: number; viewer: { id: string; isAdmin: boolean } | null; initial?: CommentRow[]; autoLoad?: boolean; compact?: boolean };

export function CommentThread({ targetType, targetId, viewer, initial, autoLoad = true, compact }: Props) {
  const t = useTranslations("common");
  const tc = useTranslations("content");
  const locale = useLocale();
  const [rows, setRows] = useState<CommentRow[]>(initial ?? []);
  const [loaded, setLoaded] = useState(!!initial);
  const [login, setLogin] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (loaded || !autoLoad) return;
    fetch(`/api/comments?targetType=${targetType}&targetId=${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [loaded, autoLoad, targetType, targetId]);

  const submit = (parentId: number | null) => {
    if (!viewer) return setLogin(true);
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await createComment({ targetType, targetId, parentId, body: text });
      if (!res.ok) {
        toast.error(t(res.error === "rateLimited" ? "rateLimited" : "error"));
        return;
      }
      const d = res.data!;
      setRows((r) => [...r, { id: d.id, parentId: d.parentId, body: d.body, likeCount: 0, dislikeCount: 0, createdAt: new Date(d.createdAt), userId: d.userId, nickname: d.nickname, avatarUrl: d.avatarUrl, isSeed: false, isHidden: false, myReaction: null }]);
      setBody("");
      setReplyTo(null);
    });
  };
  const react = (c: CommentRow, kind: "like" | "dislike") => {
    if (!viewer) return setLogin(true);
    start(async () => {
      const res = await toggleReaction({ targetType: "comment", targetId: c.id, kind });
      if (res.ok) setRows((r) => r.map((x) => (x.id === c.id ? { ...x, likeCount: res.data!.likeCount, dislikeCount: res.data!.dislikeCount, myReaction: res.data!.mine } : x)));
    });
  };
  const report = (c: CommentRow) => {
    if (!viewer) return setLogin(true);
    start(async () => {
      const res = await reportTarget({ targetType: "comment", targetId: c.id, reason: "inappropriate" });
      if (res.ok) toast.success(tc(res.data?.duplicate ? "alreadyReported" : "reported"));
    });
  };
  const remove = (c: CommentRow) => {
    start(async () => {
      const res = await deleteComment(c.id);
      if (res.ok) setRows((r) => r.filter((x) => x.id !== c.id && x.parentId !== c.id));
    });
  };

  const roots = rows.filter((r) => !r.parentId);
  const children = (id: number) => rows.filter((r) => r.parentId === id);

  const Item = ({ c, depth }: { c: CommentRow; depth: number }) => (
    <li className={cn("py-2", depth > 0 && "ml-8 border-l-2 border-border pl-3")}>
      <div className="flex items-start gap-2">
        {depth > 0 && <CornerDownRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />}
        <Avatar className="h-6 w-6">
          <AvatarImage src={c.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px]">{c.nickname.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link href={`/u/${encodeURIComponent(c.nickname)}`} className="font-semibold text-foreground hover:underline">{c.nickname}</Link>
            {viewer?.id === c.userId && <span className="rounded bg-primary/15 px-1 text-[10px] text-primary">{t("you")}</span>}
            <span suppressHydrationWarning>{relativeTime(c.createdAt, locale)}</span>
          </div>
          <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-sm", c.isHidden && "italic text-muted-foreground")}>{c.isHidden ? "(숨겨진 댓글)" : c.body}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <button type="button" onClick={() => react(c, "like")} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent", c.myReaction === "like" && "text-win")}>
              <ThumbsUp className="h-3 w-3" /> {c.likeCount}
            </button>
            <button type="button" onClick={() => react(c, "dislike")} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent", c.myReaction === "dislike" && "text-lose")}>
              <ThumbsDown className="h-3 w-3" /> {c.dislikeCount}
            </button>
            {depth === 0 && (
              <button type="button" onClick={() => (viewer ? setReplyTo(replyTo === c.id ? null : c.id) : setLogin(true))} className="rounded px-1.5 py-0.5 hover:bg-accent">
                {t("reply")}
              </button>
            )}
            <button type="button" onClick={() => report(c)} className="rounded px-1.5 py-0.5 hover:bg-accent" aria-label={t("report")}>
              <Flag className="h-3 w-3" />
            </button>
            {(viewer?.id === c.userId || viewer?.isAdmin) && (
              <button type="button" onClick={() => remove(c)} className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-lose" aria-label={t("delete")}>
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div className="mt-2 flex gap-2">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t("writeComment")} className="min-h-0 text-sm" maxLength={1000} />
              <Button size="sm" onClick={() => submit(c.id)} disabled={pending || !body.trim()}>
                {t("submit")}
              </Button>
            </div>
          )}
        </div>
      </div>
      {children(c.id).length > 0 && (
        <ul>
          {children(c.id).map((cc) => (
            <Item key={cc.id} c={cc} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <div className={cn(!compact && "rounded-lg border border-border bg-card p-4")}>
      {!compact && <h3 className="mb-2 text-sm font-bold">{t("comments")} <span className="text-muted-foreground tabular">{rows.length}</span></h3>}
      <ul className="divide-y divide-border">
        {roots.map((c) => (
          <Item key={c.id} c={c} depth={0} />
        ))}
        {loaded && roots.length === 0 && <li className="py-3 text-xs text-muted-foreground">{t("empty")}</li>}
      </ul>
      {replyTo === null && (
        <div className="mt-3 flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={viewer ? t("writeComment") : t("loginRequired")} className="min-h-0 text-sm" maxLength={1000} onFocus={() => !viewer && setLogin(true)} />
          <Button size="sm" onClick={() => submit(null)} disabled={pending || !body.trim()}>
            {t("submit")}
          </Button>
        </div>
      )}
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
