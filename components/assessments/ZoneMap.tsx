import type { ResultZone } from "@/lib/assessments/types";
import { MAP_SIZE as SIZE, PLOT, zoneMapLayout } from "@/lib/assessments/zoneMapLayout";

// A square plot of two skills (0–100 each). The participant is a dot; the quadrant they are in is
// tinted. The drawing is decorative: the scores and the zone are always also written out beside it.
// Where everything goes is worked out by zoneMapLayout, which the PDF report shares.

const C = {
  frame: "#9FBDB5",
  threshold: "#B7CCC6",
  tint: "rgba(240, 184, 96, 0.28)",
  name: "#4C6864",
  nameActive: "#AB471E",
  dot: "#1F5C56",
  text: "#16302E",
};

export default function ZoneMap({ zone, zones = null }: { zone: ResultZone; zones?: Record<string, { label?: string } | undefined> | null }) {
  const { split, right, bottom, quadrants, dot, you, names } = zoneMapLayout(zone, zones ? { zones } : null);
  const summary = `${zone.yLabel} ${zone.y} out of 100, ${zone.xLabel} ${zone.x} out of 100: ${zone.label}`;

  return (
    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:gap-10">
      <figure className="m-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} className="block h-auto w-full">
          {Object.entries(quadrants).map(([key, box]) => (
            <rect key={key} x={box.x} y={box.y} width={box.width} height={box.height} fill={key === zone.key ? C.tint : "transparent"} />
          ))}
          <rect x={PLOT.left} y={PLOT.top} width={PLOT.size} height={PLOT.size} fill="none" stroke={C.frame} strokeWidth="1.5" />
          <line x1={split.x} y1={PLOT.top} x2={split.x} y2={bottom} stroke={C.threshold} strokeWidth="1" strokeDasharray="4 5" />
          <line x1={PLOT.left} y1={split.y} x2={right} y2={split.y} stroke={C.threshold} strokeWidth="1" strokeDasharray="4 5" />
          {names.map((name) => (
            <text
              key={name.key}
              x={name.x}
              y={name.y}
              textAnchor={name.anchor}
              fill={name.key === zone.key ? C.nameActive : C.name}
              style={{ font: "700 11px var(--font-public-sans), sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}
            >
              {name.text}
            </text>
          ))}
          <circle cx={dot.x} cy={dot.y} r="15" fill="none" stroke={C.dot} strokeWidth="1.5" opacity="0.4" />
          <circle cx={dot.x} cy={dot.y} r="7" fill={C.dot} />
          <text x={you.x} y={you.y} textAnchor={you.anchor} fill={C.text} style={{ font: "italic 400 16px var(--font-fraunces), serif" }}>
            You
          </text>
          <g fill={C.name} style={{ font: "400 11px var(--font-public-sans), sans-serif" }}>
            <text x={PLOT.left - 8} y={bottom + 4} textAnchor="end">0</text>
            <text x={PLOT.left - 8} y={PLOT.top + 4} textAnchor="end">100</text>
            <text x={right} y={bottom + 18} textAnchor="end">100</text>
          </g>
          <g fill={C.name} style={{ font: "400 13px var(--font-public-sans), sans-serif", letterSpacing: "0.04em" }}>
            <text x={PLOT.left + PLOT.size / 2} y={SIZE - 8} textAnchor="middle">
              {zone.xLabel} →
            </text>
            <text transform={`translate(16 ${PLOT.top + PLOT.size / 2}) rotate(-90)`} textAnchor="middle">
              {zone.yLabel} →
            </text>
          </g>
        </svg>
      </figure>

      <div>
        <p className="eyebrow">Your zone</p>
        <p className="mt-2 font-display text-3xl leading-tight text-primary-dark sm:text-4xl">{zone.label}</p>
        {zone.description && <p className="mt-3 text-lg leading-relaxed text-ink-soft">{zone.description}</p>}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
          {[
            { label: zone.yLabel, value: zone.y },
            { label: zone.xLabel, value: zone.x },
          ].map((item) => (
            <div key={item.label} className="min-w-[6rem] border-t-[3px] border-gold pt-3">
              <dt className="text-sm text-ink-soft">{item.label}</dt>
              <dd className="mt-1 font-display text-4xl leading-none text-primary-dark">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
