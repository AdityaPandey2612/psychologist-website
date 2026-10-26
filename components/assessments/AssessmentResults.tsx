"use client";

import { Check, ClipboardCopy, Download } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ApiClientError, downloadReport } from "@/lib/assessments/client/api";
import type { AssessmentResult, ContentKind, ResultComponent, ResultsConfig } from "@/lib/assessments/types";
import { headlineParts, resultEyebrow } from "@/lib/assessments/presentation";
import type { ResultView } from "@/lib/assessments/server/submissions";
import styles from "./assessments.module.css";
import EmailResultsPanel from "./EmailResultsPanel";
import PeerInvitePanel from "./PeerInvitePanel";
import PracticePlan from "./PracticePlan";
import { ContextComparison, PeerComparisonChart, SelfPerception } from "./ResultComparison";
import { BrandLogo } from "./FormBrand";
import ScoreChart from "./ScoreChart";
import { ProgressBars, ScoreBar, SkillBreakdown } from "./ScoreBreakdown";
import ZoneMap from "./ZoneMap";
import { Alert, Badge, cx } from "./ui";

export interface AssessmentResultsProps {
  title: string;
  firstName?: string;
  completedAt?: string;
  result: AssessmentResult;
  config: ResultsConfig;
  /** The names of the four zones, for the zone map. */
  zones?: Record<string, { label?: string } | undefined> | null;
  /** Email delivery state and peer state from the result API. Omitted in preview. */
  email?: ResultView["email"];
  peer?: ResultView["peer"];
  /** The private result token; needed for the email and peer-link actions. */
  token?: string;
  /** Admin preview: hides email/peer actions and shows a "Preview" banner. */
  preview?: boolean;
}

// ----------------------------------------------------------------- helpers

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className={cx("whitespace-pre-line leading-relaxed", className)}>
            {p}
          </p>
        ))}
    </>
  );
}

