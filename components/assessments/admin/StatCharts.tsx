import type { ReactNode } from "react";

// Dependency-free charts for the analytics screen: inline SVG/CSS only, each with
// a text/table alternative. Colours come from the site palette.

export const CHART_COLORS = { primary: "#1F5C56", dark: "#123A36", gold: "#F0B860", accent: "#E0794F", grid: "#D5E2DD", text: "#4C6864" };

export interface Datum {
  label: string;
  value: number;
}

export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Data table shown inside a disclosure for people who can't use the chart. */
  table?: { caption: string; columns: [string, string]; rows: Array<[string, string | number]> };
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-xl text-primary-dark">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-primary-dark">View as a table</summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">{table.caption}</caption>
            <thead className="text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th scope="col" className="py-1 pr-4 font-semibold">{table.columns[0]}</th>
                <th scope="col" className="py-1 font-semibold">{table.columns[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {table.rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="py-1 pr-4 font-normal text-ink-soft">{label}</th>
                  <td className="py-1 font-medium text-primary-dark">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

/** Vertical bar chart. `labelEvery` thins out the x-axis labels for dense charts. */
export function BarChart({
  data,
  ariaLabel,
  unit = "responses",
  labelEvery = 1,
  showValues = true,
  color = CHART_COLORS.primary,
}: {
  data: Datum[];
  ariaLabel: string;
  unit?: string;
  labelEvery?: number;
  showValues?: boolean;
  color?: string;
}) {
  const W = 600;
  const H = 230;
  const pad = { l: 34, r: 8, t: 18, b: 32 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = max <= 5 ? max : Math.ceil(max / 5) * 5;
  const ticks = max <= 5 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 1, 2, 3, 4, 5].map((i) => (top / 5) * i);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.68);
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={CHART_COLORS.grid} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={CHART_COLORS.text}>
            {t}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.l + i * slot + (slot - barW) / 2;
        const h = (d.value / top) * innerH;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y(d.value)} width={barW} height={Math.max(h, d.value > 0 ? 1 : 0)} rx={Math.min(3, barW / 2)} fill={color}>
              <title>{`${d.label}: ${d.value} ${unit}`}</title>
            </rect>
            {showValues && d.value > 0 && (
              <text x={x + barW / 2} y={y(d.value) - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_COLORS.dark}>
                {d.value}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" fontSize="11" fill={CHART_COLORS.text}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars as HTML — good for names that need room. `max` fixes the scale (e.g. 100 for scores). */
export function HBarList({ items, max, suffix = "", color = CHART_COLORS.primary }: { items: Datum[]; max?: number; suffix?: string; color?: string }) {
  const scale = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-primary-dark">{item.label}</span>
            <span className="shrink-0 font-semibold text-primary-dark">
              {item.value}
              {suffix}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (item.value / scale) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
