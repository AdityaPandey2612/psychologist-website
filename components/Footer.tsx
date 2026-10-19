// import Link from "next/link";
// import { site } from "@/lib/data/site";
// import { conditions } from "@/lib/data/conditions";
// import { therapies } from "@/lib/data/therapies";

// export default function Footer() {
//   return (
//     <footer className="bg-primary-dark text-surface-soft mt-24">
//       <div className="mx-auto max-w-6xl px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
//         <div className="col-span-2 md:col-span-1">
//           <p className="font-display text-lg text-surface-soft mb-3">{site.shortName}</p>
//           <p className="text-surface-soft/70 leading-relaxed">{site.tagline}</p>
//         </div>
//         <div>
//           <p className="eyebrow text-gold mb-3">Conditions</p>
//           <ul className="space-y-2">
//             {conditions.slice(0, 6).map((c) => (
//               <li key={c.slug}>
//                 <Link href={`/conditions/${c.slug}`} className="text-surface-soft/80 hover:text-gold">
//                   {c.name}
//                 </Link>
//               </li>
//             ))}
//           </ul>
//         </div>
//         <div>
//           <p className="eyebrow text-gold mb-3">Therapies</p>
//           <ul className="space-y-2">
//             {therapies.slice(0, 6).map((t) => (
//               <li key={t.slug}>
//                 <Link href={`/therapies/${t.slug}`} className="text-surface-soft/80 hover:text-gold">
//                   {t.name}
//                 </Link>
//               </li>
//             ))}
//           </ul>
//         </div>
//         <div>
//           <p className="eyebrow text-gold mb-3">Practice</p>
//           <ul className="space-y-2 text-surface-soft/80">
//             <li>{site.address.street}</li>
//             <li>{site.address.locality}</li>
//             <li>
//               <a href={`tel:${site.phone}`} className="hover:text-gold">
//                 {site.phoneDisplay}
//               </a>
//             </li>
//             <li>
//               <a href={`mailto:${site.email}`} className="hover:text-gold">
//                 {site.email}
//               </a>
//             </li>
//             <li className="pt-1">
//               <Link href="/about" className="hover:text-gold">About</Link>
//             </li>
//             <li>
//               <Link href="/training-and-mentorship" className="hover:text-gold">Training and Mentorship</Link>
//             </li>
//             <li>
//               <Link href="/case-studies" className="hover:text-gold">Case Studies</Link>
//             </li>
//             <li>
//               <Link href="/privacy-policy" className="hover:text-gold">
//                 Privacy Policy
//               </Link>
//             </li>
//           </ul>
//         </div>
//       </div>
//       <div className="border-t border-surface-soft/10 py-5 text-center text-xs text-surface-soft/50">
//         © {new Date().getFullYear()} {site.name}. All rights reserved.
//       </div>
//     </footer>
//   );
// }


import Link from "next/link";
import { site } from "@/lib/data/site";
import { conditions } from "@/lib/data/conditions";
import { therapies } from "@/lib/data/therapies";
import type { ReactElement } from "react";
import { socialLinks, type SocialName } from "@/lib/data/socialLinks";
import AnalyticsPreferencesButton from "@/components/AnalyticsPreferencesButton";

// py-0.5 gives every link a 24px target (WCAG 2.2 AA); space-y-1 keeps the
// original 28px rhythm between rows.
const linkClass = "inline-block py-0.5 hover:text-gold";

const socialIcons: Record<SocialName, ReactElement> = {
  Instagram: (
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56a5.87 5.87 0 0 0-2.13 1.39A5.87 5.87 0 0 0 .62 4.14c-.3.76-.5 1.63-.56 2.91C0 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.39 2.13a5.87 5.87 0 0 0 2.13 1.39c.76.3 1.63.5 2.91.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.87 5.87 0 0 0 2.13-1.39 5.87 5.87 0 0 0 1.39-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.87 5.87 0 0 0-1.39-2.13A5.87 5.87 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0zM12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zM18.41 4.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
  ),
  YouTube: (
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.57V8.43L15.82 12z" />
  ),
  LinkedIn: (
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.86 0-2.15 1.45-2.15 2.94v5.66H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56z" />
  ),
  Facebook: (
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.62.77-1.62 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
  )
};

