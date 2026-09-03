"use client";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DistributionChart({ dist, mine }: { dist: number[]; mine: number | null }) {
  const t = useTranslations("content");
  const data = dist.map((n, i) => ({ score: (i + 1) / 2, n }));
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold">{t("distribution")}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="score" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(83,131,232,0.08)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} formatter={(v) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, ""]} labelFormatter={(l) => `★ ${l}`} />
            <Bar dataKey="n" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.score} fill={mine === d.score ? "#ffb400" : d.score >= 4 ? "#5383e8" : d.score >= 2.5 ? "#9aa4af" : "#e84057"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {mine && <p className="mt-1 text-right text-[11px] text-[#ffb400]">★ {t("yourRating")}: {mine.toFixed(1)}</p>}
    </div>
  );
}

export function RankHistoryChart({ history, current }: { history: { week: string; rank: number | null; score: string }[]; current: { rank: number | null; score: string } }) {
  const t = useTranslations("content");
  const locale = useLocale();
  const data = [...history.map((h) => ({ week: h.week.slice(5), rank: h.rank ?? undefined })), { week: locale === "en" ? "now" : "현재", rank: current.rank ?? undefined }];
  const ranks = data.map((d) => d.rank).filter((r): r is number => r != null);
  if (!ranks.length) return null;
  const lo = Math.max(1, Math.min(...ranks) - 2);
  const hi = Math.max(...ranks) + 2;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold">{t("rankHistory")}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis reversed domain={[lo, hi]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} formatter={(v) => [`#${v}`, ""]} />
            <Line type="monotone" dataKey="rank" stroke="#5383e8" strokeWidth={2} dot={{ r: 3, fill: "#5383e8" }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
