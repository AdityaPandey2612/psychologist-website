"use client";

import Link from "next/link";

export default function AssessmentsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center" role="alert">
      <p className="eyebrow">Self-checks</p>
      <h1 className="mt-3 text-4xl text-primary-dark">Something went wrong</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">We couldn&apos;t load this page. Please try again. Your saved answers, if any, are still on this device.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary min-h-11">
          Try again
        </button>
        <Link href="/assessments" className="btn-outline min-h-11">
          Back to self-checks
        </Link>
      </div>
    </section>
  );
}
