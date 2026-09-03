"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmailAuthForm, GuestLoginButton } from "./auth-forms";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function LoginTabs({ defaultMode, next, isGuest }: { defaultMode: "login" | "signup"; next?: string; isGuest: boolean }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "signup">(isGuest ? "signup" : defaultMode);
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      {!isGuest && (
        <>
          <GuestLoginButton size="lg" className="w-full bg-[#5383e8] hover:bg-[#4a75d0]" />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> {t("or")} <Separator className="flex-1" />
          </div>
        </>
      )}
      {isGuest && <p className="rounded-md bg-muted p-2 text-xs">{t("guestDesc")}</p>}
      <EmailAuthForm mode={mode} next={next} />
      <Button variant="link" size="sm" className="w-full" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? t("toSignup") : t("toLogin")}
      </Button>
    </div>
  );
}
