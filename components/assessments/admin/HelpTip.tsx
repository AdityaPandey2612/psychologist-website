"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const WIDTH = 272; // 17rem
const MARGIN = 8;

/**
 * A small "i" that explains a setting in plain words. The explanation shows while the pointer is on
 * the "i" (and stays while the pointer is on the explanation), when the "i" is reached with the
 * keyboard, or after a tap or click; Escape, scrolling, or moving on closes it. It is read out as
 * the description of the "i" button, so screen readers get it too.
 *
 * It sits beside a label, never inside it, so the label's own name stays short. The explanation is
 * placed under the "i" and kept inside the window, so it is never cut off or makes the page scroll
 * sideways.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const icon = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const visible = !dismissed && (hover || keyboard || open);

  useLayoutEffect(() => {
    if (!visible || !icon.current) return;
    const box = icon.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
    setPlace({ top: box.bottom, left: Math.max(MARGIN, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - MARGIN)), width });
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    // The explanation is fixed to the window, so it closes rather than drifting away from its "i".
    const close = () => {
      setHover(false);
      setKeyboard(false);
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [visible]);

  return (
    <span
      className="inline-flex shrink-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDismissed(false);
      }}
    >
      <button
        ref={icon}
        type="button"
        aria-label={`What does “${label}” mean?`}
        aria-describedby={id}
        aria-expanded={visible}
        onClick={() => {
          setDismissed(false);
          setOpen((value) => !value);
        }}
        onFocus={(event) => setKeyboard(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => {
          setKeyboard(false);
          setOpen(false);
          setDismissed(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setDismissed(true);
          }
        }}
        className={
          "grid h-6 w-6 cursor-help place-items-center rounded-full border border-primary/50 p-0 font-display text-[0.8rem] font-bold italic leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
          (visible ? "bg-primary-dark text-surface" : "bg-surface text-primary-dark hover:bg-primary-dark hover:text-surface")
        }
      >
        i
      </button>
      {/* Fixed to the window and gone from the layout until shown. Its transparent top padding keeps it
          touching the "i", so the pointer can move onto it without it closing. */}
      <span id={id} role="tooltip" className={visible ? "fixed z-[1000] block pt-2" : "hidden"} style={visible && place ? place : undefined}>
        <span className="block rounded-lg bg-primary-dark px-3.5 py-3 text-left text-[0.82rem] font-normal leading-relaxed text-white shadow-lg">{children}</span>
      </span>
    </span>
  );
}
