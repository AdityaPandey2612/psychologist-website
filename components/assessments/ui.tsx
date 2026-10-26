import {
  Brain,
  Briefcase,
  ClipboardList,
  Compass,
  Ear,
  Heart,
  Loader2,
  MessageCircle,
  Sparkles,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

// Small shared primitives for the assessment screens. They use the site's
// existing Tailwind tokens (bg, surface, ink, ink-soft, primary, accent-ink…)
// and the global .btn-primary / .btn-outline / .card / .eyebrow classes.

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const ICONS: Record<string, LucideIcon> = {
  clipboard: ClipboardList,
  ear: Ear,
  message: MessageCircle,
  heart: Heart,
  brain: Brain,
  users: Users,
  briefcase: Briefcase,
  sprout: Sprout,
  compass: Compass,
  sparkles: Sparkles,
};

export function AssessmentIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? ClipboardList;
  return <Icon aria-hidden="true" className={className} />;
}

/** Base style for text inputs, selects and textareas. */
export const inputClass =
  "w-full rounded-xl border border-primary/25 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-soft/70 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface-soft/60";

export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-primary-dark">
      {children}
      {optional && <span className="ml-2 font-normal text-ink-soft">(optional)</span>}
    </label>
  );
}

export function Spinner({ label = "Loading", className = "h-5 w-5" }: { label?: string; className?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2 aria-hidden="true" className={cx("animate-spin", className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

const ALERT_TONES = {
  info: "border-primary/25 bg-surface-soft text-primary-dark",
  success: "border-primary/30 bg-[#E3F1EA] text-primary-dark",
  warning: "border-gold/60 bg-[#FBF3DC] text-[#6B4E0F]",
  error: "border-accent-ink/40 bg-[#FBEEE5] text-accent-ink",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof ALERT_TONES; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm leading-relaxed", ALERT_TONES[tone], className)}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "gold" | "accent" }) {
  const tones = {
    neutral: "bg-surface-soft text-primary-dark",
    primary: "bg-primary text-surface",
    gold: "bg-[#F5E3B8] text-[#6B4E0F]",
    accent: "bg-[#FBEEE5] text-accent-ink ring-1 ring-inset ring-accent-ink/25",
  } as const;
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
