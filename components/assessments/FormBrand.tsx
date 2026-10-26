import Image from "next/image";
import type { ReactNode } from "react";
import type { IntroHighlight } from "@/lib/assessments/types";
import { fillTokens } from "@/lib/assessments/text";
import { cx } from "./ui";

// Branding for the printed-form look of an assessment: the practice logo, a teal
// banner, title block, info tiles and the notice box. Everything is plain text
// from the assessment's introduction settings (no HTML).

export const BRAND_LOGO = {
  src: "/logo.png",
  width: 600,
  height: 188,
  alt: "Chaitanya Raj — Healing Mind and Body",
} as const;

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={BRAND_LOGO.src}
      width={BRAND_LOGO.width}
      height={BRAND_LOGO.height}
      alt={BRAND_LOGO.alt}
      priority={priority}
      sizes="(max-width: 640px) 192px, 256px"
      className={cx("h-auto", className)}
    />
  );
}

/**
 * Top of the form. The full version centres the logo above a teal banner and
 * the title block; the compact version is a slim bar for the question pages.
 */
export function FormHeader({
  title,
  subtitle,
  badge,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <header className="flex items-center justify-between gap-4 border-b-[6px] border-primary-dark bg-surface px-5 py-3 sm:px-8">
        <BrandLogo className="w-28 shrink-0 sm:w-32" />
        <p className="min-w-0 text-right font-display text-base leading-snug text-primary-dark sm:text-lg">{title}</p>
      </header>
    );
  }
  return (
    <header className="text-center">
      <div className="flex justify-center px-6 pt-7 sm:pt-9">
        <BrandLogo className="w-48 sm:w-64" priority />
      </div>
      <div aria-hidden="true" className="mt-6 h-4 bg-primary-dark sm:h-5" />
      <div className="px-5 pt-7 sm:px-8">
        <p className="font-display text-3xl leading-tight text-primary-dark sm:text-4xl">{title}</p>
        {subtitle && <p className="mt-2 text-lg text-ink-soft">{subtitle}</p>}
        {badge && <p className="mt-3 text-sm font-semibold tracking-wide text-primary">&bull; {badge} &bull;</p>}
      </div>
    </header>
  );
}

/** Up to three short tiles ("Private", "Takes about 12 minutes", …). */
export function IntroHighlights({ items, vars }: { items: IntroHighlight[]; vars: Record<string, string | number> }) {
  const shown = items.filter((h) => h.title || h.text).slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <ul
      className={cx(
        "grid divide-y divide-primary/15 overflow-hidden rounded-lg border border-primary/15 bg-surface-soft/50 sm:divide-x sm:divide-y-0",
        shown.length === 1 ? "sm:grid-cols-1" : shown.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      )}
    >
      {shown.map((h, i) => (
        <li key={i} className="px-4 py-4 text-center">
          {h.title && <p className="font-semibold text-primary-dark">{fillTokens(h.title, vars)}</p>}
          {h.text && <p className="mt-1 text-sm leading-snug text-ink-soft">{fillTokens(h.text, vars)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** The highlighted notice (clinical disclaimer or similar). */
export function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-r-lg border-l-4 border-gold bg-[#FBF3DC] px-4 py-3 text-sm leading-relaxed text-ink">
      <strong className="font-semibold text-accent-ink">Important: </strong>
      {children}
    </aside>
  );
}

/** "ASSESSMENT QUESTIONS (21 ITEMS)" divider above the first question. */
export function QuestionsHeading({ count, children }: { count: number; children?: ReactNode }) {
  return (
    <h2 className="border-b border-primary/15 pb-2 font-body text-xs font-semibold uppercase tracking-wider text-primary-dark sm:text-sm">
      {children ?? "Self-check questions"} ({count} item{count === 1 ? "" : "s"})
    </h2>
  );
}
