import { notFound } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import PracticeDetails from "@/components/PracticeDetails";
import { trainingPrograms, getTrainingProgram } from "@/lib/data/training";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/jsonld";

export function generateStaticParams() {
  return trainingPrograms.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const program = getTrainingProgram(params.slug);
  if (!program) return {};
  return buildMetadata({
    title: program.metaTitle,
    description: program.metaDescription,
    path: `/training-and-mentorship/${program.slug}`
  });
}

export default function TrainingProgramPage({ params }: { params: { slug: string } }) {
  const program = getTrainingProgram(params.slug);
  if (!program) notFound();

  // The programmes are listed in pathway order (Foundation → Advanced II).
  const index = trainingPrograms.findIndex((t) => t.slug === program.slug);
  const previous = trainingPrograms[index - 1];
  const next = trainingPrograms[index + 1];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Training and Mentorship", path: "/training-and-mentorship" },
          { name: program.name, path: `/training-and-mentorship/${program.slug}` }
        ]}
      />
      <Section eyebrow={program.level} title={program.name} titleAs="h1">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            <p className="text-lg text-ink-soft leading-relaxed">{program.intro}</p>
            <div>
              <h2 className="text-xl mb-3">Curriculum</h2>
              <ul className="space-y-2">
                {program.curriculum.map((s) => (
                  <li key={s} className="flex gap-3 text-ink-soft">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {(previous || next) && (
              <div>
                <h2 className="text-xl mb-3">Where this fits in the pathway</h2>
                <p className="text-ink-soft leading-relaxed">
                  {previous && (
                    <>
                      This course follows{" "}
                      <Link href={`/training-and-mentorship/${previous.slug}`} className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                        {previous.name}
                      </Link>
                      .{" "}
                    </>
                  )}
                  {next && (
                    <>
                      The next step is{" "}
                      <Link href={`/training-and-mentorship/${next.slug}`} className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                        {next.name}
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
            )}

            <PracticeDetails variant="training" />

            <Link href="/contact" className="btn-primary inline-flex">Enquire about this program</Link>
          </div>
          <aside className="card p-6 h-fit" aria-labelledby="who-its-for">
            <h2 id="who-its-for" className="eyebrow mb-4">Who it&apos;s for</h2>
            <ul className="space-y-3">
              {program.whoItsFor.map((w) => (
                <li key={w} className="text-ink-soft text-sm">{w}</li>
              ))}
            </ul>
          </aside>
        </div>
      </Section>
    </>
  );
}
