"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartDatum = { name: string; value: number; extra?: string };

const COLORS = ["#FF007A", "#FFC72C", "#6366F1", "#14B8A6", "#F97316", "#8B5CF6", "#22C55E", "#0EA5E9", "#EF4444", "#A3A3A3"];

function Frame({ title, hint, wide, children }: { title: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="font-display text-base font-medium text-ink">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

const tooltipStyle = { borderRadius: 8, borderColor: "#E4E1EA", fontSize: 12 };

export function PieBlock({
  title,
  hint,
  data,
  empty,
}: {
  title: string;
  hint?: string;
  data: ChartDatum[];
  empty: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Frame title={title} hint={hint}>
      {data.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, n) => [`${v} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Frame>
  );
}

export function BarBlock({
  title,
  hint,
  data,
  empty,
  unit = "",
  wide,
}: {
  title: string;
  hint?: string;
  data: ChartDatum[];
  empty: string;
  unit?: string;
  wide?: boolean;
}) {
  const height = Math.max(120, data.length * 34 + 20);
  return (
    <Frame title={title} hint={hint} wide={wide}>
      {data.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: "#78758A" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(v, _n, item) => {
                  const extra = (item?.payload as ChartDatum | undefined)?.extra;
                  return [`${v}${unit}${extra ? ` · ${extra}` : ""}`, ""];
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                barSize={18}
                label={{ position: "right", fontSize: 11, fill: "#78758A", formatter: (v: unknown) => `${v}${unit}` }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Frame>
  );
}
