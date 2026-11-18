import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import FAQAccordion from "@/components/FAQAccordion";
import LocationMap from "@/components/LocationMap";
import Section from "@/components/Section";
import type { Condition } from "@/lib/data/conditions";
import { site } from "@/lib/data/site";
import { BreadcrumbJsonLd, FAQJsonLd, TherapyJsonLd } from "@/lib/seo/jsonld";
import { getTone } from "@/lib/tones";

// The copy of this page was supplied by the practice (Past-Life-Regression-Therapy-Page). The headings, their order and the
// wording follow it; the cards, the contents list and the map are only how it is laid out.

const PHONE_DISPLAY = site.phoneDisplay;
const PHONE_HREF = `tel:${site.phone}`;

const familiar = [
  "A fear or reaction you can't trace to anything that has happened to you",
  "The same pattern turning up in different relationships or situations",
  "A feeling of being stuck that logic and effort haven't shifted",
  "Curiosity about what sits beneath it all"
];

const steps = [
  {
    lead: "A grounding conversation.",
    text: "We start by talking about what you want to explore and what PLRT is and isn't, so you know what to expect."
  },
  {
    lead: "Guided relaxation (induction).",
    text: "You are guided into a deeply relaxed state. You stay aware throughout and can stop at any point."
  },
  {
    lead: "The guided regression.",
    text: "At your pace, you explore the imagery, memories or narratives connected to what you came to explore. You are never left to manage it alone."
  },
  {
    lead: "Grounding and integration.",
    text: "Every session closes with time to come back fully, reflect and make sense of what came up."
  }
];

const clinics = [
  { name: "Vashi", address: "215, 2nd Floor, Gold City, Sector 19 D" },
  { name: "CBD Belapur", address: "G-3, Lane-6, Sector-9, CBD Belapur, Navi Mumbai, Maharashtra 400614" }
];

const needs = ["A private, quiet space where you won't be interrupted", "A stable internet connection", "Headphones"];

const credentials = [
  "MA Psychology, Chattrapati Shivaji Maharaj University",
  "PGDCH, Charotar University of Science and Technology",
  "Registered with NCAHP (Enrolment No. 99712872701307)",
  "Lifetime Professional Member, Academy of Hypnosis, India (No. 202301LM000034)",
  "25+ years of practice"
];

const beforeYouBegin = [
  "If you take medication or are under the care of a doctor or psychiatrist, tell us at your first session.",
  "Sessions are not an emergency service. If you are in crisis or at risk of harm, contact your nearest emergency services directly.",
  "What you share and experience stays confidential."
];

const related = [
  { href: "/hypnotherapy-navi-mumbai", label: "Hypnotherapy" },
  { href: "/therapies/age-regression", label: "Age Regression" },
  { href: "/therapies/ego-state-therapy", label: "Ego State Therapy" },
  { href: "/online-therapy-international-clients", label: "Online therapy for international clients" }
];

const furtherReading = [
  {
    href: "/blog/what-actually-happens-in-a-past-life-regression-session-and-why-people-sometimes-cry-halfway-through",
    label: "What actually happens in a past life regression session"
  },
  { href: "/blog/past-life-regression-session-story-vashi", label: "A past life regression session story" }
];

const contents = [
  { id: "familiar", label: "Does any of this sound familiar?" },
  { id: "at-a-glance", label: "At a glance" },
  { id: "what-it-is", label: "What it is, and what it is not" },
  { id: "how-it-works", label: "How a session works" },
  { id: "in-person", label: "In-person sessions" },
  { id: "online", label: "Online sessions" },
  { id: "who-leads", label: "Who leads your sessions" },
  { id: "fees", label: "Fees and booking" },
  { id: "before-you-begin", label: "Before you begin" },
  { id: "faq", label: "Frequently asked questions" }
];

const link = "font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink";
const h2 = "scroll-mt-28 text-2xl md:text-3xl mb-4";

