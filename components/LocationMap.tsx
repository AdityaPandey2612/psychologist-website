"use client";

import { useState } from "react";
import { site } from "@/lib/data/site";

// `compact` drops the phone/email/hours block and stacks the map under the
// address, for pages that already list the contact details (e.g. /contact).
export default function LocationMap({ compact = false }: { compact?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = site.locations[activeIndex];

  return (
    <div className={compact ? "space-y-6" : "grid gap-8 md:grid-cols-2"}>
      <div className="space-y-6 text-ink-soft">
        {!compact && (
          <>
            <div>
              <p className="eyebrow">Phone</p>
              <a href={`tel:${site.phone}`} className="inline-block py-0.5 hover:text-accent-ink">
                {site.phoneDisplay}
              </a>
            </div>

            <div>
              <p className="eyebrow">Email</p>
              <a href={`mailto:${site.email}`} className="inline-block py-0.5 [overflow-wrap:anywhere] hover:text-accent-ink">
                {site.email}
              </a>
            </div>

            <div>
              <p className="eyebrow">Hours</p>
              <p>{site.hours}</p>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          {site.locations.map((loc, i) => (
            <button
              key={loc.name}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-pressed={i === activeIndex}
              className={`min-h-11 rounded-full px-5 py-2 text-sm transition ${
                i === activeIndex
                  ? "bg-primary-dark text-white"
                  : "border border-primary-dark/20 text-ink-soft hover:border-primary-dark/40"
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>

        <div>
          <p className="eyebrow">{active.name}</p>
          <p>
            {active.address.street}<br />
            {active.address.locality}, {active.address.region} {active.address.postalCode}
          </p>
          <a
            href={active.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block py-0.5 text-sm underline underline-offset-4 hover:text-accent-ink"
          >
            Open in Google Maps
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/10 aspect-[4/3]">
        <iframe
          key={active.name}
          title={`${active.name} location map`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(active.mapQuery)}&ll=${active.geo.lat},${active.geo.lng}&z=17&output=embed`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>
    </div>
  );
}
