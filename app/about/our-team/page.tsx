import { notFound } from "next/navigation";
import Section from "@/components/Section";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { team } from "@/lib/data/about";

export const metadata = buildMetadata({
  title: "Our Team",
  description:
    "The team at Chaitanya Raj Psychology & Counselling, led by founder Lt Col Rajesh Sharma (Retd), offering counselling in Vashi and CBD Belapur, Navi Mumbai.",
  path: "/about/our-team",
  // Team details are still placeholders; keep the page out of search results
  // until real names, roles and bios are added in lib/data/about.ts.
  noIndex: true
});

// Hidden on request: the page returns 404 and is left out of the sitemap
// and navigation. Set this to true to publish it again.
const PAGE_VISIBLE = false;

export default function OurTeamPage() {
  if (!PAGE_VISIBLE) notFound();

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }, { name: "Our Team", path: "/about/our-team" }]} />
      <Section eyebrow="About" title="Our Team" titleAs="h1">
        <div className="grid sm:grid-cols-2 gap-6">
          {team.map((member) => (
            <div key={member.name} className="card p-6">
              <p className="text-xl font-display text-primary-dark">{member.name}</p>
              <p className="eyebrow mt-1 mb-3">{member.role}</p>
              <p className="text-ink-soft leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-soft mt-6">
          Placeholder entries — replace with real team member names, roles, and bios before launch.
        </p>
      </Section>
    </>
  );
}
