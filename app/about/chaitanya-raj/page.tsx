import Section from "@/components/Section";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/data/site";
import { founder } from "@/lib/data/about";

export const metadata = buildMetadata({
  title: "Our Mission and Approach to Therapy",
  description:
    "Chaitanya Raj Psychology & Counselling combines structured, evidence-based talk therapy with clinical hypnotherapy in Vashi and CBD Belapur, Navi Mumbai.",
  path: "/about/chaitanya-raj"
});

const approaches = founder.sections.find((s) => s.title === "Our Approach")?.points ?? [];

export default function ChaitanyaRajPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }, { name: "Chaitanya Raj", path: "/about/chaitanya-raj" }]} />
      <Section eyebrow="About" title="Chaitanya Raj" titleAs="h1">
        <div className="max-w-2xl space-y-6 text-ink-soft text-lg leading-relaxed">
          <p>
            {site.name} is a psychology and counselling practice based in {site.address.locality},
            combining evidence-based talk therapy with clinical hypnotherapy and specialised
            technique for clients who need it.
          </p>
          <p>
            The practice was built on the belief that structure and warmth aren&apos;t opposites —
            that a disciplined, methodical approach to therapy is what makes space for real
            change to happen at an unhurried, human pace.
          </p>
          <p>
            Sessions take place at our clinics in Vashi and CBD Belapur, Navi Mumbai, and{" "}
            <Link href="/online-therapy-international-clients" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
              online
            </Link>{" "}
            for clients who prefer to work remotely. The practice is led by{" "}
            <Link href="/about/the-founder" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
              {site.founder}
            </Link>
            .
          </p>

          {approaches.length > 0 && (
            <div>
              <h2 className="text-xl mb-3">Approaches we use</h2>
              <ul className="space-y-2 text-base">
                {approaches.map((approach) => (
                  <li key={approach} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{approach}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-base">
                See{" "}
                <Link href="/therapies" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                  how each therapy works
                </Link>{" "}
                and the{" "}
                <Link href="/conditions" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                  conditions we help with
                </Link>
                .
              </p>
            </div>
          )}

          <Link href="/contact" className="btn-primary inline-flex mt-4">Book a consultation</Link>
        </div>
      </Section>
    </>
  );
}
