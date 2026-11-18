import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { FormHeader, IntroHighlights, NoticeBox } from "@/components/assessments/FormBrand";
import Section from "@/components/Section";
import { getPublishedBySlug, listPublished } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import { fillTokens } from "@/lib/assessments/text";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

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
  if (!found) {
    return buildMetadata({ title: "Self-check", description: "This self-check isn't available right now.", path: `/assessments/${params.slug}`, noIndex: true });
  }
  return buildMetadata({
    title: found.summary.title,
    description: found.summary.description,
    path: `/assessments/${found.summary.slug}`,
  });
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className={`whitespace-pre-line leading-relaxed ${className ?? ""}`}>
            {p}
          </p>
        ))}
    </>
  );
}

export default async function AssessmentDetailPage({ params }: Params) {
  const { found, unavailable } = await load(params.slug);

  if (unavailable) {
    return (
      <Section eyebrow="Self-checks" title="This self-check isn't available right now" titleAs="h1">
        <p className="max-w-xl leading-relaxed text-ink-soft">Something went wrong while loading it. Please try again in a few minutes.</p>
        <Link href="/assessments" className="btn-outline mt-6 min-h-11">
          Back to self-checks
        </Link>
      </Section>
    );
  }
  if (!found) notFound();

  const { summary, version } = found;
  const def = version.definition;
  const startHref = `/assessments/${summary.slug}/start`;
  // Same {{minutes}} / {{questions}} / {{sections}} values the form uses for the introduction text.
  const tokens = {
    minutes: summary.estimatedMinutes,
    questions: def.sections.flatMap((s) => s.questions).filter((q) => q.type !== "info").length,
    sections: def.sections.length,
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Self-Assessments", path: "/assessments" },
          { name: summary.title, path: `/assessments/${summary.slug}` },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/assessments" className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline">
          ← All self-checks
        </Link>
        <h1 className="sr-only">{summary.title}</h1>
        {/* Only what the practice's own document says: title, subtitle, introduction, highlights and the disclaimer. */}
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-[0_1px_2px_rgba(18,58,54,0.05)]">
          <FormHeader title={summary.title} subtitle={fillTokens(def.intro.subtitle ?? "", tokens)} badge={def.intro.badge ?? ""} />
          <div className="px-5 pb-8 pt-6 max-sm:pr-14 sm:px-8">
            {def.intro.body && (
              <div className="space-y-3 text-ink">
                <Paragraphs text={def.intro.body} />
              </div>
            )}
            {(def.intro.highlights?.length ?? 0) > 0 && (
              <div className="mt-6">
                <IntroHighlights items={def.intro.highlights} vars={tokens} />
              </div>
            )}
            {def.intro.disclaimer?.trim() && (
              <div className="mt-5">
                <NoticeBox>{fillTokens(def.intro.disclaimer, tokens)}</NoticeBox>
              </div>
            )}
            <Link href={startHref} className="btn-primary mt-8 min-h-11 w-full sm:w-auto">
              Start self-check
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
