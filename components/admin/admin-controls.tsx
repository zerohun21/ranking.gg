"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw, Camera, Eye, EyeOff, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { adminRecompute, adminSnapshot, adminSetHidden, adminDeleteTarget, adminResolveReport, adminSetCategoryApproved, adminUpdateContent } from "@/app/actions/admin";

export function RecomputeButtons() {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => start(async () => { const r = await adminRecompute(); if (r.ok) { toast.success(t("recomputed", { n: r.data!.n })); router.refresh(); } else toast.error(r.error); })}>
        <RefreshCw className={`mr-1 h-4 w-4 ${pending ? "animate-spin" : ""}`} /> {t("recompute")}
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await adminSnapshot(); if (r.ok) { toast.success(t("snapshotted", { n: r.data!.n })); router.refresh(); } else toast.error(r.error); })}>
        <Camera className="mr-1 h-4 w-4" /> {t("snapshot")}
      </Button>
    </div>
  );
}

export function HideToggle({ targetType, targetId, hidden }: { targetType: "review" | "comment" | "post" | "content"; targetId: number; hidden: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => { const r = await adminSetHidden({ targetType, targetId, hidden: !hidden }); if (!r.ok) toast.error(r.error); })}>
      {hidden ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />} {hidden ? t("unhide") : t("hide")}
    </Button>
  );
}

export function DeleteTargetButton({ targetType, targetId }: { targetType: "review" | "comment" | "post"; targetId: number }) {
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs text-lose" disabled={pending} onClick={() => start(async () => { const r = await adminDeleteTarget({ targetType, targetId }); if (!r.ok) toast.error(r.error); })}>
      <Trash2 className="mr-1 h-3 w-3" /> {tc("delete")}
    </Button>
  );
}

export function ReportButtons({ reportId }: { reportId: number }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => { await adminResolveReport({ reportId, status: "resolved" }); })}><Check className="mr-1 h-3 w-3" /> {t("resolve")}</Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => { await adminResolveReport({ reportId, status: "dismissed" }); })}><X className="mr-1 h-3 w-3" /> {t("dismiss")}</Button>
    </div>
  );
}

export function CategoryApproveToggle({ categoryId, approved }: { categoryId: number; approved: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return (
    <Button variant={approved ? "outline" : "default"} size="sm" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => { await adminSetCategoryApproved({ categoryId, approved: !approved }); })}>
      {approved ? t("hide") : t("approve")}
    </Button>
  );
}

export function ContentEditForm({ c }: { c: { id: number; title: string; description: string | null; posterUrl: string | null; isAdult: boolean; isApproved: boolean } }) {
  const tc = useTranslations("common");
  const [form, setForm] = useState({ title: c.title, description: c.description ?? "", posterUrl: c.posterUrl ?? "", isAdult: c.isAdult });
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Input value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} placeholder="poster url" />
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-xs font-normal"><Checkbox checked={form.isAdult} onCheckedChange={(v) => setForm({ ...form, isAdult: !!v })} /> 19+</Label>
        <div className="flex gap-2">
          <HideToggle targetType="content" targetId={c.id} hidden={!c.isApproved} />
          <Button size="sm" className="h-7 text-xs" disabled={pending} onClick={() => start(async () => { const r = await adminUpdateContent({ id: c.id, title: form.title, description: form.description || null, posterUrl: form.posterUrl, isAdult: form.isAdult }); if (r.ok) { toast.success(tc("save")); router.refresh(); } else toast.error(r.error); })}>
            {tc("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
