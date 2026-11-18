"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ConditionFAQ } from "@/lib/data/conditions";

/** `headingAs` puts each question in a heading of that level (a button inside it), so the questions show in the page outline. */
export default function FAQAccordion({ faqs, headingAs }: { faqs: ConditionFAQ[]; headingAs?: "h3" }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-ink-soft/15">
      {faqs.map((f, i) => {
        const isOpen = openIndex === i;
        const trigger = (
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 py-4 text-left"
            >
              <span className="font-medium">{f.question}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-gold transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
        );
        return (
          <div key={f.question}>
            {headingAs ? <h3 className="font-body text-base font-normal leading-normal text-ink">{trigger}</h3> : trigger}
            <div
              className={`grid overflow-hidden transition-all duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-ink-soft leading-relaxed">{f.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}