import Link from "next/link";
import { site } from "@/lib/data/site";

// Practice-level facts shared by therapy, case study and training pages: who
// leads the practice, where sessions happen, and what to know before starting.
// Everything here restates information published elsewhere on the site.
export default function PracticeDetails({ variant = "therapy" }: { variant?: "therapy" | "training" }) {
  const clinics = site.locations.map((l) => l.address.locality.replace(", Navi Mumbai", "")).join(" and ");

  return (
    <div className="space-y-8 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl mb-3">Who leads the practice</h2>
        <p className="text-ink-soft leading-relaxed">
          {site.name} is led by {site.founder}, {site.founderCredentials}.{" "}
          <Link href="/about/the-founder" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
            Read about his background
          </Link>
          .
        </p>
      </div>

      {variant === "therapy" ? (
        <>
          <div>
            <h2 className="text-xl mb-3">Where sessions take place</h2>
            <p className="text-ink-soft leading-relaxed">
              In person at our clinics in {clinics}, Navi Mumbai, or{" "}
              <Link href="/online-therapy-international-clients" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                online
              </Link>
              . Some hypnotherapy and Ego State work is better suited to in-person sessions; this is
              discussed with you before you begin. See{" "}
              <Link href="/fees" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                session fees
              </Link>{" "}
              and{" "}
              <Link href="/faq" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                common questions
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl mb-3">Before you begin</h2>
            <ul className="space-y-2 text-ink-soft leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                <span>
                  If you are taking medication or are under the care of a doctor or psychiatrist,
                  mention it at your first session.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                <span>
                  Sessions are not an emergency service. If you are in crisis or at risk of harm,
                  contact your nearest emergency services directly.
                </span>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <div>
          <h2 className="text-xl mb-3">Dates and enrolment</h2>
          <p className="text-ink-soft leading-relaxed">
            Courses are taught in Navi Mumbai.{" "}
            <Link href="/contact" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
              Get in touch
            </Link>{" "}
            for upcoming dates, eligibility and fees, or see the{" "}
            <Link href="/training-and-mentorship" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
              full training pathway
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
