import type { ReactNode } from "react";

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-4xl text-primary-dark">{value}</p>
      {hint && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{hint}</p>}
    </div>
  );
}
