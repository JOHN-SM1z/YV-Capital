"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClientStrings } from "@/i18n/client";

type Row = { stage: string; count: number };

/** Single-series horizontal bar: startups per pipeline stage. One hue, no legend (the title names it). */
export function PipelineChart({ data, label }: { data: Row[]; label: string }) {
  const { chartCount } = useClientStrings();
  const height = Math.max(160, data.length * 30 + 24);
  return (
    <div style={{ height }} role="img" aria-label={`${label}: ${data.map((d) => `${d.stage} ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={6}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#6b6f76" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="stage" width={210} tick={{ fontSize: 12, fill: "#3a3a3a" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#f4f5f7" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e6ea", fontSize: 12 }}
            formatter={(value) => [String(value), chartCount]}
          />
          <Bar dataKey="count" fill="#e85f00" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
