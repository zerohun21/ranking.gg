import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contents, contentStats } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getUserCategories } from "@/lib/db/queries/categories";
import { CreateCategoryForm, AddItemForm, DeleteItemButton } from "@/components/create/create-forms";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { contentHref, formatScore } from "@/lib/format";

export const metadata: Metadata = { title: "카테고리 개설" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/create");
  const t = await getTranslations("create");
  const tc = await getTranslations("common");
  const all = await getUserCategories();
  const mine = all.filter((c) => c.createdBy === user.id);
  const selected = category ? all.find((c) => c.slug === category && (c.createdBy === user.id || user.profile?.isAdmin)) : null;
  const items = selected
    ? await db.select({ id: contents.id, title: contents.title, slug: contents.slug, posterUrl: contents.posterUrl, rank: contentStats.rank, tier: contentStats.tier, score: contentStats.bayesianScore, ratingCount: contentStats.ratingCount }).from(contents).innerJoin(contentStats, eq(contentStats.contentId, contents.id)).where(eq(contents.categoryId, selected.id)).orderBy(asc(contentStats.rank), asc(contents.id))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">🛠 {t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </div>
      {user.profile?.isGuest && <p className="rounded-md border border-lose/40 bg-lose/10 p-3 text-sm">{tc("guestCannotPost")}</p>}

      {selected ? (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <div className="text-lg font-extrabold" style={{ color: selected.color }}>
                {selected.icon} {selected.nameKo}
              </div>
              <div className="text-xs text-muted-foreground">{selected.description}</div>
              {items.length < 5 && <div className="mt-1 text-xs font-semibold text-tier-a">{t("needMore", { n: 5 - items.length })}</div>}
            </div>
            <Link href={`/ranking/${selected.slug}`} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white">
              {tc("rank")} →
            </Link>
          </div>
          <AddItemForm categorySlug={selected.slug} />
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 text-center text-sm font-bold text-muted-foreground tabular">{it.rank ?? i + 1}</span>
                <Poster src={it.posterUrl} alt={it.title} size="xs" />
                <Link href={contentHref(selected.slug, it.slug)} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                  {it.title}
                </Link>
                <span className="text-xs tabular text-muted-foreground">{formatScore(it.score)} · {it.ratingCount}</span>
                <TierBadge tier={it.tier} size="sm" />
                <DeleteItemButton categorySlug={selected.slug} contentId={it.id} />
              </li>
            ))}
            {items.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">{tc("empty")}</li>}
          </ul>
        </>
      ) : (
        <CreateCategoryForm />
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold">{mine.length ? t("myCategories") : t("examples")}</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {(mine.length ? mine : all.slice(0, 6)).map((c) => (
            <li key={c.id}>
              <Link href={mine.length ? `/create?category=${c.slug}` : `/ranking/${c.slug}`} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 hover:border-primary">
                <span className="text-2xl">{c.icon}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{c.nameKo}</div>
                  <div className="text-[11px] text-muted-foreground tabular">{c.itemCount} {tc("items")}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
