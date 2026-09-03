import { Header } from "@/components/layout/header";
import { CategoryNav } from "@/components/layout/category-nav";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth";
import { getOfficialCategories, getUserCategories, fallbackOfficialCategories } from "@/lib/db/queries/categories";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, official, userCats] = await Promise.all([getCurrentUser(), getOfficialCategories(), getUserCategories()]);
  const nav = official.length ? official : fallbackOfficialCategories();
  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} />
      <CategoryNav official={nav} userCategories={userCats.map((c) => ({ slug: c.slug, nameKo: c.nameKo, nameEn: c.nameEn, icon: c.icon, color: c.color }))} />
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>
      <Footer />
    </div>
  );
}
