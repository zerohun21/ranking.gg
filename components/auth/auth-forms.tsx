"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserRound, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GuestLoginButton({ onDone, className, size = "default" }: { onDone?: () => void; className?: string; size?: "default" | "lg" | "sm" }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { error } = await createClient().auth.signInAnonymously();
          if (error) {
            toast.error(error.message);
            return;
          }
          router.refresh();
          onDone?.();
        })
      }
    >
      <UserRound className="mr-1.5 h-4 w-4" /> {pending ? "…" : t("guest")}
    </Button>
  );
}

export function EmailAuthForm({ mode, onDone, next }: { mode: "login" | "signup"; onDone?: () => void; next?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const sb = createClient();
      const { data: me } = await sb.auth.getUser();
      let error: { message: string } | null = null;
      if (mode === "signup") {
        if (me.user?.is_anonymous) {
          // 게스트 → 이메일 전환 (기록 유지)
          const r = await sb.auth.updateUser({ email, password, data: { nickname } });
          error = r.error;
        } else {
          const r = await sb.auth.signUp({ email, password, options: { data: { nickname } } });
          error = r.error;
        }
      } else {
        const r = await sb.auth.signInWithPassword({ email, password });
        error = r.error;
      }
      if (error) {
            toast.error(error.message || t("error"));
            return;
          }
      toast.success(t("welcome", { nickname: nickname || email.split("@")[0] }));
      router.refresh();
      if (next) router.push(next);
      onDone?.();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "signup" && (
        <div className="space-y-1">
          <Label htmlFor="nickname">{t("nickname")}</Label>
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required minLength={2} maxLength={20} />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        <Mail className="mr-1.5 h-4 w-4" /> {mode === "signup" ? t("signupBtn") : t("loginBtn")}
      </Button>
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/")}` } })}
        >
          {t("google")}
        </Button>
      )}
    </form>
  );
}
