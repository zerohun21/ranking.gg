"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCategory, addCategoryItem, deleteCategoryItem, uploadItemImage } from "@/app/actions/category";

const EMOJIS = ["🏆", "🍜", "🍗", "💻", "☕", "🍺", "🎧", "📱", "🚗", "👟", "🏀", "🎤", "🧋", "🍕", "📷", "✈️"];
const COLORS = ["#5383e8", "#e84057", "#00bba3", "#ff8a3d", "#ff4e50", "#9b59b6", "#00d564", "#ffb400"];

export function CreateCategoryForm() {
  const t = useTranslations("create");
  const tc = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon: "🏆", color: "#5383e8" });
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={30} />
        </div>
        <div className="space-y-1">
          <Label>{t("slug")}</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={40} placeholder="my-ranking" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>{t("description")}</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("icon")}</Label>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setForm({ ...form, icon: e })} className={`h-8 w-8 rounded-md border text-lg ${form.icon === e ? "border-primary bg-primary/10" : "border-border"}`}>{e}</button>
            ))}
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value.slice(0, 4) })} className="h-8 w-14 text-center" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>{t("color")}</Label>
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`h-8 w-8 rounded-md border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
      <Button
        className="w-full"
        disabled={pending || form.name.trim().length < 2 || form.slug.length < 2}
        onClick={() =>
          start(async () => {
            const res = await createCategory(form);
            if (!res.ok) {
              toast.error(res.code === "GUEST" ? tc("guestCannotPost") : res.error === "slugTaken" ? "이미 사용 중인 슬러그" : tc("error"));
              return;
            }
            toast.success(t("created"));
            router.push(`/create?category=${res.data!.slug}`);
            router.refresh();
          })
        }
      >
        <Plus className="mr-1 h-4 w-4" /> {t("title")}
      </Button>
    </div>
  );
}

export function AddItemForm({ categorySlug }: { categorySlug: string }) {
  const t = useTranslations("create");
  const tc = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "", link: "" });
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-bold">{t("addItem")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("itemTitle")} maxLength={100} />
        <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder={t("itemLink") + " (https://)"} />
      </div>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("itemDesc")} rows={2} maxLength={500} />
      <div className="flex gap-2">
        <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder={t("itemImage") + " (https://)"} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("file", f);
            start(async () => {
              const res = await uploadItemImage(fd);
              if (res.ok) setForm((x) => ({ ...x, imageUrl: res.data!.url }));
              else toast.error(tc("error"));
            });
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
          <Upload className="mr-1 h-4 w-4" /> {t("itemImageUpload")}
        </Button>
      </div>
      <Button
        className="w-full"
        disabled={pending || !form.title.trim()}
        onClick={() =>
          start(async () => {
            const res = await addCategoryItem({ categorySlug, ...form });
            if (!res.ok) {
              toast.error(tc("error"));
              return;
            }
            toast.success(t("itemAdded"));
            setForm({ title: "", description: "", imageUrl: "", link: "" });
            router.refresh();
          })
        }
      >
        <Plus className="mr-1 h-4 w-4" /> {t("addItem")}
      </Button>
    </div>
  );
}

export function DeleteItemButton({ categorySlug, contentId }: { categorySlug: string; contentId: number }) {
  const t = useTranslations("create");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-lose"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteCategoryItem({ categorySlug, contentId });
          if (res.ok) {
            toast(t("itemDeleted"));
            router.refresh();
          }
        })
      }
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
