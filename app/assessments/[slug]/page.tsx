import { ArrowRight, Clock, ListChecks, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AssessmentIcon, Badge } from "@/components/assessments/ui";
import Section from "@/components/Section";
import { sharingOffered } from "@/lib/assessments/definition";
import { isMailConfigured } from "@/lib/assessments/server/mail";
import { getPublishedBySlug } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 60;

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

  const privacy = [
    "No account is needed. We ask for your name and email so your results can be shown to you.",
    "Your answers are used to calculate your results and aren't shown publicly. Your results appear on a private link that only you have.",
    def.email.enabled && isMailConfigured() ? "You can choose to receive your results by email. It's optional, and your results stay on screen either way." : null,
    sharingOffered(def) ? "You may also choose to share your results with the practice. This is optional and off unless you tick it." : null,
    def.peer.enabled ? "Optionally, you can invite someone you trust for their view. Their answers are anonymous and shown to you only as an average." : null,
    "Answers are saved on your own device as you go, so you can pause and come back.",
  ].filter((x): x is string => Boolean(x));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Self-checks", path: "/assessments" },
          { name: summary.title, path: `/assessments/${summary.slug}` },
        ]}
      />
      <Section eyebrow={`Self-check · ${summary.categoryName}`} title={summary.title} titleAs="h1">
        <div className="-mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <p className="max-w-2xl text-lg leading-relaxed text-ink-soft">{summary.description}</p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <li className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" className="h-4 w-4" />
                About {summary.estimatedMinutes} minutes
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ListChecks aria-hidden="true" className="h-4 w-4" />
                Up to {summary.questionCount} question{summary.questionCount === 1 ? "" : "s"} in {summary.sectionCount} section{summary.sectionCount === 1 ? "" : "s"}
              </li>
              <li>
                <Badge tone={summary.tier === "premium" ? "gold" : "primary"}>{summary.tier === "premium" ? "Premium" : "Free"}</Badge>
              </li>
            </ul>

            <div className="card mt-8 p-6 sm:p-8">
              <h2 className="text-2xl text-primary-dark">What to expect</h2>
              <ol className="mt-4 space-y-3 leading-relaxed text-ink">
                <li className="flex gap-3">
                  <span aria-hidden="true" className="font-display text-primary">1.</span>
                  Enter your name and email, and choose what you&apos;re comfortable with.
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="font-display text-primary">2.</span>
                  Answer one short section at a time — you can go back and change answers.
                </li>
                <li className="flex gap-3">
                  <span aria-hidden="true" className="font-display text-primary">3.</span>
                  See your personalised results straight away{def.scoring.practicePlan.enabled ? ", including a practice plan" : ""}.
                </li>
              </ol>
              {def.intro.body && (
                <div className="mt-6 space-y-3 border-t border-primary/10 pt-6 text-ink">
                  <Paragraphs text={def.intro.body} />
                </div>
              )}
            </div>

            <div className="card mt-6 p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-2xl text-primary-dark">
                <Lock aria-hidden="true" className="h-5 w-5" />
                Your privacy
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-ink">
                {privacy.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                Read our{" "}
                <Link href="/privacy-policy" className="font-medium text-primary-dark underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </p>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-soft">{def.results.disclaimer}</p>
          </div>

          <aside aria-label="Start this self-check" className="card p-6 lg:sticky lg:top-28">
            <span className="icon-tile tone-teal">
              <AssessmentIcon name={summary.icon} />
            </span>
            <p className="mt-4 font-display text-xl text-primary-dark">Ready when you are</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">Find a quiet moment. There are no right or wrong answers.</p>
            <Link href={startHref} className="btn-primary mt-5 min-h-11 w-full">
              Start self-check
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-ink-soft">
              <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              Self-reflection only — not a diagnosis.
            </p>
          </aside>
        </div>

        <p className="mt-10">
          <Link href="/assessments" className="font-medium text-primary-dark underline underline-offset-4">
            ← All self-checks
          </Link>
        </p>
      </Section>
    </>
  );
}
