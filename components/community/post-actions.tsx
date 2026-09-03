"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Flag, Trash2 } from "lucide-react";
import { toggleReaction } from "@/app/actions/reaction";
import { reportTarget } from "@/app/actions/report";
import { deletePost } from "@/app/actions/post";
import { LoginSheet } from "@/components/auth/login-sheet";
import { cn } from "@/lib/utils";

export function PostActions({ postId, likeCount, dislikeCount, myReaction, canDelete, categorySlug }: { postId: number; likeCount: number; dislikeCount: number; myReaction: "like" | "dislike" | null; canDelete: boolean; categorySlug: string }) {
  const tc = useTranslations("common");
  const t = useTranslations("content");
  const tm = useTranslations("community");
  const router = useRouter();
  const [state, setState] = useState({ likeCount, dislikeCount, mine: myReaction });
  const [login, setLogin] = useState(false);
  const [pending, start] = useTransition();
  const react = (kind: "like" | "dislike") =>
    start(async () => {
      const res = await toggleReaction({ targetType: "post", targetId: postId, kind });
      if (!res.ok) return setLogin(true);
      setState(res.data!);
    });
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button type="button" onClick={() => react("like")} disabled={pending} className={cn("inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-bold", state.mine === "like" ? "border-win bg-win/10 text-win" : "border-border")}>
        <ThumbsUp className="h-4 w-4" /> {state.likeCount}
      </button>
      <button type="button" onClick={() => react("dislike")} disabled={pending} className={cn("inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-bold", state.mine === "dislike" ? "border-lose bg-lose/10 text-lose" : "border-border")}>
        <ThumbsDown className="h-4 w-4" /> {state.dislikeCount}
      </button>
      <button
        type="button"
        onClick={() => start(async () => { const r = await reportTarget({ targetType: "post", targetId: postId, reason: "inappropriate" }); if (!r.ok) return setLogin(true); toast.success(t(r.data?.duplicate ? "alreadyReported" : "reported")); })}
        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
      >
        <Flag className="h-3.5 w-3.5" /> {tc("report")}
      </button>
      {canDelete && (
        <button type="button" onClick={() => start(async () => { const r = await deletePost(postId); if (r.ok) { toast(tm("deleted")); router.push(`/community/${categorySlug}`); } })} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-lose">
          <Trash2 className="h-3.5 w-3.5" /> {tc("delete")}
        </button>
      )}
      <LoginSheet open={login} onOpenChange={setLogin} />
    </div>
  );
}
