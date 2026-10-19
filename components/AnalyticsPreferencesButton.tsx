"use client";

import { CONSENT_ATTRIBUTE, CONSENT_STORAGE_KEY } from "@/lib/analyticsConsent";

// Lets visitors change their Microsoft Clarity choice by showing the banner
// again. A withdrawal takes effect from the next page load, when the tag is
// no longer added.
export default function AnalyticsPreferencesButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        } catch {
          // Storage unavailable; the banner still reopens for this page view.
        }
        document.documentElement.removeAttribute(CONSENT_ATTRIBUTE);
      }}
    >
      Analytics preferences
    </button>
  );
}
