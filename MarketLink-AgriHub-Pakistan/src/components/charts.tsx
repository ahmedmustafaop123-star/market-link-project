"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/components/providers";

export const PALETTE = ["#01411c", "#f1c232", "#1d9d5c", "#0ea5e9", "#d97706", "#8b5cf6", "#ef4444", "#64748b", "#14b8a6", "#ec4899"];

function useAxis() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    grid: dark ? "#1e293b" : "#e2e8f0",
    tick: { fill: dark ? "#94a3b8" : "#64748b", fontSize: 11 },
    tooltip: {
      contentStyle: {
        background: dark ? "#0f172a" : "#ffffff",
        border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
        borderRadius: 12,
        fontSize: 12,
        color: dark ? "#e2e8f0" : "#0f172a",
      },
    },
  };
}

const shortRs = (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} Lakh` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${v}`);

export function MultiLineChart({ data, keys, xKey = "date", height = 300, unit = "Rs./kg" }: { data: Record<string, unknown>[]; keys: string[]; xKey?: string; height?: number; unit?: string }) {
  const a = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={a.grid} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={a.tick} tickFormatter={(v: string) => (typeof v === "string" && v.length === 10 ? v.slice(5) : v)} />
        <YAxis tick={a.tick} domain={["auto", "auto"]} />
        <Tooltip {...a.tooltip} formatter={(v) => [`Rs. ${Number(v).toFixed(2)}`, undefined]} labelFormatter={(l) => `${l} (${unit})`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBarChart({ data, height = 320 }: { data: { cropName: string; mandiAvg: number; platformAsk: number | null; platformDeal: number | null }[]; height?: number }) {
  const a = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={a.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="cropName" tick={a.tick} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={a.tick} />
        <Tooltip {...a.tooltip} formatter={(v) => (v === null || v === undefined ? "—" : `Rs. ${Number(v).toFixed(2)}/kg`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="mandiAvg" name="Mandi avg" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        <Bar dataKey="platformAsk" name="Platform ask" fill="#f1c232" radius={[6, 6, 0, 0]} />
        <Bar dataKey="platformDeal" name="Platform deal" fill="#01411c" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VolumeAreaChart({ data, height = 260, dataKey = "volume", color = "#117e48" }: { data: Record<string, unknown>[]; height?: number; dataKey?: string; color?: string }) {
  const a = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={a.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={a.tick} />
        <YAxis tick={a.tick} tickFormatter={shortRs} />
        <Tooltip {...a.tooltip} formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, "Volume"]} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#g-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, xKey, yKey, height = 260, horizontal = false }: { data: Record<string, unknown>[]; xKey: string; yKey: string; height?: number; horizontal?: boolean }) {
  const a = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 5, right: 15, left: horizontal ? 20 : -5, bottom: 0 }}>
        <CartesianGrid stroke={a.grid} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={a.tick} tickFormatter={shortRs} />
            <YAxis type="category" dataKey={xKey} tick={a.tick} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={a.tick} />
            <YAxis tick={a.tick} tickFormatter={shortRs} />
          </>
        )}
        <Tooltip {...a.tooltip} formatter={(v) => `Rs. ${Number(v).toLocaleString()}`} />
        <Bar dataKey={yKey} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  const a = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...a.tooltip} formatter={(v) => `Rs. ${Number(v).toLocaleString()}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
