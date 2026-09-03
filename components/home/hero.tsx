import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/search/search-box";
import { POPULAR_SEARCHES } from "@/scripts/seed/templates";

export async function Hero() {
  const t = await getTranslations();
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-[#1c1c1f] to-[#282830] px-4 py-12 text-center text-white sm:py-16">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(600px_200px_at_50%_0%,#5383e8_0%,transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-5">
        <Logo size="xl" />
        <h1 className="text-lg font-bold sm:text-2xl">{t("home.heroTitle")}</h1>
        <p className="text-sm text-white/70">{t("home.heroSub")}</p>
        <SearchBox size="xl" placeholder={t("common.searchPlaceholder")} className="w-full max-w-[640px]" />
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="text-white/50">{t("home.popularSearches")}</span>
          {POPULAR_SEARCHES.slice(0, 8).map((q) => (
            <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="rounded-full border border-white/20 px-2.5 py-1 text-white/80 hover:border-white hover:text-white">
              {q}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
