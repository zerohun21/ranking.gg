import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBattleById } from "@/lib/db/queries/home";
import { getComments } from "@/lib/db/queries/content";
import { getCurrentUser } from "@/lib/auth";
import { BattleCard } from "@/components/battle/battle-card";
import { CommentThread } from "@/components/content/comment-thread";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = await getBattleById(Number(id));
  return b ? { title: `${b.a.title} vs ${b.b.title}` } : {};
}

export default async function BattleDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const b = await getBattleById(Number(id), user?.id);
  if (!b) notFound();
  const t = await getTranslations("battle");
  const comments = await getComments("battle", b.id, user?.id);
  const viewer = user?.profile ? { id: user.id, isAdmin: user.profile.isAdmin } : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">
          {b.a.title} <span className="text-muted-foreground">vs</span> {b.b.title}
        </h1>
        <Link href={`/battle?category=${b.categorySlug}`} className="text-xs font-semibold text-primary hover:underline">
          {t("next")} →
        </Link>
      </div>
      <BattleCard battle={b} loggedIn={!!user} size="lg" showComments={false} />
      <CommentThread targetType="battle" targetId={b.id} viewer={viewer} initial={comments} />
    </div>
  );
}
