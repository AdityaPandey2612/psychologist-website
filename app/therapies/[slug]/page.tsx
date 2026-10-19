import { notFound } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import PracticeDetails from "@/components/PracticeDetails";
import { therapies, getTherapy, type Therapy } from "@/lib/data/therapies";
import { getCondition } from "@/lib/data/conditions";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, TherapyJsonLd } from "@/lib/seo/jsonld";

export function generateStaticParams() {
  return therapies.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const therapy = getTherapy(params.slug);
  if (!therapy) return {};
  return buildMetadata({
    title: therapy.metaTitle,
    description: therapy.metaDescription,
    path: `/therapies/${therapy.slug}`
  });
}

// Other approaches of the same kind, preferring ones used for the same conditions.
function relatedTherapies(therapy: Therapy) {
  const sameKind = therapies.filter(
    (t) => t.slug !== therapy.slug && Boolean(t.complementary) === Boolean(therapy.complementary)
  );
  const overlap = (t: Therapy) => t.goodFor.filter((slug) => therapy.goodFor.includes(slug)).length;
  return [...sameKind].sort((a, b) => overlap(b) - overlap(a)).slice(0, 3);
}

export default function TherapyPage({ params }: { params: { slug: string } }) {
  const therapy = getTherapy(params.slug);
  if (!therapy) notFound();

  const related = relatedTherapies(therapy);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Therapies", path: "/therapies" },
          { name: therapy.name, path: `/therapies/${therapy.slug}` }
        ]}
      />
      <TherapyJsonLd
        name={therapy.name}
        description={therapy.metaDescription}
        path={`/therapies/${therapy.slug}`}
        complementary={therapy.complementary}
      />
      <Section eyebrow="Therapy" title={therapy.heading ?? therapy.name} titleAs="h1">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            <p className="text-lg text-ink-soft leading-relaxed">{therapy.intro}</p>

            {therapy.complementary && (
              <p className="rounded-lg border border-primary/15 bg-surface-soft/50 p-4 text-ink-soft leading-relaxed">
                {therapy.name} is offered as a complementary approach. It is not a substitute for
                evidence-based psychological or medical treatment, and it is only offered after an
                honest conversation about what it involves.
              </p>
            )}

            <div>
              <h2 className="text-xl mb-3">What to expect</h2>
              <ul className="space-y-2">
                {therapy.whatToExpect.map((s) => (
                  <li key={s} className="flex gap-3 text-ink-soft">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {therapy.slug === "couples-and-relationship-counselling" && (
              <p className="text-ink-soft leading-relaxed">
                Ready to book? Our{" "}
                <Link href="/couples-counselling-navi-mumbai" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                  couples counselling in Navi Mumbai
                </Link>{" "}
                page covers session formats, our Vashi and CBD Belapur clinics, and online sessions for
                couples living apart.
              </p>
            )}

            <PracticeDetails />

            <Link href="/contact" className="btn-primary inline-flex">
              Book a consultation
            </Link>
          </div>

          <div className="space-y-6 h-fit">
            {therapy.goodFor.length > 0 && (
              <aside className="card p-6" aria-labelledby="often-used-for">
                <h2 id="often-used-for" className="eyebrow mb-4">Often used for</h2>
                <ul className="space-y-1">
                  {therapy.goodFor.map((slug) => {
                    const condition = getCondition(slug);
                    if (!condition) return null;
                    return (
                      <li key={slug}>
                        <Link
                          href={`/conditions/${slug}`}
                          className="inline-flex min-h-11 items-center text-primary-dark hover:text-accent-ink font-medium"
                        >
                          {condition.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}

            {related.length > 0 && (
              <aside className="card p-6" aria-labelledby="related-approaches">
                <h2 id="related-approaches" className="eyebrow mb-4">Related approaches</h2>
                <ul className="space-y-1">
                  {related.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/therapies/${t.slug}`}
                        className="inline-flex min-h-11 items-center text-primary-dark hover:text-accent-ink font-medium"
                      >
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
