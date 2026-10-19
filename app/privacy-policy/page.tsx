import Section from "@/components/Section";
import { buildMetadata } from "@/lib/seo/metadata";
import { site } from "@/lib/data/site";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Chaitanya Raj Psychology & Counselling collects, uses and protects information from contact form messages and website analytics, including cookies.",
  path: "/privacy-policy",
  noIndex: true
});

export default function PrivacyPolicyPage() {
  return (
    <Section eyebrow="Legal" title="Privacy Policy" titleAs="h1">
      <div className="max-w-2xl space-y-6 text-ink-soft leading-relaxed">
        <p>Last updated: October 2026.</p>
        <p>
          This policy explains what information {site.name} collects through this website, how
          it is used, and how it is protected. Replace this placeholder text with a policy
          reviewed by a qualified professional before launch — this is a starting structure,
          not legal advice.
        </p>
        <h2 className="text-xl text-primary-dark font-display">Information we collect</h2>
        <p>
          Contact form submissions (name, email, phone, message) and standard web analytics data
          (pages visited, approximate location, device type) via Google Analytics. Contact form
          messages are delivered to us through the Web3Forms form service.
        </p>
        <h2 className="text-xl text-primary-dark font-display">Session analytics and cookies</h2>
        <p>
          If you allow it, Microsoft Clarity records how you interact with our pages, such as
          clicks, scrolling and mouse movement, so we can see where the site is hard to use.
          Clarity sets cookies, including third-party cookies. It is only loaded after you choose
          “Allow”, and you can change your choice at any time using “Analytics preferences” at
          the bottom of every page. Google Analytics uses its own first-party cookies.
        </p>
        <h2 className="text-xl text-primary-dark font-display">How we use it</h2>
        <p>
          To respond to enquiries, schedule sessions, and understand how visitors use this site
          in order to improve it. We do not sell or share personal information with third parties
          for marketing purposes.
        </p>
        <h2 className="text-xl text-primary-dark font-display">Clinical confidentiality</h2>
        <p>
          Information shared within therapy sessions is governed by separate, stricter
          confidentiality standards explained directly at the start of clinical work — this
          policy covers website data only.
        </p>
        <h2 className="text-xl text-primary-dark font-display">Contact</h2>
        <p>
          Questions about this policy can be sent to{" "}
          <a href={`mailto:${site.email}`} className="text-accent-ink">{site.email}</a>.
        </p>
      </div>
    </Section>
  );
}