function Bullets({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-ink-soft leading-relaxed">
          <span className={`mt-2 h-2 w-2 shrink-0 rotate-45 tone-${tone} bg-current`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PastLifeRegressionPage({ condition }: { condition: Condition }) {
  const tone = getTone(condition.slug);
  const path = `/conditions/${condition.slug}`;
  const faqs = condition.faqs ?? [];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Conditions", path: "/conditions" },
          { name: condition.name, path }
        ]}
      />
      {faqs.length > 0 && <FAQJsonLd items={faqs} />}
      <TherapyJsonLd
        name="Past Life Regression Therapy"
        description={condition.metaDescription}
        path={path}
        complementary
        areaServed={["Mumbai", "Navi Mumbai", "Thane", "Online, worldwide"]}
      />

      <div className={`hero-panel tone-${tone} relative overflow-hidden`}>
        <Image src={condition.image} alt={condition.imageAlt} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/40" />
        <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-16 max-sm:pr-16 md:pb-20 md:pt-24">
          <p className="eyebrow mb-6">Therapy</p>
          <h1 className="max-w-3xl font-display text-4xl leading-[1.1] text-primary-dark md:text-5xl">
            Past Life Regression Therapy in Mumbai, Navi Mumbai and Online
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink md:text-xl">
            Past life regression therapy (PLRT) is a hypnosis-based technique in which a person, in a guided relaxed state, explores narratives
            experienced as memories from a past life. Chaitanya Raj offers PLRT in person in Mumbai and Navi Mumbai (Vashi and CBD Belapur) and
            online worldwide, including the UK, US and Canada, with clinical hypnotherapist Lt Col Rajesh Sharma (Retd).
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">
            Some fears have no obvious origin. Some patterns keep returning, however hard you try to change them. This is a calm, guided way to
            explore them, whether you visit us in Vashi or CBD Belapur, or join online from anywhere in the world.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary">
              Book a consultation
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <a href={PHONE_HREF} className="btn-outline bg-surface/80">
              <Phone aria-hidden="true" className="h-4 w-4" />
              Call {PHONE_DISPLAY}
            </a>
            <Link href="/fees" className="btn-outline bg-surface/80">
              See fees
            </Link>
          </div>
        </div>
      </div>

      {/* On phones the text keeps clear of the floating social bar on the right. */}
      <Section className="max-sm:pr-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-14 md:col-span-2">
            <section id="familiar" aria-labelledby="familiar-h">
              <h2 id="familiar-h" className={h2}>
                Does any of this sound familiar?
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {familiar.map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-primary/20 bg-surface-soft/40 p-4">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rotate-45 tone-${tone} bg-current`} />
                    <span className="leading-relaxed text-ink-soft">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 leading-relaxed text-ink-soft">
                These are areas people choose to explore, not diagnoses. PLRT is not a treatment for any condition.
              </p>
            </section>

            <section id="at-a-glance" aria-labelledby="at-a-glance-h">
              <h2 id="at-a-glance-h" className={h2}>
                At a glance
              </h2>
              <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-primary/10">
                    {[
                      ["Practitioner", "Lt Col Rajesh Sharma (Retd), Psychologist & Clinical Hypnotherapist"],
                      [
                        "Qualifications & Registration",
                        "MA Psychology (Chattrapati Shivaji Maharaj University); PGDCH (Charotar University of Science and Technology); NCAHP Reg. No. 99712872701307; Lifetime Member, Academy of Hypnosis (no. 202301LM000034)"
                      ],
                      ["Experience", "25+ years of practice"],
                      ["Formats", "In person, or online"],
                      ["In-person locations", "Vashi and CBD Belapur (Navi Mumbai), serving clients across Mumbai and Thane"],
                      ["Online", "Available to clients worldwide, including the UK, US and Canada"],
                      [
                        "Who it may suit",
                        "People curious about exploring unexplained fears, repeating patterns or emotional blocks through a guided, complementary approach"
                      ],
                      [
                        "Who it isn't for",
                        "Anyone looking for a replacement for psychological or medical care, anyone in crisis, or anyone who wants a guaranteed result or proof of literal past lives"
                      ]
                    ].map(([label, value]) => (
                      <tr key={label} className="align-top">
                        <th scope="row" className="w-[38%] px-4 py-3.5 text-sm font-semibold text-primary-dark sm:w-1/3 sm:px-5">
                          {label}
                        </th>
                        <td className="px-4 py-3.5 leading-relaxed text-ink-soft sm:px-5">{value}</td>
                      </tr>
                    ))}
                    <tr className="align-top">
                      <th scope="row" className="w-[38%] px-4 py-3.5 text-sm font-semibold text-primary-dark sm:w-1/3 sm:px-5">
                        How to book
                      </th>
                      <td className="px-4 py-3.5 leading-relaxed text-ink-soft sm:px-5">
                        Call{" "}
                        <a href={PHONE_HREF} className={link}>
                          {PHONE_DISPLAY}
                        </a>{" "}
                        or use the{" "}
                        <Link href="/contact" className={link}>
                          contact form
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="what-it-is" aria-labelledby="what-it-is-h" className="space-y-4">
              <h2 id="what-it-is-h" className={h2}>
                What past life regression therapy is, and what it is not
              </h2>
              <p className="text-lg leading-relaxed text-ink-soft">
                PLRT is a hypnosis-based technique. In a guided, relaxed state, you explore narratives and imagery that are experienced as memories
                from a past life. It sits outside mainstream evidence-based psychology, and there is no scientific proof that these experiences are
                literal. Practitioners understand its effects as symbolic or narrative.
              </p>
              <p className="text-lg leading-relaxed text-ink-soft">
                Many clients find the process helps them surface and reframe deep-seated fears or patterns that talk therapy alone hasn&apos;t
                shifted, whatever they believe about past lives. You do not need to believe in them to take part. PLRT is offered as a complementary
                approach, not a substitute for psychological or medical treatment, and only after an honest conversation about what it involves.
              </p>
            </section>

            <section id="how-it-works" aria-labelledby="how-it-works-h">
              <h2 id="how-it-works-h" className={h2}>
                How a past life regression session works
              </h2>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li key={step.lead} className="card flex gap-4 p-5">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg text-surface"
                    >
                      {index + 1}
                    </span>
                    <p className="leading-relaxed text-ink-soft">
                      <strong className="font-semibold text-primary-dark">{step.lead}</strong> {step.text}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section id="in-person" aria-labelledby="in-person-h" className="space-y-4">
              <h2 id="in-person-h" className={h2}>
                Past life regression therapy in Mumbai and Navi Mumbai: in-person sessions
              </h2>
              <p className="text-ink-soft">In-person sessions are held at two clinics:</p>
              <ul className="space-y-3">
                {clinics.map((clinic) => (
                  <li key={clinic.name} className="flex gap-3 leading-relaxed text-ink-soft">
                    <span className={`mt-2 h-2 w-2 shrink-0 rotate-45 tone-${tone} bg-current`} />
                    <span>
                      <strong className="font-semibold text-primary-dark">{clinic.name}:</strong> {clinic.address}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="card p-5 sm:p-6">
                <LocationMap compact />
              </div>
              <p className="leading-relaxed text-ink-soft">
                Clients travel to us from across Mumbai and Thane. Some hypnotherapy work is better suited to in-person sessions, and we tell you
                honestly if that applies to you.
              </p>
            </section>

            <section id="online" aria-labelledby="online-h" className="space-y-4">
              <h2 id="online-h" className={h2}>
                Online past life regression therapy for clients worldwide
              </h2>
              <p className="leading-relaxed text-ink-soft">
                Online sessions follow the same four stages as in-person ones, by video call, and are open to clients anywhere in the world,
                whether you are in the UK, the US, Canada or elsewhere. We have worked with clients in Ireland, the UK and the US, as well as in
                India.
              </p>
              <h3 className="text-lg">What you need</h3>
              <Bullets items={needs} tone={tone} />
              <p className="leading-relaxed text-ink-soft">
                <strong className="font-semibold text-primary-dark">Time zones.</strong> Sessions are scheduled across the time difference, so you
                can book at a time that suits your day.
              </p>
              <p className="leading-relaxed text-ink-soft">
                More detail for overseas clients is on our{" "}
                <Link href="/online-therapy-international-clients" className={link}>
                  online therapy for international clients
                </Link>{" "}
                page.
              </p>
            </section>

            <section id="who-leads" aria-labelledby="who-leads-h" className="space-y-4">
              <h2 id="who-leads-h" className={h2}>
                Who leads your sessions
              </h2>
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-primary/10">
                <Image
                  src="/images/clinic/counselling-consultation-desk.jpg"
                  alt="Lt Col Rajesh Sharma (Retd) in session at Chaitanya Raj clinic in Navi Mumbai"
                  fill
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="object-cover"
                />
              </div>
              <p className="leading-relaxed text-ink-soft">
                Chaitanya Raj Psychology &amp; Counselling is led by Lt Col Rajesh Sharma (Retd), Psychologist and Clinical Hypnotherapist.
                He is registered with the National Commission for Allied and Healthcare Professions (NCAHP Enrolment No. 99712872701307,
                Category: Integrated Behaviour Health Counsellor) and is a Lifetime Professional Member of the Academy of Hypnosis,
                India&apos;s only professional hypnotherapy academy (Membership No. 202301LM000034).
              </p>
              <Bullets items={credentials} tone={tone} />
              <p className="leading-relaxed text-ink-soft">
                <Link href="/about/the-founder" className={link}>
                  Read about his background.
                </Link>
              </p>
            </section>

            <section id="fees" aria-labelledby="fees-h" className="space-y-4">
              <h2 id="fees-h" className={h2}>
                Fees and booking
              </h2>
              <p className="leading-relaxed text-ink-soft">
                Fees are the same online and in person. Current fees are on the{" "}
                <Link href="/fees" className={link}>
                  fees page
                </Link>
                . If you would like to talk before booking a full session, ask about the 15-minute short consultation. To book, call{" "}
                <a href={PHONE_HREF} className={link}>
                  {PHONE_DISPLAY}
                </a>{" "}
                or use the{" "}
                <Link href="/contact" className={link}>
                  contact form
                </Link>
                .
              </p>
            </section>

            <section id="before-you-begin" aria-labelledby="before-you-begin-h" className="space-y-4">
              <h2 id="before-you-begin-h" className={h2}>
                Before you begin
              </h2>
              <Bullets items={beforeYouBegin} tone={tone} />
            </section>

            {faqs.length > 0 && (
              <section id="faq" aria-labelledby="faq-h">
                <h2 id="faq-h" className={h2}>
                  Frequently asked questions
                </h2>
                <FAQAccordion faqs={faqs} headingAs="h3" />
              </section>
            )}

            <section id="start" aria-labelledby="start-h" className="card space-y-4 p-6 sm:p-8">
              <h2 id="start-h" className="scroll-mt-28 text-2xl md:text-3xl">
                Start with a conversation
              </h2>
              <p className="leading-relaxed text-ink-soft">
                Not sure whether PLRT is for you? Start with a conversation. We will tell you honestly what it can and can&apos;t do for what you
                are facing.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact" className="btn-primary">
                  Book a consultation
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <a href={PHONE_HREF} className="btn-outline">
                  <Phone aria-hidden="true" className="h-4 w-4" />
                  Call {PHONE_DISPLAY}
                </a>
              </div>
            </section>
          </div>

          <div className="h-fit space-y-6 md:sticky md:top-28">
            <nav aria-labelledby="contents-h" className="card p-6">
              <h2 id="contents-h" className="eyebrow mb-3">
                On this page
              </h2>
              <div className="divider mb-4" />
              <ul className="space-y-1">
                {contents.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="inline-flex min-h-11 items-center font-medium text-primary-dark hover:text-accent-ink">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <aside className="card p-6" aria-labelledby="related-h">
              <h2 id="related-h" className="eyebrow mb-3">
                Related
              </h2>
              <div className="divider mb-4" />
              <ul className="space-y-1">
                {related.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="inline-flex min-h-11 items-center font-medium text-primary-dark hover:text-accent-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>

            <aside className="card p-6" aria-labelledby="reading-h">
              <h2 id="reading-h" className="eyebrow mb-3">
                Further reading
              </h2>
              <div className="divider mb-4" />
              <ul className="space-y-1">
                {furtherReading.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="inline-flex min-h-11 items-center font-medium text-primary-dark hover:text-accent-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </Section>
    </>
  );
}
