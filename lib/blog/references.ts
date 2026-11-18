import type { BlogReference } from "@/lib/firebase/blogs";

/** "Title | https://link" per line (a bare link is allowed) to the list stored with a post. Only http(s) links are kept. */
export function referencesFromText(text: string): BlogReference[] {
  const out: BlogReference[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bar = trimmed.lastIndexOf("|");
    const url = (bar === -1 ? trimmed : trimmed.slice(bar + 1)).trim();
    const title = bar === -1 ? "" : trimmed.slice(0, bar).trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url)) continue;
    out.push({ title: title || new URL(url).hostname.replace(/^www\./, ""), url });
  }
  return out;
}

export function referencesToText(references: BlogReference[] | undefined): string {
  return (references ?? []).map((r) => `${r.title} | ${r.url}`).join("\n");
}
