import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="text-6xl font-black text-muted-foreground/40">404</div>
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white">RANKING.GG</Link>
    </div>
  );
}
