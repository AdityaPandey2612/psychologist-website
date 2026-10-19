"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CLARITY_PROJECT_ID, CONSENT_ATTRIBUTE, CONSENT_STORAGE_KEY } from "@/lib/analyticsConsent";

// Microsoft Clarity sets third-party cookies (clarity.ms, c.bing.com) as soon
// as its tag loads, and its consent API only switches off its first-party
// cookies, so the tag is loaded only after the visitor allows it.

function storedChoice() {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function loadClarity() {
  if (document.getElementById("microsoft-clarity")) return;
  const w = window as typeof window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } };
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };
  const script = document.createElement("script");
  script.id = "microsoft-clarity";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}

export default function AnalyticsConsent() {
  useEffect(() => {
    if (storedChoice() === "granted") loadClarity();
  }, []);

  function decide(value: "granted" | "denied") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page view.
    }
    document.documentElement.setAttribute(CONSENT_ATTRIBUTE, value);
    if (value === "granted") loadClarity();
  }

  return (
    <section
      aria-label="Analytics preferences"
      className="consent-banner fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-primary/15 bg-surface p-5 shadow-[0_20px_40px_-20px_rgba(18,58,54,0.45)] sm:left-6 sm:right-auto sm:mx-0"
    >
      <noscript>
        {/* Clarity can't load without JavaScript, so there is nothing to ask. */}
        <style>{".consent-banner{display:none}"}</style>
      </noscript>
      <p className="text-sm leading-relaxed text-ink">
        May we use Microsoft Clarity to see how visitors use this site, such as clicks and
        scrolling? It sets cookies, including third-party cookies.{" "}
        <Link href="/privacy-policy" className="font-medium text-primary-dark underline underline-offset-4">
          Privacy policy
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => decide("granted")} className="btn-primary min-h-11 px-5 py-2 text-sm">
          Allow
        </button>
        <button type="button" onClick={() => decide("denied")} className="btn-outline min-h-11 px-5 py-2 text-sm">
          No thanks
        </button>
      </div>
    </section>
  );
}
