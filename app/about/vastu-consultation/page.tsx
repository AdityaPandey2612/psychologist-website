import Section from "@/components/Section";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { vastuConsultation } from "@/lib/data/about";

export const metadata = buildMetadata({
  title: "Vastu Consultation in Navi Mumbai",
  description:
    "Vastu consultation offered at Chaitanya Raj in Navi Mumbai as a complementary service alongside psychological support, never as a substitute for clinical care.",
  path: "/about/vastu-consultation"
});

// Hidden on request: the page returns 404 and is left out of the sitemap
// and navigation. Set this to true to publish it again.
const PAGE_VISIBLE = false;

export default function VastuConsultationPage() {
  if (!PAGE_VISIBLE) notFound();

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }, { name: "Vastu Consultation", path: "/about/vastu-consultation" }]} />
      <Section eyebrow="About" title="Vastu Consultation" titleAs="h1">
        <div className="max-w-2xl space-y-8">
          <p className="text-lg text-ink-soft leading-relaxed">{vastuConsultation.intro}</p>
          <div>
            <h2 className="text-xl mb-3">What to expect</h2>
            <ul className="space-y-2">
              {vastuConsultation.whatToExpect.map((s) => (
                <li key={s} className="flex gap-3 text-ink-soft">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/contact" className="btn-primary inline-flex">Enquire</Link>
        </div>
      </Section>
    </>
  );
}
