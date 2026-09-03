"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-sm text-muted-foreground">{t("error")}</p>
      <Button onClick={reset}>{t("confirm")}</Button>
    </div>
  );
}
