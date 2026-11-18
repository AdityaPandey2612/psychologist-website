"use client";

import { ChevronDown, Printer } from "lucide-react";
import { useRef } from "react";
import type { AssessmentResult } from "@/lib/assessments/types";
import styles from "./assessments.module.css";
import { Badge, cx } from "./ui";

/** Personalised practice plan: one collapsible card per week (or a numbered list of steps), printable. */
export default function PracticePlan({ plan }: { plan: NonNullable<AssessmentResult["practicePlan"]> }) {
  const ref = useRef<HTMLDivElement>(null);

  function print() {
    // Native <details> content is not printed while collapsed.
    ref.current?.querySelectorAll("details").forEach((d) => {
      d.open = true;
    });
    window.print();
  }

  if (plan.steps) {
    // A plan with a set number of steps ("Day 1" … "Day 7"): one practice each, all visible at once.
    return (
      <div ref={ref}>
        {plan.intro && <p className="mb-5 leading-relaxed text-ink-soft">{plan.intro}</p>}
        <ol className="divide-y divide-primary/10 rounded-2xl border border-primary/15 bg-bg">
          {plan.weeks.map((step) => (
            <li key={step.id} className="flex break-inside-avoid gap-4 px-5 py-4 sm:gap-6">
              <span className="w-16 shrink-0 pt-0.5 text-xs font-bold uppercase tracking-[0.14em] text-primary sm:w-20">{step.title}</span>
              <span className="leading-relaxed text-ink">
                {step.practices[0]?.text}
                {step.practices[0]?.skillName && (
                  <span className="ml-2 inline-block align-middle">
                    <Badge tone="neutral">{step.practices[0].skillName}</Badge>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={print} className={cx("btn-outline mt-5 min-h-11", styles.noPrint)}>
          <Printer aria-hidden="true" className="h-4 w-4" />
          Print this plan
        </button>
      </div>
    );
  }

  return (
    <div ref={ref}>
      {plan.intro && <p className="mb-5 leading-relaxed text-ink-soft">{plan.intro}</p>}
      <ol className="space-y-3">
        {plan.weeks.map((week, index) => (
          <li key={week.id} className="break-inside-avoid">
            <details open={index === 0} className="group rounded-2xl border border-primary/15 bg-bg open:bg-surface">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-display text-lg text-primary-dark">{week.title}</span>
                  <span className="block text-sm text-ink-soft">{week.days}</span>
                </span>
                <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="px-5 pb-5">
                {week.goal && <p className="mb-3 text-sm italic leading-relaxed text-ink-soft">{week.goal}</p>}
                <ul className="space-y-3">
                  {week.practices.map((p) => (
                    <li key={p.id} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span className="leading-relaxed text-ink">
                        {p.text}
                        {p.skillName && (
                          <span className="ml-2 inline-block align-middle">
                            <Badge tone="neutral">{p.skillName}</Badge>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <button type="button" onClick={print} className={cx("btn-outline mt-5 min-h-11", styles.noPrint)}>
        <Printer aria-hidden="true" className="h-4 w-4" />
        Print this plan
      </button>
    </div>
  );
}
