"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/components/providers";

export function CropPriceChart({ data }: { data: { date: string; mandi: number | null; platform: number | null; ask: number }[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const tick = { fill: dark ? "#94a3b8" : "#64748b", fontSize: 11 };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={dark ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={tick} tickFormatter={(v: string) => v.slice(5)} minTickGap={24} />
        <YAxis tick={tick} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: dark ? "#0f172a" : "#fff", border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`, borderRadius: 12, fontSize: 12 }}
          formatter={(v, n) => [v === null || v === undefined ? "—" : `Rs. ${Number(v).toFixed(2)}/kg`, n]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="mandi" name="Govt. mandi avg" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="platform" name="MarketLink deals" stroke="#117e48" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line type="stepAfter" dataKey="ask" name="This listing" stroke="#d9a514" strokeWidth={2} strokeDasharray="6 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
