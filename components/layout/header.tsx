import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Logo } from "./logo";
import { HeaderControls } from "./header-controls";
import { SearchBox } from "@/components/search/search-box";
import type { CurrentUser } from "@/lib/auth";

export async function Header({ user }: { user: CurrentUser | null }) {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-50 h-14 w-full bg-header text-header-foreground shadow-sm">
      <div className="mx-auto flex h-full max-w-[1080px] items-center gap-3 px-3 sm:px-4">
        <Logo />
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBox placeholder={t("searchPlaceholder")} className="w-full max-w-[460px]" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/search" className="md:hidden rounded-md p-2 text-sm hover:bg-white/10" aria-label={t("search")}>
            🔍
          </Link>
          <HeaderControls user={user} />
        </div>
      </div>
    </header>
  );
}
