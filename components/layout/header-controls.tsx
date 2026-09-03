"use client";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { Moon, Sun, LogOut, User, Shield, Plus } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/config";
import type { CurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function HeaderControls({ user }: { user: CurrentUser | null }) {
  const t = useTranslations("common");
  const tn = useTranslations("nav");
  const locale = useLocale() as Locale;
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [, start] = useTransition();

  const toggleLocale = () => {
    const next: Locale = locale === "ko" ? "en" : "ko";
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  };
  const logout = async () => {
    await createClient().auth.signOut();
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={toggleLocale} className="h-8 px-2 text-xs font-bold text-header-foreground hover:bg-white/10 hover:text-white" aria-label={t("language")}>
        {locale === "ko" ? "KO" : "EN"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-header-foreground hover:bg-white/10 hover:text-white"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={t("theme")}
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </Button>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full outline-none ring-offset-2 focus-visible:ring-2">
            <Avatar className="h-8 w-8 border border-white/20">
              <AvatarImage src={user.profile?.avatarUrl ?? undefined} alt="" />
              <AvatarFallback>{user.profile?.nickname?.slice(0, 1) ?? "U"}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-semibold truncate">{user.profile?.nickname ?? t("guest")}</div>
            <DropdownMenuSeparator />
            {user.profile && (
              <DropdownMenuItem render={<Link href={`/u/${encodeURIComponent(user.profile.nickname)}`} />}>
                <User className="mr-2 h-4 w-4" /> {t("profile")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<Link href="/create" />}>
              <Plus className="mr-2 h-4 w-4" /> {tn("create")}
            </DropdownMenuItem>
            {user.profile?.isAdmin && (
              <DropdownMenuItem render={<Link href="/admin" />}>
                <Shield className="mr-2 h-4 w-4" /> {t("admin")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button size="sm" className="ml-1 h-8 bg-[#5383e8] px-3 text-xs font-bold hover:bg-[#4a75d0]" nativeButton={false} render={<Link href="/login" />}>
          {t("login")}
        </Button>
      )}
    </div>
  );
}
