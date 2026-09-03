/**
 * 마이그레이션: drizzle SQL(스키마) → drizzle/custom/*.sql(함수·트리거·RLS) 순서로 적용.
 *   pnpm db:migrate            # 전부
 *   pnpm db:migrate -- --core  # auth/RLS 제외 (로컬 PG 테스트용)
 */
import "@/scripts/env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const coreOnly = process.argv.includes("--core");
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client);

  console.log("→ extensions");
  await client.unsafe("create extension if not exists pg_trgm;");

  console.log("→ drizzle migrations");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  const customDir = path.join(process.cwd(), "drizzle", "custom");
  const files = readdirSync(customDir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !coreOnly || !f.includes("auth"))
    .sort();
  for (const f of files) {
    console.log(`→ custom/${f}`);
    await client.unsafe(readFileSync(path.join(customDir, f), "utf8"));
  }

  const admins = process.env.ADMIN_EMAILS;
  if (admins && !coreOnly) {
    console.log("→ app_settings.admin_emails");
    await client.unsafe(`insert into public.app_settings(key, value) values ('admin_emails', '${admins.replace(/'/g, "''")}') on conflict (key) do update set value = excluded.value, updated_at = now()`);
  }
  await client.end();
  console.log("✓ migrate done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
