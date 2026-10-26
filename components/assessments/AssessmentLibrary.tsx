"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicSummary } from "@/lib/assessments/types";
import AssessmentCard from "./AssessmentCard";
import styles from "./assessments.module.css";
import { cx, inputClass } from "./ui";

/** With only a few assessments there is nothing to search, so the search box and count stay hidden. */
const SEARCH_FROM = 7;

/** Searchable, filterable grid of published assessments. */
export default function AssessmentLibrary({ assessments }: { assessments: PublicSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assessments) if (!seen.has(a.categoryId)) seen.set(a.categoryId, a.categoryName);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [assessments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assessments.filter((a) => {
      if (category !== "all" && a.categoryId !== category) return false;
      if (!needle) return true;
      return [a.title, a.description, a.categoryName].some((text) => text.toLowerCase().includes(needle));
    });
  }, [assessments, query, category]);

  const filtering = query.trim() !== "" || category !== "all";
  const showToolbar = assessments.length >= SEARCH_FROM;

  if (assessments.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h2 className="text-2xl text-primary-dark">No self-checks yet</h2>
        <p className="mt-3 text-ink-soft">New self-checks will appear here as soon as they are published. Please check back soon.</p>
        <Link href="/" className="btn-outline mt-6 min-h-11">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {showToolbar && (
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <label htmlFor="assessment-search" className="sr-only">
            Search self-checks
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
          <input
            id="assessment-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search self-checks"
            autoComplete="off"
            className={cx(inputClass, "pl-12")}
          />
        </div>

        {categories.length > 1 && (
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            {[{ id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cx(
                  "min-h-11 rounded-full border px-4 text-sm font-medium transition",
                  category === c.id
                    ? "border-primary bg-primary text-surface"
                    : "border-primary/25 bg-surface text-primary-dark hover:bg-surface-soft",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {showToolbar && (
      <p className="mt-5 text-sm text-ink-soft" role="status" aria-live="polite">
        {filtered.length === assessments.length && !filtering
          ? `${filtered.length} self-check${filtered.length === 1 ? "" : "s"} available`
          : `Showing ${filtered.length} of ${assessments.length} self-check${assessments.length === 1 ? "" : "s"}`}
      </p>
      )}

      {filtered.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <h2 className="text-2xl text-primary-dark">No matching self-checks</h2>
          <p className="mt-3 text-ink-soft">Try a different word, or clear the filters to see everything.</p>
          <button
            type="button"
            className="btn-outline mt-6 min-h-11"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear filters
          </button>
        </div>
      ) : (
        <div className={cx("mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3", styles.stagger)}>
          {filtered.map((a) => (
            <AssessmentCard key={a.id} assessment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
