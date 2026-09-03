"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function MyDistChart({ dist }: { dist: number[] }) {
  const data = dist.map((n, i) => ({ score: (i + 1) / 2, n }));
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="score" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(83,131,232,0.08)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} labelFormatter={(l) => `★ ${l}`} />
          <Bar dataKey="n" radius={[3, 3, 0, 0]}>
            {data.map((d) => <Cell key={d.score} fill={d.score >= 4 ? "#5383e8" : d.score >= 2.5 ? "#9aa4af" : "#e84057"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
