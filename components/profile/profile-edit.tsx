"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/actions/profile";

export function ProfileEdit({ nickname, bio, avatarUrl }: { nickname: string; bio: string | null; avatarUrl: string | null }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nickname, bio: bio ?? "", avatarUrl: avatarUrl ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:border-primary">
        <Pencil className="h-3 w-3" /> {t("edit")}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("nickname")}</Label>
            <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} maxLength={20} />
          </div>
          <div className="space-y-1">
            <Label>{t("bio")}</Label>
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={200} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>{t("avatarUrl")}</Label>
            <Input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="https://" />
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateProfile(form);
                if (!res.ok) {
                  toast.error(res.error === "nicknameTaken" ? "이미 사용 중인 닉네임" : tc("error"));
                  return;
                }
                toast.success(t("saved"));
                setOpen(false);
                router.push(`/u/${encodeURIComponent(res.data!.nickname)}`);
                router.refresh();
              })
            }
          >
            {tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
