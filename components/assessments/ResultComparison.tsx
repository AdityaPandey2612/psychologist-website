import type { AssessmentResult, PeerComparison as PeerComparisonData } from "@/lib/assessments/types";
import { ScoreBar, type BarTone } from "./ScoreBreakdown";
import { cx } from "./ui";

const CONTEXT_TONES: BarTone[] = ["primary", "accent", "sky", "gold"];

function Legend({ items }: { items: Array<{ label: string; tone: BarTone }> }) {
  const bg: Record<BarTone, string> = { primary: "bg-primary", accent: "bg-accent", gold: "bg-gold", sky: "bg-[#29586B]" };
  return (
    <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cx("h-3 w-3 rounded-full", bg[i.tone])} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Work-vs-home style comparison: overall per context, then each skill per context. */
export function ContextComparison({ result }: { result: AssessmentResult }) {
  const contexts = result.contexts.filter((c) => c.score !== null);
  if (contexts.length < 2) return null;
  const legend = contexts.map((c, i) => ({ label: c.name, tone: CONTEXT_TONES[i % CONTEXT_TONES.length] }));

  return (
    <div>
      <Legend items={legend} />
      <div className="space-y-3">
        {contexts.map((c, i) => (
          <ScoreBar key={c.id} label={`${c.name} overall`} value={c.score} tone={CONTEXT_TONES[i % CONTEXT_TONES.length]} />
        ))}
      </div>
      <h3 className="mt-8 font-display text-lg text-primary-dark">By skill</h3>
      <ul className="mt-3 grid gap-5 sm:grid-cols-2">
        {result.skills
          .filter((s) => s.score !== null)
          .map((skill) => (
            <li key={skill.id} className="rounded-2xl border border-primary/10 bg-bg p-4">
              <p className="font-medium text-primary-dark">{skill.name}</p>
              <div className="mt-2 space-y-2">
                {contexts.map((c, i) => {
                  const entry = c.skills.find((s) => s.id === skill.id);
                  return <ScoreBar key={c.id} label={c.name} value={entry?.score ?? null} tone={CONTEXT_TONES[i % CONTEXT_TONES.length]} size="sm" />;
                })}
              </div>
            </li>
          ))}
      </ul>
      {result.contextComparison && <p className="mt-6 leading-relaxed text-ink">{result.contextComparison.message}</p>}
    </div>
  );
}

/** How the participant rates themselves versus what their detailed answers show. */
export function SelfPerception({ data }: { data: NonNullable<AssessmentResult["selfPerception"]> }) {
  return (
    <div>
      <Legend
        items={[
          { label: "How you rate yourself", tone: "accent" },
          { label: "What your answers show", tone: "primary" },
        ]}
      />
      <div className="space-y-3">
        <ScoreBar label="How you rate yourself" value={data.selfScore} tone="accent" />
        <ScoreBar label="What your answers show" value={data.computedScore} tone="primary" />
      </div>
      <p className="mt-5 leading-relaxed text-ink">{data.message}</p>
      <p className="mt-2 text-sm text-ink-soft">
        {data.gap === 0 ? "These are the same." : `A difference of ${Math.abs(data.gap)} point${Math.abs(data.gap) === 1 ? "" : "s"}.`} This is a prompt for reflection, not a judgement.
      </p>
    </div>
  );
}

/** Self versus the (anonymous, averaged) view of the people the participant invited. */
export function PeerComparisonChart({ comparison }: { comparison: PeerComparisonData }) {
  return (
    <div>
      <Legend
        items={[
          { label: "You", tone: "primary" },
          { label: `Others (${comparison.responses} response${comparison.responses === 1 ? "" : "s"}, averaged)`, tone: "accent" },
        ]}
      />
      {comparison.overall && (
        <div className="space-y-3">
          <ScoreBar label="Overall — you" value={comparison.overall.self} tone="primary" />
          <ScoreBar label="Overall — others" value={comparison.overall.peer} tone="accent" />
        </div>
      )}
      {comparison.skills.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {comparison.skills.map((s) => (
            <li key={s.id} className="rounded-2xl border border-primary/10 bg-bg p-4">
              <p className="font-medium text-primary-dark">{s.name}</p>
              <div className="mt-2 space-y-2">
                <ScoreBar label="You" value={s.self} tone="primary" size="sm" />
                <ScoreBar label="Others" value={s.peer} tone="accent" size="sm" />
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {s.diff === 0 ? "In line with each other." : s.diff > 0 ? `You rated this ${s.diff} higher than others did.` : `Others rated this ${-s.diff} higher than you did.`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-sm leading-relaxed text-ink-soft">
        Only questions that were also asked of the other person are compared. Their answers are anonymous and shown here only as an average.
      </p>
    </div>
  );
}