function Block({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={title ? `${id}-title` : undefined} className="card break-inside-avoid p-6 sm:p-8">
      {title && (
        <h2 id={`${id}-title`} className="text-2xl text-primary-dark">
          {title}
        </h2>
      )}
      <div className={title ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}

const contentOf = (result: AssessmentResult, kinds: ContentKind[]) => result.content.filter((c) => kinds.includes(c.kind));

/** Plain-text summary used by the "Copy results" button. */
export function buildSummaryText({ title, firstName, completedAt, result }: Pick<AssessmentResultsProps, "title" | "firstName" | "completedAt" | "result">): string {
  const lines: string[] = [title];
  if (firstName) lines.push(`For ${firstName}${completedAt ? ` · ${formatDate(completedAt)}` : ""}`);
  lines.push("");
  for (const s of contentOf(result, ["support"])) {
    lines.push(s.title ? `${s.title}: ${s.text}` : s.text, "");
  }
  if (result.zone) {
    lines.push(`Zone: ${result.zone.label}`);
    if (result.zone.description) lines.push(result.zone.description);
    lines.push("");
  }
  if (result.scored && result.overall !== null && !result.zone) {
    lines.push(`Overall score: ${result.display ? result.display.score : result.overall} / ${result.display ? result.display.max : 100}${result.level ? ` (${result.level.label})` : ""}`);
    if (result.level) lines.push(result.level.description);
    lines.push("");
  }
  const skills = result.skills.filter((s) => s.score !== null);
  if (skills.length) {
    lines.push("Skills");
    for (const s of skills) lines.push(`- ${s.name}: ${s.score}${s.band ? ` (${s.band})` : ""}`);
    lines.push("");
  }
  const contexts = result.contexts.filter((c) => c.score !== null);
  if (contexts.length >= 2) {
    lines.push(contexts.map((c) => `${c.name}: ${c.score}`).join(" · "));
    if (result.contextComparison) lines.push(result.contextComparison.message);
    lines.push("");
  }
  if (result.strengths.length) {
    lines.push("Strengths");
    for (const s of result.strengths) lines.push(`- ${s.name} (${s.score}): ${s.text}`);
    lines.push("");
  }
  if (result.growth.length) {
    lines.push("Growth areas");
    for (const g of result.growth) lines.push(`- ${g.name} (${g.score}): ${g.text}`);
    lines.push("");
  }
  const recs = result.content.filter((c) => c.kind === "recommendation" || c.kind === "message");
  if (recs.length) {
    lines.push("Recommendations");
    for (const r of recs) lines.push(`- ${r.title ? `${r.title}: ` : ""}${r.text}`);
    lines.push("");
  }
  if (result.practicePlan) {
    lines.push(result.practicePlan.title);
    for (const w of result.practicePlan.weeks) {
      if (result.practicePlan.steps) {
        lines.push(`${w.title}: ${w.practices.map((p) => p.text).join(" ")}`);
        continue;
      }
      lines.push(`${w.title} (${w.days})`);
      for (const p of w.practices) lines.push(`  - ${p.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function ScoreRing({ score, display }: { score: number; display?: { score: number; max: number } }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (shown ? Math.min(100, Math.max(0, score)) : 0) / 100);
  return (
    <svg viewBox="0 0 180 180" role="img" aria-label={`Overall score: ${display ? display.score : score} out of ${display ? display.max : 100}`} className="h-44 w-44 shrink-0">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#DCEAE4" strokeWidth="14" />
      <circle
        cx="90"
        cy="90"
        r={r}
        fill="none"
        stroke="#1F5C56"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 90 90)"
        className={styles.ring}
      />
      <text x="90" y="92" textAnchor="middle" fontSize="46" fontWeight="600" fill="#123A36" fontFamily="var(--font-fraunces), serif">
        {display ? display.score : score}
      </text>
      <text x="90" y="118" textAnchor="middle" fontSize="13" fill="#4C6864">
        out of {display ? display.max : 100}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------- main

export default function AssessmentResults(props: AssessmentResultsProps) {
  const { title, firstName, completedAt, result, config, zones, token, preview } = props;
  const [email, setEmail] = useState(props.email);
  const [peer, setPeer] = useState(props.peer);
  const [copied, setCopied] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => setEmail(props.email), [props.email]);
  useEffect(() => setPeer(props.peer), [props.peer]);

  async function copySummary() {
    const text = buildSummaryText({ title, firstName, completedAt, result });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function saveReport() {
    if (!token || savingReport) return;
    setSavingReport(true);
    setReportError("");
    try {
      const { blob, filename } = await downloadReport(token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setReportError(e instanceof ApiClientError ? e.message : "We couldn't make your report. Please try again.");
    } finally {
      setSavingReport(false);
    }
  }

  const scoredSkills = result.skills.filter((s) => s.score !== null);

  function render(c: ResultComponent): ReactNode {
    const heading = (fallback: string) => c.title?.trim() || fallback;

    switch (c.type) {
      case "overall_score":
        if (!result.scored || result.overall === null) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your overall score")}>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
              <ScoreRing score={result.overall} display={result.display} />
              <div className="text-center sm:text-left">
                {result.level && <Badge tone="primary">{result.level.label}</Badge>}
                <p className="mt-3 leading-relaxed text-ink-soft">
                  Calculated from {result.stats.scoredQuestions} answer{result.stats.scoredQuestions === 1 ? "" : "s"}
                  {result.stats.skippedOptional > 0 ? `; ${result.stats.skippedOptional} skipped question${result.stats.skippedOptional === 1 ? " was" : "s were"} left out, not counted as zero` : ""}.
                </p>
              </div>
            </div>
          </Block>
        );

      case "classification":
        if (!result.level) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Where you are right now")}>
            <p className="font-display text-4xl text-primary-dark">{result.level.label}</p>
            <Paragraphs text={result.level.description} className="mt-3 text-ink" />
          </Block>
        );

      case "zone_map":
        if (!result.zone) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your map")}>
            <ZoneMap zone={result.zone} zones={zones} />
          </Block>
        );

      case "skill_breakdown":
        if (scoredSkills.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your skills")}>
            <SkillBreakdown skills={scoredSkills} />
          </Block>
        );

      case "progress_bars":
        if (scoredSkills.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Skill scores")}>
            <ProgressBars skills={scoredSkills} />
          </Block>
        );

      case "chart":
        if (scoredSkills.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your profile at a glance")}>
            <ScoreChart skills={scoredSkills} variant={c.variant ?? "radar"} />
          </Block>
        );

      case "context_comparison": {
        const contexts = result.contexts.filter((x) => x.score !== null);
        if (contexts.length < 2) return null;
        return (
          <Block key={c.id} id={c.id} title={heading(contexts.map((x) => x.name).join(" vs "))}>
            <ContextComparison result={result} />
          </Block>
        );
      }

      case "self_perception":
        if (!result.selfPerception) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("How you see yourself")}>
            <SelfPerception data={result.selfPerception} />
          </Block>
        );

      case "peer_comparison":
        if (preview) {
          return (
            <Block key={c.id} id={c.id} title={heading("How others see you")}>
              <Alert tone="info">Participants who invite someone will see their self-ratings next to the average of the answers they receive, and a private link to share.</Alert>
            </Block>
          );
        }
        if (!peer?.available || !token) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("How others see you")}>
            {peer.comparison && (
              <div className="mb-6">
                <PeerComparisonChart comparison={peer.comparison} />
              </div>
            )}
            <PeerInvitePanel token={token} peer={peer} onChange={setPeer} />
          </Block>
        );

      case "interpretation": {
        if (!result.level || result.overall === null) return null;
        const top = result.strengths[0];
        const low = result.growth[0];
        return (
          <Block key={c.id} id={c.id} title={heading("What this means")}>
            <Paragraphs text={result.level.description} className="text-ink" />
            {(top || low) && (
              <p className="mt-3 leading-relaxed text-ink">
                {top && (
                  <>
                    Your highest-scoring area is <strong>{top.name}</strong> ({top.score}).{" "}
                  </>
                )}
                {low && (
                  <>
                    The area with the most room to grow is <strong>{low.name}</strong> ({low.score}).
                  </>
                )}
              </p>
            )}
            <p className="mt-3 text-sm text-ink-soft">This is a snapshot of how you answered today, not a fixed trait. It will change as your habits do.</p>
          </Block>
        );
      }

      case "strengths":
        if (result.strengths.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your strengths")}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {result.strengths.map((s) => (
                <li key={s.skillId} className="rounded-2xl border border-primary/10 bg-bg p-5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl text-primary-dark">{s.name}</span>
                    <span className="font-semibold text-primary">{s.score}</span>
                  </p>
                  <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
                </li>
              ))}
            </ul>
          </Block>
        );

      case "growth_areas":
        if (result.growth.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Where you could grow")}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {result.growth.map((g) => (
                <li key={g.skillId} className="rounded-2xl border border-primary/10 bg-bg p-5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl text-primary-dark">{g.name}</span>
                    <span className="font-semibold text-accent-ink">{g.score}</span>
                  </p>
                  <p className="mt-2 leading-relaxed text-ink-soft">{g.text}</p>
                  {g.tips.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
                      {g.tips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Block>
        );

      case "habits":
        if (result.strongestHabits.length === 0 && result.growthHabits.length === 0) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Your habits in detail")}>
            <div className="grid gap-8 md:grid-cols-2">
              {result.strongestHabits.length > 0 && (
                <div>
                  <h3 className="font-display text-lg text-primary-dark">What you do well</h3>
                  <ul className="mt-4 space-y-4">
                    {result.strongestHabits.map((h) => (
                      <li key={h.questionId}>
                        <ScoreBar label={h.label} value={h.score} size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.growthHabits.length > 0 && (
                <div>
                  <h3 className="font-display text-lg text-primary-dark">Habits to work on</h3>
                  <ul className="mt-4 space-y-4">
                    {result.growthHabits.map((h) => (
                      <li key={h.questionId}>
                        <ScoreBar label={h.label} value={h.score} tone="accent" size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Block>
        );

      case "insights":
      case "misconceptions":
      case "recommendations": {
        const kinds: ContentKind[] = c.type === "insights" ? ["insight"] : c.type === "misconceptions" ? ["misconception"] : ["recommendation", "message"];
        const items = contentOf(result, kinds);
        if (items.length === 0) return null;
        const fallback = c.type === "insights" ? "Insights" : c.type === "misconceptions" ? "Common misconceptions" : "Recommendations";
        return (
          <Block key={c.id} id={c.id} title={heading(fallback)}>
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className={cx("rounded-2xl p-5", c.type === "misconceptions" ? "border-l-4 border-accent bg-bg" : "border border-primary/10 bg-bg")}>
                  {item.title && <p className="font-display text-lg text-primary-dark">{item.title}</p>}
                  <Paragraphs text={item.text} className={cx("text-ink", item.title && "mt-2")} />
                </li>
              ))}
            </ul>
          </Block>
        );
      }

      case "practice_plan":
        if (!result.practicePlan) return null;
        return (
          <Block key={c.id} id={c.id} title={heading(result.practicePlan.title)}>
            <PracticePlan plan={result.practicePlan} />
          </Block>
        );

      case "custom_message":
        if (!c.text?.trim()) return null;
        return (
          <Block key={c.id} id={c.id} title={c.title?.trim() || undefined}>
            <Paragraphs text={c.text} className="text-ink" />
          </Block>
        );

      case "copy_results":
        return (
          <div key={c.id} className={cx("flex flex-wrap items-center gap-3", styles.noPrint)}>
            <button type="button" onClick={copySummary} className="btn-outline min-h-11">
              {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopy aria-hidden="true" className="h-4 w-4" />}
              {c.title?.trim() || "Copy my results"}
            </button>
            <span role="status" aria-live="polite" className="text-sm text-ink-soft">
              {copied ? "Copied to your clipboard" : ""}
            </span>
          </div>
        );

      case "email_results":
        if (preview) {
          return (
            <Block key={c.id} id={c.id} title={heading("Email your results")}>
              <Alert tone="info">Participants who agree to it receive a summary by email. They see the real delivery status here, and can retry if it fails.</Alert>
            </Block>
          );
        }
        if (!email || !email.enabled || !token) return null;
        return (
          <Block key={c.id} id={c.id} title={heading("Email your results")}>
            <EmailResultsPanel token={token} email={email} onChange={(patch) => setEmail((prev) => (prev ? { ...prev, ...patch } : prev))} />
          </Block>
        );

      default:
        return null;
    }
  }

  const blocks = config.components.filter((c) => c.enabled).map((c) => ({ c, node: render(c) }));
  const visible = blocks.filter((b) => b.node);
  const hasScoreComponent = config.components.some((c) => c.enabled && c.type === "overall_score");

  return (
    <div className={styles.fadeIn}>
      {preview && (
        <Alert tone="warning" className="mb-6">
          <strong>Preview.</strong> This is how participants will see their results. Nothing here is saved or emailed.
        </Alert>
      )}

      {/* The logo file has a white background, so it sits on a white card like the form sheet. */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-primary/10 bg-surface">
        <div className="flex justify-center px-6 py-5">
          <BrandLogo className="w-44 sm:w-56" />
        </div>
        <div aria-hidden="true" className="h-3 bg-primary-dark sm:h-4" />
      </div>

      <header className="mb-8">
        <p className="eyebrow">{resultEyebrow(config, title)}</p>
        <h1 className="mt-2 text-4xl text-primary-dark sm:text-5xl">
          {headlineParts(config.headline, firstName, result.zone?.label).map((part, i) =>
            part.emphasis ? (
              <em key={i} className="text-accent-ink">
                {part.text}
              </em>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          {firstName ? `Hi ${firstName}, here` : "Here"} is your summary
          {completedAt && formatDate(completedAt) ? ` from ${formatDate(completedAt)}` : ""}.
        </p>
        {!preview && token && config.reportDownload !== false && (
          <div className={cx("mt-5 flex flex-wrap items-center gap-x-4 gap-y-2", styles.noPrint)}>
            <button type="button" onClick={saveReport} disabled={savingReport} className="btn-primary min-h-11">
              <Download aria-hidden="true" className="h-4 w-4" />
              {savingReport ? "Preparing your report…" : "Download PDF report"}
            </button>
            <span className="text-sm text-ink-soft">A copy of this result to keep or share.</span>
            {reportError && (
              <Alert tone="error" className="w-full">
                {reportError}
              </Alert>
            )}
          </div>
        )}
      </header>

      {/* Support messages (for example crisis contacts) come first and cannot be switched off in the Results tab. */}
      {contentOf(result, ["support"]).map((item) => (
        <aside key={item.id} aria-label={item.title || "Support"} className="mb-6 rounded-2xl border border-accent-ink/30 border-l-4 border-l-accent-ink bg-[#FBEEE5] p-5 sm:p-6">
          {item.title && <p className="font-display text-xl text-primary-dark">{item.title}</p>}
          <Paragraphs text={item.text} className={cx("text-ink", item.title && "mt-2")} />
        </aside>
      ))}

      {!result.scored && hasScoreComponent && (
        <Alert tone="info" className="mb-6">
          Thank you — your answers were recorded, but this self-check didn&apos;t produce a score from them.
        </Alert>
      )}

      <div className={cx("space-y-6", styles.stagger)}>{visible.map((b) => b.node)}</div>

      {visible.length === 0 && <Alert tone="info">There&apos;s nothing to show here yet.</Alert>}

      {config.disclaimer && (
        <p className="mt-10 border-t border-primary/15 pt-5 text-sm leading-relaxed text-ink-soft">{config.disclaimer}</p>
      )}
    </div>
  );
}
