import Link from "next/link";
import AssessmentLibrary from "@/components/assessments/AssessmentLibrary";
import { PageBrand } from "@/components/assessments/FormBrand";
import { listPublished } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import type { PublicSummary } from "@/lib/assessments/types";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

// Rebuilt at most once a minute, so new or unpublished assessments show up quickly.
export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Self-Assessments",
  description: "Self-assessments by Chaitanya Raj.",
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
          { name: "Self-Assessments", path: "/assessments" },
        ]}
      />
      <PageBrand />
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <h1 className="sr-only">Self-Assessments</h1>
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
      </section>
    </>
  );
}
