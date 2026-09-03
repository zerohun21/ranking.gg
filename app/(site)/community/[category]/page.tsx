import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import { getPosts, type PostTag } from "@/lib/db/queries/posts";
import { PostList } from "@/components/community/post-list";
import { Toolbar, Pager } from "../page";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ tag?: string; sort?: string; page?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug((await params).category);
  return { title: cat ? `${cat.nameKo} 커뮤니티` : "커뮤니티" };
}

export default async function CommunityBoard({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();
  const t = await getTranslations("community");
  const locale = await getLocale();
  const page = Math.max(1, Number(sp.page ?? 1));
  const { rows, total, pinned } = await getPosts({ categoryId: cat.id, tag: sp.tag as PostTag | undefined, sort: sp.sort === "popular" ? "popular" : "newest", page });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">
        {cat.icon} {t("title", { name: locale === "en" ? cat.nameEn : cat.nameKo })}
      </h1>
      <Toolbar base={`/community/${cat.slug}`} tag={sp.tag} sort={sp.sort} writeHref={`/community/${cat.slug}/write`} />
      <PostList rows={rows} pinned={pinned} />
      <Pager base={`/community/${cat.slug}`} page={page} total={total} extra={{ tag: sp.tag, sort: sp.sort }} />
    </div>
  );
}
