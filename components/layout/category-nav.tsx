"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Swords, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type NavCat = { slug: string; nameKo: string; nameEn: string; icon: string; color: string };

export function CategoryNav({ official, userCategories }: { official: NavCat[]; userCategories: NavCat[] }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const name = (c: NavCat) => (locale === "en" ? c.nameEn : c.nameKo);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const items: { href: string; label: string; icon?: React.ReactNode }[] = [
    { href: "/", label: t("home") },
    ...official.map((c) => ({ href: `/ranking/${c.slug}`, label: name(c), icon: <span aria-hidden>{c.icon}</span> })),
    { href: "/battle", label: t("battle"), icon: <Swords className="h-3.5 w-3.5" /> },
    { href: "/community", label: t("community"), icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  return (
    <nav className="sticky top-14 z-40 h-11 w-full border-b border-border bg-nav text-header-foreground">
      <div className="mx-auto flex h-full max-w-[1080px] items-stretch px-1 sm:px-2">
        <ul className="scrollbar-none flex flex-1 items-stretch gap-0.5 overflow-x-auto">
          {items.map((it) => (
            <li key={it.href} className="flex shrink-0">
              <Link
                href={it.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 text-[13px] font-semibold whitespace-nowrap transition-colors hover:text-white",
                  isActive(it.href) ? "text-white" : "text-white/70",
                )}
              >
                {it.icon}
                {it.label}
                {isActive(it.href) && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[#5383e8]" />}
              </Link>
            </li>
          ))}
        </ul>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 px-3 text-[13px] font-semibold text-white/70 hover:text-white outline-none">
            {t("userCategories")} <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
            {userCategories.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">—</div>}
            {userCategories.map((c) => (
              <DropdownMenuItem key={c.slug} render={<Link href={`/ranking/${c.slug}`} />}>
                <span className="mr-2">{c.icon}</span>
                <span className="truncate">{name(c)}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem render={<Link href="/create" />} className="font-semibold text-primary">
              + {t("create")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
