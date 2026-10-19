import Link from "next/link";
import type { Metadata } from "next";
import Section from "@/components/Section";
import { site } from "@/lib/data/site";

// Next.js adds a noindex robots tag to 404 responses itself.
export const metadata: Metadata = {
  title: "Page not found"
};

const helpfulLinks = [
  { href: "/conditions", label: "Conditions we treat", blurb: "Anxiety, depression, relationships, trauma and more." },
  { href: "/therapies", label: "Therapies we offer", blurb: "CBT, clinical hypnotherapy, Ego State Therapy and others." },
  { href: "/counselling-navi-mumbai", label: "Counselling in Navi Mumbai", blurb: "In person in Vashi and CBD Belapur, or online." },
  { href: "/blog", label: "Blog", blurb: "Articles on psychological wellbeing." }
];

export default function NotFound() {
  return (
    <Section eyebrow="Error 404" title="We couldn't find that page" titleAs="h1">
      <div className="max-w-2xl space-y-8">
        <p className="text-lg text-ink-soft leading-relaxed">
          The page may have moved, or the link may be mistyped. These are good places to continue:
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {helpfulLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="card flex h-full flex-col gap-1 p-5 hover:border-accent/40">
                <span className="font-display text-lg text-primary-dark">{link.label}</span>
                <span className="text-sm text-ink-soft">{link.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-4">
          <Link href="/" className="btn-primary">
            Go to the homepage
          </Link>
          <Link href="/contact" className="btn-outline">
            Book a consultation
          </Link>
        </div>

        <p className="text-sm text-ink-soft">
          Prefer to talk? Call{" "}
          <a href={`tel:${site.phone}`} className="font-medium text-primary-dark underline underline-offset-4">
            {site.phoneDisplay}
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
