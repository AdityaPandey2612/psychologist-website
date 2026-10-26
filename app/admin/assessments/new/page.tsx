"use client";

import { ArrowRight, ClipboardList, Ear, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminPage } from "@/components/assessments/admin/AdminPage";
import { Alert, Badge, FieldLabel, Spinner, cx, inputClass } from "@/components/assessments/ui";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  starter: boolean;
}

export default function NewAssessmentPage() {
  return (
    <AdminPage
      title="New assessment"
      description="Start from a blank form or from a ready-made starter. You can change everything afterwards, and nothing is public until you publish."
      back={{ href: "/admin/assessments", label: "All assessments" }}
    >
      <Chooser />
    </AdminPage>
  );
}

function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 503) {
      return `${error.message} Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY) on the server — see docs/ASSESSMENTS.md.`;
    }
    if (error.status === 401) return "Your sign-in has expired. Please sign in again.";
    if (error.status === 403) return "This account isn’t allowed to manage assessments.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function Chooser() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ templates: TemplateInfo[] }>("/api/admin/assessments")
      .then((data) => !cancelled && setTemplates(data.templates))
      .catch((e: unknown) => !cancelled && setLoadError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(templateId: string) {
    if (creating) return;
    setCreating(templateId);
    setError(null);
    try {
      const { assessment } = await adminFetch<{ assessment: { id: string } }>("/api/admin/assessments", {
        method: "POST",
        json: { templateId, title: title.trim() || undefined },
      });
      router.replace(`/admin/assessments/${assessment.id}/edit`);
    } catch (e) {
      setError(describeError(e));
      setCreating(null);
    }
  }

  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!templates) {
    return (
      <p className="flex items-center gap-3 text-ink-soft">
        <Spinner label="Loading templates" /> Loading templates…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <FieldLabel htmlFor="new-title" optional>
          Title
        </FieldLabel>
        <input
          id="new-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leave blank to use the template’s title"
          className={cx(inputClass, "mt-1.5")}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <ul className="grid gap-5 md:grid-cols-2">
        {templates.map((t) => {
          const Icon = t.id === "blank" ? ClipboardList : t.id === "charisma-diagnostic" ? Sparkles : Ear;
          const busy = creating === t.id;
          return (
            <li key={t.id} className="card flex flex-col gap-4 p-6">
              <div className="flex items-start gap-4">
                <span className="icon-tile tone-teal">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl text-primary-dark">{t.name}</h2>
                  {t.starter && (
                    <div className="mt-1">
                      <Badge tone="gold">Starter content</Badge>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">{t.description}</p>
              {t.starter && (
                <Alert tone="warning">
                  The questions, scoring weights and level thresholds are <strong>editable starting points</strong>, not a professionally validated questionnaire. Review and adapt everything before you publish.
                </Alert>
              )}
              <button
                type="button"
                onClick={() => create(t.id)}
                disabled={creating !== null}
                className="btn-primary mt-auto self-start px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busy ? <Spinner label="Creating" className="h-4 w-4" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                {busy ? "Creating…" : t.id === "blank" ? "Start blank" : "Use this template"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
