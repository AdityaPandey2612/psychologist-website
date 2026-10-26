import Link from "next/link";
import AssessmentLibrary from "@/components/assessments/AssessmentLibrary";
import Section from "@/components/Section";
import { listPublished } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import type { PublicSummary } from "@/lib/assessments/types";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

// Rebuilt at most once a minute, so new or unpublished assessments show up quickly.
export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Self-Checks for Self-Reflection",
  description:
    "Short, guided self-check assessments on listening, communication and personal growth, with personalised results. Free, no account needed.",
  path: "/assessments",
});

async function load(): Promise<{ items: PublicSummary[]; unavailable: boolean }> {
  try {
    return { items: await listPublished(await getStore()), unavailable: false };
  } catch (error) {
    console.warn("[assessments] Library unavailable:", error instanceof Error ? error.message : "unknown error");
    return { items: [], unavailable: true };
  }
}

export default async function AssessmentsPage() {
  const { items, unavailable } = await load();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Self-checks", path: "/assessments" },
        ]}
      />
      <Section eyebrow="Self-reflection" title="Self-checks" titleAs="h1">
        <p className="-mt-4 mb-10 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Short, guided self-checks to help you reflect on how you listen, communicate and relate to others. Each one needs no account, takes a few minutes and ends with personalised results.
          They are tools for self-reflection — not a diagnosis, and not a substitute for professional support.
        </p>

        {unavailable ? (
          <div className="card mx-auto max-w-xl p-8 text-center">
            <h2 className="text-2xl text-primary-dark">Self-checks aren&apos;t available right now</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">Something went wrong while loading them. Please try again in a few minutes.</p>
            <Link href="/contact" className="btn-outline mt-6 min-h-11">
              Contact us
            </Link>
          </div>
        ) : (
          <AssessmentLibrary assessments={items} />
        )}
      </Section>
    </>
  );
}
