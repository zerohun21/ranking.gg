import { cache } from "react";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/lib/db/schema";

export type CurrentUser = { id: string; email: string | null; isAnonymous: boolean; profile: Profile | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    return { id: user.id, email: user.email ?? null, isAnonymous: !!user.is_anonymous, profile: rows[0] ?? null };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.profile?.isAdmin) throw new Error("FORBIDDEN");
  return u;
}
