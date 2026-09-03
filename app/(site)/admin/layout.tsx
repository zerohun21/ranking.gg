import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const t = await getTranslations("admin");
  if (!user.profile?.isAdmin) return <div className="rounded-lg border border-lose/40 bg-lose/10 p-10 text-center text-sm">{t("forbidden")}</div>;
  const tabs = [
    ["/admin", t("dashboard")],
    ["/admin/reports", t("reports")],
    ["/admin/contents", t("contents")],
    ["/admin/categories", t("categories")],
    ["/admin/runs", t("runs")],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">🛡 {t("title")}</h1>
      <nav className="flex gap-1 border-b border-border text-sm">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className="border-b-2 border-transparent px-3 py-2 font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
