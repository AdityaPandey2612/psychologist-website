import Section from "@/components/Section";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Session Fees and Payment Options",
  description:
    "Session fees for individual, couples and online counselling at Chaitanya Raj in Vashi, Navi Mumbai, with payment by UPI, bank transfer or cash.",
  path: "/fees"
});

const fees = [
  {
    label: "Individual consultation (first session)",
    price: "₹3,500–5,500",
    description:
      "Your first full session. We understand what you're facing and agree on a way forward."
  },
  {
    label: "Follow-up session",
    price: "₹3,500–5,500",
    description:
      "For continuing work after your first consultation. Duration depends on what you’re working through."
  },
  {
    label: "Couple session",
    price: "₹3,500–5,500",
    description:
      "For partners working through communication, trust or conflict together."
  },
  {
    label: "Online session",
    price: "₹3,500–5,500",
    description:
      "Same quality of care from wherever you are. Same rates as in-person sessions."
  },
  {
    label: "Short consultation only (15 min)",
    price: "₹1,500",
    description:
      "A quick conversation to ask questions and see whether therapy is the right step. Consultation only, not a therapy session."
  }
];

export default function FeesPage() {
  return (
    <Section eyebrow="Fees" title="Session pricing" titleAs="h1">
      <div className="max-w-2xl">
        <p className="text-ink-soft leading-relaxed mb-8">
          Fees are kept simple and consistent. If cost is a barrier to getting support, mention
          it when you get in touch — a limited number of adjusted-fee slots are available each month.
        </p>
        <div className="card divide-y divide-primary/10">
          {fees.map((f) => (
            <div key={f.label} className="grid gap-x-6 px-6 py-4 sm:grid-cols-[1fr_auto]">
              <p className="text-ink sm:col-start-1">{f.label}</p>
              <span className="mt-1 font-mono text-primary-dark sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0">
                {f.price}
              </span>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft sm:col-start-1">{f.description}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-soft mt-6">
          Session length varies, and the fee is based on the time taken.
        </p>
        <p className="text-sm text-ink-soft mt-2">
          Payment is accepted via UPI, bank transfer, or cash at the time of each session.
        </p>
        <Link href="/contact" className="btn-primary inline-flex mt-8">
          Book a consultation
        </Link>
      </div>
    </Section>
  );
}
