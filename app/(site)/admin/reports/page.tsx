import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { HideToggle, DeleteTargetButton, ReportButtons } from "@/components/admin/admin-controls";

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = await searchParams;
  const rows = await db.execute<{ id: number; target_type: "review" | "comment" | "post" | "content"; target_id: number; reason: string; status: string; created_at: Date; reporter: string; body: string | null; hidden: boolean | null }>(sql`
    select r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at, p.nickname reporter,
      case r.target_type when 'review' then (select left(body,140) from reviews where id = r.target_id) when 'comment' then (select left(body,140) from comments where id = r.target_id) when 'post' then (select title from posts where id = r.target_id) else (select title from contents where id = r.target_id) end body,
      case r.target_type when 'review' then (select is_hidden from reviews where id = r.target_id) when 'comment' then (select is_hidden from comments where id = r.target_id) when 'post' then (select is_hidden from posts where id = r.target_id) else (select not is_approved from contents where id = r.target_id) end hidden
    from reports r join profiles p on p.id = r.reporter_id where r.status = ${status}::report_status order by r.created_at desc limit 100`);
  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs">
        {["open", "resolved", "dismissed"].map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} className={`rounded-md border px-2 py-1 font-semibold ${status === s ? "border-primary bg-primary text-white" : "border-border"}`}>{s}</Link>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">{r.target_type} #{r.target_id}</span>
            <span className="min-w-0 flex-1 truncate">{r.body ?? "(deleted)"}</span>
            <span className="text-xs text-muted-foreground">{r.reason} · {r.reporter}</span>
            {r.body != null && <HideToggle targetType={r.target_type} targetId={r.target_id} hidden={!!r.hidden} />}
            {r.body != null && r.target_type !== "content" && <DeleteTargetButton targetType={r.target_type} targetId={r.target_id} />}
            {r.status === "open" && <ReportButtons reportId={r.id} />}
          </li>
        ))}
        {rows.length === 0 && <li className="p-8 text-center text-xs text-muted-foreground">–</li>}
      </ul>
    </div>
  );
}
