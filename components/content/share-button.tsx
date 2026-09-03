"use client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("common");
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {}
        }
        await navigator.clipboard.writeText(url);
        toast.success(t("copied"));
      }}
    >
      <Share2 className="mr-1 h-3.5 w-3.5" /> {t("share")}
    </Button>
  );
}
