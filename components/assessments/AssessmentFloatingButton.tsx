"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, ArrowRight } from "lucide-react";
import styles from "./AssessmentFloatingButton.module.css";

// Floating "Take a Self-Check" call to action. It sits bottom-right, clear of
// the vertically centred social bar (components/Floatingocials.tsx), lifts above
// the analytics consent banner while that is showing, steps out of the way of
// the footer, and is not shown in the admin area or on the assessment pages
// themselves (where it would point at the page you're already on).

const HIDDEN_PREFIXES = ["/admin", "/assessments"];

export default function AssessmentFloatingButton() {
  const pathname = usePathname() ?? "";
  const [overFooter, setOverFooter] = useState(false);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (hidden) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) return setOverFooter(false);
      // The button's bottom edge is 20px above the viewport bottom; step aside once the footer reaches it.
      setOverFooter(footer.getBoundingClientRect().top < window.innerHeight - 20);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [hidden, pathname]);

  if (hidden) return null;

  return (
    <Link
      href="/assessments"
      aria-label="Take a Self-Check: browse our self-reflection self-checks"
      aria-hidden={overFooter || undefined}
      tabIndex={overFooter ? -1 : undefined}
      className={`${styles.fab} ${overFooter ? styles.tuckedAway : ""} group fixed bottom-5 right-4 z-30 inline-flex min-h-12 items-center gap-3 rounded-full bg-primary-dark py-2 pl-2 pr-5 text-sm font-medium text-white shadow-[0_14px_30px_-12px_rgba(18,58,54,0.7)] ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:bg-primary hover:shadow-[0_18px_34px_-12px_rgba(18,58,54,0.75)] focus-visible:outline-gold motion-reduce:transition-none sm:right-6 sm:text-base`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-primary-dark transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none">
        <ClipboardList aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="whitespace-nowrap">Take a Self-Check</span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 -translate-x-1 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
      />
    </Link>
  );
}
