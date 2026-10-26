import styles from "./assessments.module.css";
import { cx } from "./ui";

const Bone = ({ className }: { className: string }) => <div aria-hidden="true" className={cx(styles.skeleton, className)} />;

/** Placeholder grid while the assessment library loads. */
export function LibrarySkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading self-checks…</span>
      <Bone className="h-12 w-full md:max-w-md" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-6">
            <Bone className="h-12 w-12" />
            <Bone className="mt-6 h-3 w-24" />
            <Bone className="mt-3 h-7 w-3/4" />
            <Bone className="mt-4 h-4 w-full" />
            <Bone className="mt-2 h-4 w-5/6" />
            <Bone className="mt-6 h-11 w-40 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for the results page while the result is fetched. */
export function ResultsSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your results…</span>
      <Bone className="h-3 w-40" />
      <Bone className="mt-4 h-12 w-3/4 max-w-lg" />
      <Bone className="mt-4 h-5 w-64" />
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-8">
            <Bone className="h-7 w-48" />
            <Bone className="mt-5 h-4 w-full" />
            <Bone className="mt-2 h-4 w-11/12" />
            <Bone className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a single-card form (start page, peer page). */
export function FormSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="card p-8">
        <Bone className="h-3 w-32" />
        <Bone className="mt-4 h-9 w-2/3" />
        <Bone className="mt-6 h-4 w-full" />
        <Bone className="mt-2 h-4 w-5/6" />
        <Bone className="mt-8 h-12 w-full" />
        <Bone className="mt-4 h-12 w-full" />
      </div>
    </div>
  );
}
