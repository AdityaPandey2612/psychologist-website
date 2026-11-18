import type { SkillResult } from "@/lib/assessments/types";
import styles from "./assessments.module.css";
import { Badge, cx } from "./ui";

export type BarTone = "primary" | "accent" | "gold" | "sky";

const TONE_BG: Record<BarTone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  gold: "bg-gold",
  sky: "bg-[#29586B]",
};

/** A single 0–100 horizontal bar with an accessible meter role. */
export function ScoreBar({
  label,
  value,
  note,
  tone = "primary",
  size = "md",
}: {
  label: string;
  value: number | null;
  note?: string;
  tone?: BarTone;
  size?: "sm" | "md";
}) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 font-medium text-ink">
          {label}
          {note && <span className="ml-2 text-ink-soft">{note}</span>}
        </span>
        <span className="shrink-0 font-semibold text-primary-dark">{value === null ? "—" : value}</span>
      </div>
      <div
        role="meter"
        aria-label={`${label}${note ? ` (${note})` : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : value}
        aria-valuetext={value === null ? "No score" : `${value} out of 100`}
        className={cx("mt-1.5 w-full overflow-hidden rounded-full bg-surface-soft", size === "sm" ? "h-2" : "h-2.5")}
      >
        <div className={cx("h-full rounded-full", TONE_BG[tone], styles.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Cards with each skill's score, band and description. */
export function SkillBreakdown({ skills }: { skills: SkillResult[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {skills.map((skill) => (
        <li key={skill.id} className="min-w-0 rounded-2xl border border-primary/10 bg-bg p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl text-primary-dark">{skill.name}</h3>
            {skill.band && <Badge tone="neutral">{skill.band}</Badge>}
          </div>
          <p className="mt-3 flex items-baseline gap-1 text-primary-dark">
            <span className="font-display text-4xl">{skill.score === null ? "—" : skill.score}</span>
            {skill.score !== null && <span className="text-sm text-ink-soft">/ 100</span>}
          </p>
          <div className="mt-3">
            <ScoreBar label={`${skill.name} score`} value={skill.score} size="sm" />
          </div>
          {skill.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{skill.description}</p>}
          <p className="mt-2 text-xs text-ink-soft">
            {skill.score === null
              ? "No answers counted for this skill."
              : `Based on ${skill.answered} answer${skill.answered === 1 ? "" : "s"}.`}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Compact list of progress bars, one per skill. */
export function ProgressBars({ skills }: { skills: SkillResult[] }) {
  return (
    <ul className="space-y-4">
      {skills.map((skill) => (
        <li key={skill.id}>
          <ScoreBar label={skill.name} value={skill.score} note={skill.band} />
        </li>
      ))}
    </ul>
  );
}
