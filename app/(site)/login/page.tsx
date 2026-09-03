import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { LoginTabs } from "@/components/auth/login-tabs";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && !user.isAnonymous) redirect(sp.next ?? "/");
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-center text-2xl font-extrabold">{sp.mode === "signup" ? t("signupTitle") : t("title")}</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">{user?.isAnonymous ? t("loginSheetDesc") : t("guestDesc")}</p>
      <LoginTabs defaultMode={sp.mode === "signup" ? "signup" : "login"} next={sp.next} isGuest={!!user?.isAnonymous} />
    </div>
  );
}
