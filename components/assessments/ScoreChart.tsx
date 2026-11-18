import type { SkillResult } from "@/lib/assessments/types";
import { ProgressBars } from "./ScoreBreakdown";

// Dependency-free chart: an inline-SVG radar for three or more skills, otherwise
// bars. A text list below the radar carries the same numbers for everyone.

const W = 440;
const H = 340;
const CX = W / 2;
const CY = H / 2;
const R = 100;
const LABEL_R = R + 22;

function point(index: number, count: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

const pts = (coords: Array<[number, number]>) => coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export default function ScoreChart({ skills, variant = "radar" }: { skills: SkillResult[]; variant?: "radar" | "bar" }) {
  const scored = skills.filter((s) => s.score !== null) as Array<SkillResult & { score: number }>;
  if (scored.length === 0) return null;
  if (variant === "bar" || scored.length < 3) return <ProgressBars skills={scored} />;

  const n = scored.length;
  const summary = `Radar chart of ${n} skill scores out of 100: ${scored.map((s) => `${s.name} ${s.score}`).join(", ")}.`;
  const rings = [25, 50, 75, 100];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="mx-auto h-auto w-full max-w-md">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={pts(scored.map((_, i) => point(i, n, (R * ring) / 100)))}
            fill={ring === 100 ? "#EEF3F1" : "none"}
            stroke="#1F5C56"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        ))}
        {scored.map((_, i) => {
          const [x, y] = point(i, n, R);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#1F5C56" strokeOpacity={0.18} />;
        })}
        <polygon points={pts(scored.map((s, i) => point(i, n, (R * s.score) / 100)))} fill="#1F5C56" fillOpacity={0.22} stroke="#1F5C56" strokeWidth={2.5} strokeLinejoin="round" />
        {scored.map((s, i) => {
          const [x, y] = point(i, n, (R * s.score) / 100);
          return <circle key={s.id} cx={x} cy={y} r={4.5} fill="#1F5C56" />;
        })}
        {scored.map((s, i) => {
          const [x, y] = point(i, n, LABEL_R);
          const dx = x - CX;
          const anchor = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
          return (
            <text key={s.id} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={14} fontWeight={600} fill="#123A36">
              {s.name}
              <tspan x={x} dy={16} fontWeight={400} fill="#4C6864">
                {s.score}
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
