"use client";

import { useEffect, useState } from "react";
import { AdminPage } from "@/components/assessments/admin/AdminPage";
import { AdminAssessmentBuilder, type BuilderInitial } from "@/components/assessments/admin/AdminAssessmentBuilder";
import { Alert, Spinner } from "@/components/assessments/ui";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";

export default function EditAssessmentPage({ params }: { params: { id: string } }) {
  return (
    <AdminPage
      title="Edit assessment"
      description="Changes are saved as a draft. Visitors only see a new version when you publish."
      back={{ href: "/admin/assessments", label: "All assessments" }}
      wide
    >
      <Loader id={params.id} />
    </AdminPage>
  );
}

// Rendered inside AdminPage so the request only starts once the sign-in check has passed.
function Loader({ id }: { id: string }) {
  const [initial, setInitial] = useState<BuilderInitial | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch<BuilderInitial>(`/api/admin/assessments/${encodeURIComponent(id)}`)
      .then((data) => !cancelled && setInitial(data))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError(
            e.status === 404
              ? "We couldn’t find that assessment. It may have been deleted."
              : e.status === 503
                ? `${e.message} Check the server’s Firebase Admin settings (see docs/ASSESSMENTS.md).`
                : e.message,
          );
        } else setError("Couldn’t load the assessment. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!initial) {
    return (
      <p className="flex items-center gap-3 text-ink-soft">
        <Spinner label="Loading assessment" /> Loading assessment…
      </p>
    );
  }
  return <AdminAssessmentBuilder initial={initial} />;
}
