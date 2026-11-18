import Link from "next/link";

export default function AssessmentNotFound() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="eyebrow">Self-checks</p>
      <h1 className="mt-3 text-4xl text-primary-dark">That self-check isn&apos;t available</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">It may have been unpublished or moved, or the link may be incomplete. You can browse everything that&apos;s currently available.</p>
      <Link href="/assessments" className="btn-primary mt-8 min-h-11">
        Browse self-checks
      </Link>
    </section>
  );
}
