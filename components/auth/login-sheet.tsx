"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GuestLoginButton, EmailAuthForm } from "./auth-forms";
import { Button } from "@/components/ui/button";

/** 비로그인 상호작용 시 뜨는 로그인 시트 (게스트 1클릭 포함) */
export function LoginSheet({ open, onOpenChange, title }: { open: boolean; onOpenChange: (o: boolean) => void; title?: string }) {
  const t = useTranslations("auth");
  const [showEmail, setShowEmail] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? t("loginToRate")}</DialogTitle>
          <DialogDescription>{t("loginSheetDesc")}</DialogDescription>
        </DialogHeader>
        <GuestLoginButton size="lg" className="w-full bg-[#5383e8] hover:bg-[#4a75d0]" onDone={() => onOpenChange(false)} />
        <p className="text-center text-xs text-muted-foreground">{t("guestDesc")}</p>
        {showEmail ? (
          <EmailAuthForm mode="login" onDone={() => onOpenChange(false)} />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowEmail(true)}>
            {t("loginBtn")} / {t("signupBtn")}
          </Button>
        )}
        <Link href="/login" className="text-center text-xs text-muted-foreground underline" onClick={() => onOpenChange(false)}>
          {t("toSignup")}
        </Link>
      </DialogContent>
    </Dialog>
  );
}
