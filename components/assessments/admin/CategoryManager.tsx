"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import type { AssessmentCategory } from "@/lib/assessments/types";
import { Alert, Spinner } from "@/components/assessments/ui";
import { RowActions, TextField, moveItem, removeAt, replaceAt } from "./SettingsControls";

interface Row {
  key: string;
  id?: string;
  name: string;
}

let rowCounter = 0;
const toRows = (categories: AssessmentCategory[]): Row[] => categories.map((c) => ({ key: `c-${c.id}`, id: c.id, name: c.name }));

/** Add, rename, reorder and delete assessment categories. Categories still in use can't be deleted. */
export function CategoryManager({
  categories,
  usage,
  onSaved,
}: {
  categories: AssessmentCategory[];
  /** Number of assessments per category id, shown as a hint. */
  usage: Record<string, number>;
  onSaved: (categories: AssessmentCategory[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(categories));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => setRows(toRows(categories)), [categories]);

  const dirty = useMemo(
    () => rows.length !== categories.length || rows.some((r, i) => r.id !== categories[i]?.id || r.name !== categories[i]?.name),
    [rows, categories],
  );
  const hasBlank = rows.some((r) => !r.name.trim());

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await adminFetch<{ categories: AssessmentCategory[] }>("/api/admin/assessments/categories", {
        method: "PUT",
        json: { categories: rows.map((r) => ({ id: r.id, name: r.name.trim() })) },
      });
      onSaved(res.categories);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't save the categories. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="card group p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block text-xl text-primary-dark">Categories</span>
          <span className="block text-sm text-ink-soft">{categories.length} categories used to group assessments in the public library</span>
        </span>
        <span className="text-sm font-semibold text-primary group-open:hidden">Manage</span>
        <span className="hidden text-sm font-semibold text-primary group-open:inline">Close</span>
      </summary>

      <div className="mt-5 space-y-4">
        <ul className="space-y-3">
          {rows.map((row, i) => {
            const inUse = row.id ? (usage[row.id] ?? 0) : 0;
            return (
              <li key={row.key} className="flex flex-wrap items-end gap-3">
                <TextField
                  className="min-w-[12rem] flex-1"
                  label={`Category ${i + 1}`}
                  value={row.name}
                  maxLength={60}
                  onChange={(name) => setRows(replaceAt(rows, i, { ...row, name }))}
                  help={inUse > 0 ? `${inUse} assessment${inUse === 1 ? "" : "s"} use this category` : undefined}
                />
                <RowActions
                  index={i}
                  count={rows.length}
                  noun={`category ${row.name || i + 1}`}
                  onMove={(d) => setRows(moveItem(rows, i, d))}
                  onRemove={() => setRows(removeAt(rows, i))}
                  canRemove={rows.length > 1 && inUse === 0}
                />
              </li>
            );
          })}
        </ul>

        {error && <Alert tone="error">{error}</Alert>}
        {saved && !dirty && <Alert tone="success">Categories saved.</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          {rows.length < 40 && (
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              onClick={() => setRows([...rows, { key: `new-${++rowCounter}`, name: "" }])}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add category
            </button>
          )}
          <button type="button" className="btn-primary px-5 py-2 text-sm disabled:opacity-50" disabled={!dirty || hasBlank || saving} onClick={save}>
            {saving ? <Spinner label="Saving categories" className="h-4 w-4" /> : null}
            Save categories
          </button>
          {hasBlank && <span className="text-sm text-accent-ink">Every category needs a name.</span>}
        </div>
        <p className="text-xs text-ink-soft">Categories that still contain assessments can’t be deleted — move those assessments to another category first.</p>
      </div>
    </details>
  );
}
