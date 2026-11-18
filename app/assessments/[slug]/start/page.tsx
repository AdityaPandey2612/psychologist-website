import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import AssessmentForm from "@/components/assessments/AssessmentForm";
import { toPublicForm } from "@/lib/assessments/definition";
import { isMailConfigured } from "@/lib/assessments/server/mail";
import { getPublishedBySlug, listPublished } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import { buildMetadata } from "@/lib/seo/metadata";

// Cached for a minute (and refreshed at once when an assessment is published or unpublished), so Start opens instantly.
// A person who still has an older form open submits against the version they were shown.
export const revalidate = 60;

/**
 * Lists the published assessments so their pages are built ahead of time and cached. Without this, Next renders a
 * dynamic-route page on every request and a click on "Start" waits on the database each time. A slug published later
 * is still rendered on first visit and cached from then on.
 */
export async function generateStaticParams() {
  try {
    return (await listPublished(await getStore())).map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

type Params = { params: { slug: string } };

const load = cache(async (slug: string) => {
  try {
    return { found: await getPublishedBySlug(await getStore(), slug), unavailable: false };
  } catch (error) {
    console.warn("[assessments] Assessment unavailable:", error instanceof Error ? error.message : "unknown error");
    return { found: null, unavailable: true };
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { found } = await load(params.slug);
  return buildMetadata({
    title: found ? `Take the ${found.summary.title}` : "Self-check",
    description: found?.summary.description ?? "Self-reflection assessment.",
    path: `/assessments/${params.slug}/start`,
    noIndex: true,
  });
}

export default async function StartAssessmentPage({ params }: Params) {
  const { found, unavailable } = await load(params.slug);

  if (unavailable) {
    return (
      <section className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-3xl text-primary-dark">This self-check isn&apos;t available right now</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">Something went wrong while loading it. Please try again in a few minutes.</p>
        <Link href="/assessments" className="btn-outline mt-6 min-h-11">
          Back to self-checks
        </Link>
      </section>
    );
  }
  if (!found) notFound();

  const { summary, version } = found;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href={`/assessments/${summary.slug}`} className="mb-5 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-dark hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        About this self-check
      </Link>
      <h1 className="sr-only">{summary.title}</h1>
      <AssessmentForm
        assessment={{ id: summary.id, slug: summary.slug, title: summary.title, estimatedMinutes: summary.estimatedMinutes }}
        version={version.version}
        form={toPublicForm(version.definition, { emailAvailable: isMailConfigured() })}
      />
    </div>
  );
}
