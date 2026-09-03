import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionRuns } from "@/lib/db/schema";

export default async function AdminRuns() {
  const rows = await db.select().from(collectionRuns).orderBy(desc(collectionRuns.startedAt)).limit(50);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-2 text-left">source</th><th className="p-2">status</th><th className="p-2 text-right">upserted</th><th className="p-2 text-right">failed</th><th className="p-2">started</th><th className="p-2">finished</th><th className="p-2 text-left">cursor / error</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border tabular">
              <td className="p-2 font-semibold">{r.source}</td>
              <td className={`p-2 text-center ${r.status === "done" ? "text-up" : r.status === "failed" ? "text-lose" : "text-tier-a"}`}>{r.status}</td>
              <td className="p-2 text-right">{r.itemsUpserted}</td>
              <td className="p-2 text-right">{r.itemsFailed}</td>
              <td className="p-2">{r.startedAt.toISOString().slice(0, 16)}</td>
              <td className="p-2">{r.finishedAt?.toISOString().slice(0, 16) ?? "–"}</td>
              <td className="max-w-[300px] truncate p-2 text-left text-muted-foreground">{r.error ? r.error.slice(0, 120) : JSON.stringify(r.cursor).slice(0, 120)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
