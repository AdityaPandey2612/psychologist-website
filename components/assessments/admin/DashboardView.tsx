"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import { Alert, Badge, Spinner } from "@/components/assessments/ui";
import { AdminAssessmentList, type ListNotice } from "./AdminAssessmentList";
import { CategoryManager } from "./CategoryManager";
import { formatDate, type DashboardData } from "./DashboardTypes";
import { StatCard } from "./StatCard";

const STARTER_ID = "listening-self-reflection";

function SetupBanners({ data }: { data: DashboardData }) {
  const { setup, admin } = data;
  return (
    <div className="space-y-3">
      {setup.storage === "file" && (
        <Alert tone="warning">
          <p className="font-semibold">Using a local development file store</p>
          <p className="mt-1">
            Assessments and responses are saved to a file on this computer, which does <strong>not</strong> persist on Vercel.
            {!setup.firebaseAdminConfigured && (
              <>
                {" "}
                To store data in Firestore, set <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> (or <code>FIREBASE_ADMIN_CLIENT_EMAIL</code> and <code>FIREBASE_ADMIN_PRIVATE_KEY</code>) on the server.
              </>
            )}
          </p>
        </Alert>
      )}
      {!setup.emailConfigured && (
        <Alert tone="warning">
          <p className="font-semibold">Email is switched off (no mail credentials)</p>
          <p className="mt-1">
            Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>MAIL_FROM</code> on the server. Until then the “email my results” option is not shown to participants and no
            email is attempted; everyone sees their results on screen.
          </p>
        </Alert>
      )}
      {admin.access === "any-signed-in" && (
        <Alert tone="info">
          <p className="font-semibold">Any signed-in admin account can manage assessments and see submissions</p>
          <p className="mt-1">
            This matches the rest of the admin area. To restrict it, set <code>ASSESSMENT_ADMIN_EMAILS</code> to a comma-separated list of allowed email addresses.
          </p>
        </Alert>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading assessments" className="animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-surface" />
      <div className="h-40 rounded-2xl bg-surface" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notConfigured = error instanceof ApiClientError && (error.code === "not_configured" || error.status === 503);
  const authProblem = error instanceof ApiClientError && (error.status === 401 || error.status === 403);
  return (
    <Alert tone="error" className="space-y-3">
      <p className="font-semibold">{authProblem ? "You can’t open the assessment area" : notConfigured ? "Assessment storage isn’t set up" : "Couldn’t load assessments"}</p>
      <p>{error instanceof ApiClientError ? error.message : "Something went wrong while loading. Please try again."}</p>
      {notConfigured && (
        <p>
          In production, set <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> (a Firebase service-account key) — or <code>FIREBASE_ADMIN_CLIENT_EMAIL</code> and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> — in the hosting environment, then
          redeploy.
        </p>
      )}
      {authProblem && <p>If you expected access, ask the site owner to add your email to <code>ASSESSMENT_ADMIN_EMAILS</code>.</p>}
      <button type="button" onClick={onRetry} className="btn-outline px-4 py-2 text-sm">
        Try again
      </button>
    </Alert>
  );
}

/** The /admin/assessments dashboard: setup status, totals, the assessment list, activity and categories. */
export function DashboardView() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<ListNotice | null>(null);
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminFetch<DashboardData>("/api/admin/assessments"));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of data?.assessments ?? []) counts[a.category] = (counts[a.category] ?? 0) + 1;
    return counts;
  }, [data]);

  async function installStarter() {
    setInstalling(true);
    setNotice(null);
    try {
      const res = await adminFetch<{ assessment: { id: string } }>("/api/admin/assessments", { method: "POST", json: { templateId: STARTER_ID } });
      router.push(`/admin/assessments/${res.assessment.id}/edit`);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't install the starter template. Please try again." });
      setInstalling(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error || !data) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  }

  const { totals } = data.overview;
  const maxSubmissions = Math.max(1, ...data.overview.perAssessment.map((a) => a.submissions));
  const hasStarter = data.assessments.some((a) => a.templateId === STARTER_ID);

  return (
    <div className="space-y-8">
      <SetupBanners data={data} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/assessments/new" className="btn-primary">
          <Plus aria-hidden="true" className="h-4 w-4" />
          New assessment
        </Link>
        <button type="button" onClick={installStarter} disabled={installing} className="btn-outline disabled:opacity-60">
          {installing ? <Spinner label="Installing the starter template" className="h-4 w-4" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
          {hasStarter ? "Add another Listening Self-Reflection starter" : "Install Listening Self-Reflection starter"}
        </button>
        <p className="text-sm text-ink-soft">The starter is installed as an editable draft — review it before publishing.</p>
      </div>

      {notice && (
        <Alert tone={notice.tone}>
          {notice.text}{" "}
          {notice.href && (
            <Link href={notice.href} className="font-semibold underline">
              {notice.linkLabel ?? "Open"}
            </Link>
          )}
        </Alert>
      )}

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assessments" value={totals.assessments} hint={totals.archived ? `${totals.archived} archived` : undefined} />
        <StatCard label="Published" value={totals.published} hint="Visible in the public library" />
        <StatCard label="Drafts" value={totals.drafts} hint="Not public yet" />
        <StatCard label="Submissions" value={totals.submissions} hint="Completed responses" />
      </section>

      <section aria-labelledby="assessments-heading">
        <h2 id="assessments-heading" className="mb-4 text-2xl text-primary-dark">
          Your assessments
        </h2>
        <AdminAssessmentList assessments={data.assessments} onChanged={load} onNotice={setNotice} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="by-assessment-heading" className="card p-5 sm:p-6">
          <h2 id="by-assessment-heading" className="text-xl text-primary-dark">
            Submissions by assessment
          </h2>
          {data.overview.perAssessment.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Nothing to show yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[...data.overview.perAssessment]
                .sort((a, b) => b.submissions - a.submissions)
                .map((a) => (
                  <li key={a.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={`/admin/assessments/${a.id}/analytics`} className="min-w-0 truncate font-medium text-primary-dark hover:underline">
                        {a.title}
                      </Link>
                      <span className="shrink-0 font-semibold text-primary-dark">{a.submissions}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(a.submissions / maxSubmissions) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading" className="card p-5 sm:p-6">
          <h2 id="recent-heading" className="text-xl text-primary-dark">
            Recent submissions
          </h2>
          {data.overview.recent.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No submissions yet, or listing is switched off for your assessments.</p>
          ) : (
            <ul className="mt-4 divide-y divide-primary/10">
              {data.overview.recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary-dark">{r.name ?? "Anonymous participant"}</p>
                    <p className="truncate text-ink-soft">
                      <Link href={`/admin/assessments/${r.assessmentId}/submissions`} className="hover:underline">
                        {r.assessmentTitle}
                      </Link>{" "}
                      · {formatDate(r.createdAt, true)}
                    </p>
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

      <CategoryManager categories={data.categories} usage={usage} onSaved={(categories) => setData((d) => (d ? { ...d, categories } : d))} />
    </div>
  );
}
