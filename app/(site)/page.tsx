import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/search/search-box";

export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="space-y-10">
      <section className="flex flex-col items-center gap-5 py-10 text-center">
        <Logo size="xl" className="text-foreground [&>span:first-child]:text-foreground" />
        <p className="text-sm text-muted-foreground">{t("home.heroSub")}</p>
        <SearchBox size="xl" placeholder={t("common.searchPlaceholder")} className="w-full max-w-[640px]" />
      </section>
      <p className="text-center text-sm text-muted-foreground">{t("common.empty")}</p>
    </div>
  );
}