export default function Footer() {
  const individualConditions = conditions.filter((c) => c.audience !== "corporate").slice(0, 6);
  const corporateConditions = conditions.filter((c) => c.audience === "corporate");

  return (
    <footer className="bg-primary-dark text-surface-soft mt-24">
      <div className="mx-auto max-w-6xl px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10 text-sm">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-lg text-surface-soft mb-3">{site.shortName}</p>
          <p className="text-surface-soft/70 leading-relaxed">{site.tagline}</p>
        </div>

        <div>
          <p className="eyebrow text-gold mb-3">Conditions</p>
          <ul className="space-y-1">
            {individualConditions.map((c) => (
              <li key={c.slug}>
                <Link href={`/conditions/${c.slug}`} className={`text-surface-soft/80 ${linkClass}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>

          {corporateConditions.length > 0 && (
            <>
              <p className="eyebrow text-gold mb-3 mt-6">For Organisations</p>
              <ul className="space-y-1">
                {corporateConditions.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/conditions/${c.slug}`} className={`text-surface-soft/80 ${linkClass}`}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="pt-2">
            <Link href="/conditions" className="inline-block py-1 text-xs text-surface-soft/70 hover:text-gold">
              View all conditions →
            </Link>
          </p>
        </div>

        <div>
          <p className="eyebrow text-gold mb-3">Therapies</p>
          <ul className="space-y-1">
            {therapies.slice(0, 6).map((t) => (
              <li key={t.slug}>
                <Link href={`/therapies/${t.slug}`} className={`text-surface-soft/80 ${linkClass}`}>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>

          <p className="pt-2">
            <Link href="/therapies" className="inline-block py-1 text-xs text-surface-soft/70 hover:text-gold">
              View all therapies →
            </Link>
          </p>
        </div>

        <div>
          <p className="eyebrow text-gold mb-3">Practice</p>
          <ul className="space-y-1 text-surface-soft/80">
            <li>
              <Link href="/about" className={linkClass}>About</Link>
            </li>
            <li>
              <Link href="/gallery" className={linkClass}>Gallery</Link>
            </li>
            <li>
              <Link href="/blog" className={linkClass}>Blog</Link>
            </li>
            <li>
              <Link href="/training-and-mentorship" className={linkClass}>Training and Mentorship</Link>
            </li>
            <li>
              <Link href="/case-studies" className={linkClass}>Case Studies</Link>
            </li>
            <li>
              <Link href="/corporate-wellness-programs-navi-mumbai" className={linkClass}>
                Corporate Wellness
              </Link>
            </li>
            <li>
              <Link href="/fees" className={linkClass}>Fees</Link>
            </li>
            <li>
              <Link href="/faq" className={linkClass}>FAQs</Link>
            </li>
            <li>
              <Link href="/testimonials" className={linkClass}>Testimonials</Link>
            </li>
            <li>
              <Link href="/privacy-policy" className={linkClass}>
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1">
          <p className="eyebrow text-gold mb-3">Get in touch</p>
          <ul className="space-y-1 text-surface-soft/80">
            <li className="py-0.5">{site.address.street}</li>
            <li className="py-0.5">{site.address.locality}</li>
            <li>
              <a href={`tel:${site.phone}`} className={linkClass}>
                {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className={`${linkClass} [overflow-wrap:anywhere]`}>
                {site.email}
              </a>
            </li>
            <li className="pt-2">
              <Link href="/contact" className="btn-primary inline-flex min-h-11 text-xs py-2 px-4">
                Book a session
              </Link>
            </li>
          </ul>

          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Social media">
            {socialLinks.map(({ name, href }) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} (opens in a new tab)`}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft/10 text-surface-soft transition-colors hover:bg-surface-soft/20 hover:text-gold"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    {socialIcons[name]}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-surface-soft/10 py-5 text-center text-xs text-surface-soft/70">
        <p>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
        <AnalyticsPreferencesButton className="mt-1 inline-block py-1 underline underline-offset-4 hover:text-gold" />
      </div>
    </footer>
  );
}
