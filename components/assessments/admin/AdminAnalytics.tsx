"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import type { AdminViewMode, EmailStatus } from "@/lib/assessments/types";
import { Alert, Badge, Spinner } from "@/components/assessments/ui";
import { AdminPage } from "./AdminPage";
import { formatDate, type SubmissionRow } from "./DashboardTypes";
import { EMAIL_STATUS_LABEL } from "./ResultEmailStatus";
import { StatCard } from "./StatCard";
import { BarChart, CHART_COLORS, ChartCard, HBarList } from "./StatCharts";

interface AnalyticsData {
  totals: { submissions: number; starts: number; completionRate: number | null; averageScore: number | null; consentedToShare: number };
  distribution: Array<{ range: string; count: number }>;
  skills: Array<{ id: string; name: string; average: number; responses: number }>;
  emailStatus: Record<EmailStatus, number>;
  byDay: Array<{ date: string; count: number }>;
  versions: Array<{ version: number; count: number }>;
  privacyMode: AdminViewMode;
  recent: SubmissionRow[];
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const EMAIL_ORDER: EmailStatus[] = ["sent", "failed", "pending", "not_configured", "not_requested"];
const EMAIL_COLORS: Record<EmailStatus, string> = {
  sent: CHART_COLORS.primary,
  failed: CHART_COLORS.accent,
  pending: CHART_COLORS.gold,
  not_configured: CHART_COLORS.gold,
  not_requested: "#9BB5AE",
};

/** Per-assessment analytics: totals, score distribution, activity, skills, email delivery and versions. */
export function AdminAnalytics({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [analytics, assessment] = await Promise.all([
        adminFetch<AnalyticsData>(`/api/admin/assessments/${id}/analytics`),
        adminFetch<{ assessment: { title: string } }>(`/api/admin/assessments/${id}`).catch(() => null),
      ]);
      setData(analytics);
      if (assessment) setTitle(assessment.assessment.title);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailTotal = data ? EMAIL_ORDER.reduce((s, k) => s + data.emailStatus[k], 0) : 0;
  const dayTotal = data?.byDay.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <AdminPage
      wide
      title="Analytics"
      description={title ? `Anonymous totals for “${title}”.` : undefined}
      back={{ href: "/admin/assessments", label: "All assessments" }}
      actions={
        <Link href={`/admin/assessments/${id}/submissions`} className="btn-outline px-5 py-2 text-sm">
          Submissions
        </Link>
      }
    >
      {loading && !data && (
        <p className="flex items-center gap-2 text-ink-soft">
          <Spinner label="Loading analytics" /> Loading analytics…
        </p>
      )}
      {error && (
        <Alert tone="error">
          {error}{" "}
          <button type="button" className="font-semibold underline" onClick={load}>
            Try again
          </button>
        </Alert>
      )}

      {data && (
        <div className="space-y-6">
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Submissions" value={data.totals.submissions} hint="Completed responses" />
            <StatCard label="Starts" value={data.totals.starts} hint="People who began" />
            <StatCard label="Completion rate" value={data.totals.completionRate === null ? "—" : `${data.totals.completionRate}%`} hint="Submissions ÷ starts" />
            <StatCard label="Average score" value={data.totals.averageScore ?? "—"} hint="Out of 100" />
            <StatCard label="Agreed to share" value={data.totals.consentedToShare} hint="With the practice" />
          </section>
          <p className="text-sm text-ink-soft">
            Starts are an anonymous counter taken when someone presses “Begin”; the same person may start more than once or return later, so treat the completion rate as an estimate. Charts contain only totals — no names or answers.
          </p>

          {data.totals.submissions === 0 ? (
            <p className="rounded-2xl bg-surface px-6 py-10 text-center text-ink-soft">No submissions yet — charts will appear after the first response.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Score distribution"
                description="How many participants scored in each ten-point band."
                table={{ caption: "Score distribution", columns: ["Score range", "Participants"], rows: data.distribution.map((d) => [d.range, d.count]) }}
              >
                <BarChart
                  data={data.distribution.map((d) => ({ label: d.range.replace("–", "-"), value: d.count }))}
                  ariaLabel={`Score distribution: ${data.distribution.map((d) => `${d.range}: ${d.count}`).join(", ")}`}
                  unit="participants"
                />
              </ChartCard>

              <ChartCard
                title="Submissions per day"
                description={`The last 30 days · ${dayTotal} submission${dayTotal === 1 ? "" : "s"}.`}
                table={{ caption: "Submissions per day", columns: ["Date", "Submissions"], rows: data.byDay.map((d) => [dayLabel(d.date), d.count]) }}
              >
                <BarChart
                  data={data.byDay.map((d) => ({ label: dayLabel(d.date), value: d.count }))}
                  ariaLabel={`Submissions per day over the last 30 days, ${dayTotal} in total`}
                  unit="submissions"
                  labelEvery={7}
                  showValues={false}
                  color={CHART_COLORS.accent}
                />
              </ChartCard>

              {data.skills.length > 0 && (
                <ChartCard
                  title="Average score per skill"
                  description="Across all scored submissions (0–100)."
                  table={{ caption: "Average score per skill", columns: ["Skill", "Average"], rows: data.skills.map((s) => [s.name, s.average]) }}
                >
                  <HBarList items={data.skills.map((s) => ({ label: s.name, value: s.average }))} max={100} />
                </ChartCard>
              )}

              <ChartCard
                title="Email delivery"
                description="“Sent” means the mail server accepted the message for delivery — not that it reached an inbox."
                table={{ caption: "Email delivery status", columns: ["Status", "Submissions"], rows: EMAIL_ORDER.map((k) => [EMAIL_STATUS_LABEL(k), data.emailStatus[k]]) }}
              >
                <ul className="space-y-3">
                  {EMAIL_ORDER.map((k) => (
                    <li key={k}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-primary-dark">{EMAIL_STATUS_LABEL(k)}</span>
                        <span className="font-semibold text-primary-dark">{data.emailStatus[k]}</span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${emailTotal ? (data.emailStatus[k] / emailTotal) * 100 : 0}%`, background: EMAIL_COLORS[k] }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {data.emailStatus.failed + data.emailStatus.not_configured > 0 && (
                  <p className="mt-3 text-sm text-accent-ink">
                    Some emails weren’t delivered. You can retry them from{" "}
                    <Link href={`/admin/assessments/${id}/submissions`} className="font-semibold underline">
                      Submissions
                    </Link>
                    .
                  </p>
                )}
              </ChartCard>

              <ChartCard
                title="Responses by version"
                description="Each response stays tied to the version of the assessment the person answered, even after you publish changes."
                table={{ caption: "Responses by version", columns: ["Version", "Responses"], rows: data.versions.map((v) => [`Version ${v.version}`, v.count]) }}
              >
                <HBarList items={data.versions.map((v) => ({ label: `Version ${v.version}`, value: v.count }))} color={CHART_COLORS.dark} />
              </ChartCard>

              <section className="card p-5 sm:p-6">
                <h2 className="text-xl text-primary-dark">Recent submissions</h2>
                {data.privacyMode === "none" ? (
                  <p className="mt-3 text-sm text-ink-soft">Individual submissions are switched off for this assessment (Settings → Privacy).</p>
                ) : data.recent.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">Nothing to show.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-primary/10">
                    {data.recent.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary-dark">{r.name ?? "Anonymous participant"}</p>
                          <p className="text-ink-soft">{formatDate(r.createdAt, true)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.overall !== null && <span className="font-semibold text-primary-dark">{r.overall}</span>}
                          {r.level && <Badge>{r.level}</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </AdminPage>
  );
}
