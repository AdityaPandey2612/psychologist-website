import { notFound } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import PracticeDetails from "@/components/PracticeDetails";
import { caseStudies, getCaseStudy } from "@/lib/data/caseStudies";
import { getCondition } from "@/lib/data/conditions";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const study = getCaseStudy(params.slug);
  if (!study) return {};
  return buildMetadata({
    title: study.metaTitle,
    description: study.metaDescription,
    path: `/case-studies/${study.slug}`
  });
}

// Approaches named in a case study's "Approach" text, linked to their pages.
const approachLinks = [
  { match: /\bCBT\b/, href: "/therapies/cognitive-behavioural-therapy", label: "Cognitive Behavioural Therapy (CBT)" },
  { match: /Ego State/i, href: "/therapies/ego-state-therapy", label: "Ego State Therapy" },
  { match: /Behaviour Modification/i, href: "/therapies/behaviour-modification-therapy", label: "Behaviour Modification Therapy" },
  { match: /Mindfulness/i, href: "/therapies/mindfulness-based-therapy", label: "Mindfulness-Based Therapy" },
  { match: /hypnotherapy/i, href: "/hypnotherapy-navi-mumbai", label: "Clinical hypnotherapy" }
];

// Blog posts on the same subject, written from a different angle.
const relatedReading: Record<string, { href: string; label: string }> = {
  "aversion-to-sex": { href: "/blog/aversion-to-sex", label: "Aversion to sex in marriage: a client's story" },
  "anxiety-and-depression": {
    href: "/blog/understanding-depression-signs-research-and-real-stories",
    label: "Understanding depression: signs, research and real stories"
  },
  "anger-management": { href: "/blog/dealing-with-aggressive-people", label: "Dealing with aggressive people" }
};

const linkClass = "inline-flex min-h-11 items-center font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink";

export default function CaseStudyPage({ params }: { params: { slug: string } }) {
  const study = getCaseStudy(params.slug);
  if (!study) notFound();
  const relatedCondition = getCondition(study.issue);
  const approaches = approachLinks.filter((a) => a.match.test(study.approach));
  const reading = relatedReading[study.slug];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Case Studies", path: "/case-studies" },
          { name: study.title, path: `/case-studies/${study.slug}` }
        ]}
      />
      <Section eyebrow="Case Study" title={study.title} titleAs="h1">
        <div className="max-w-2xl space-y-8">
          <div>
            <h2 className="text-xl mb-2">Presenting concern</h2>
            <p className="text-ink-soft leading-relaxed">{study.presentingConcern}</p>
          </div>
          <div>
            <h2 className="text-xl mb-2">Approach</h2>
            <p className="text-ink-soft leading-relaxed">{study.approach}</p>
          </div>
          <div>
            <h2 className="text-xl mb-2">Outcome</h2>
            <p className="text-ink-soft leading-relaxed">{study.outcome}</p>
          </div>

          <div>
            <h2 className="text-xl mb-2">Keep in mind</h2>
            <p className="text-ink-soft leading-relaxed">
              Every person&apos;s situation is different. This case describes one client&apos;s
              experience and is not a guarantee of a similar result; the right approach for you is
              agreed after an initial assessment.
            </p>
          </div>

          {(relatedCondition || approaches.length > 0 || reading) && (
            <div>
              <h2 className="text-xl mb-2">Related pages</h2>
              <ul className="text-ink-soft">
                {relatedCondition && (
                  <li>
                    <Link href={`/conditions/${relatedCondition.slug}`} className={linkClass}>
                      {relatedCondition.name}
                    </Link>
                  </li>
                )}
                {approaches.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className={linkClass}>
                      {a.label}
                    </Link>
                  </li>
                ))}
                {reading && (
                  <li>
                    <Link href={reading.href} className={linkClass}>
                      {reading.label}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          <p className="text-xs text-ink-soft">
            This case study has been anonymised. Identifying details have been changed or removed.
          </p>

          <PracticeDetails />

          <Link href="/contact" className="btn-primary inline-flex">Book a consultation</Link>
        </div>
      </Section>
    </>
  );
}
