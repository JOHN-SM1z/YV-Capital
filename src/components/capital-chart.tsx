"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClientStrings } from "@/i18n/client";

type Row = { label: string; usd: number; rounds: number };

const compact = (n: number) => (n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${n}`);

/** Single-series column chart: disclosed funding per reported month. One hue, no legend (the card title names it). */
export function CapitalChart({ data, label }: { data: Row[]; label: string }) {
  const { chartUsd } = useClientStrings();
  return (
    <div style={{ height: 240 }} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${compact(d.usd)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6f76" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact} width={56} tick={{ fontSize: 12, fill: "#6b6f76" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#f4f5f7" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e6ea", fontSize: 12 }}
            formatter={(value) => [compact(Number(value)), chartUsd]}
          />
          <Bar dataKey="usd" fill="#e85f00" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
