import { cx } from "./ui";

/**
 * Accessible progress bar. `label` is read out by screen readers, e.g.
 * "Section 3 of 9".
 */
export default function AssessmentProgress({
  current,
  total,
  label,
  detail,
  className,
}: {
  current: number;
  total: number;
  label: string;
  detail?: string;
  className?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(100, Math.max(0, Math.round((current / safeTotal) * 100)));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-primary-dark">{label}</span>
        {detail && <span className="text-ink-soft">{detail}</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={Math.min(current, safeTotal)}
        aria-valuetext={label}
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-soft"
      >
        <div className={cx("h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
