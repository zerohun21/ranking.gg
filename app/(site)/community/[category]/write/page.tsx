import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import { getCurrentUser } from "@/lib/auth";
import { PostForm } from "@/components/community/post-form";

export default async function WritePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/community/${cat.slug}/write`);
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-extrabold">{cat.icon} {t("community.write")}</h1>
      {user.profile?.isGuest && <p className="rounded-md border border-lose/40 bg-lose/10 p-3 text-sm">{t("common.guestCannotPost")}</p>}
      <PostForm categorySlug={cat.slug} categoryId={cat.id} />
    </div>
  );
}
