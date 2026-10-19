# SEO fix report — chaitanyaraj.com

**Date:** 19 October 2026 · **Branch:** `dev` · **Framework:** Next.js 14.2.35 (App Router) on Vercel
**Scope:** the 18 findings from the SEO audit (H1–H4, M1–M6, L1–L8), plus problems found while fixing them.
**Not deployed.** All changes are on `dev`; production (`main`) is unchanged until the pull request is merged.

Measurements are in [SEO-VALIDATION-REPORT.md](SEO-VALIDATION-REPORT.md). Test scripts are in [`scripts/seo/`](../scripts/seo/README.md).

---

## 1. Summary

| | Before (live site) | After (local production build) |
|---|---|---|
| HTTP 200 pages found by crawl | 73 | 72 (team placeholder page no longer in the sitemap and not linked) |
| Indexable pages without an H1 | 43 (+ privacy page = 44) | **0** |
| Titles longer than 60 characters | 64 | **0** |
| Titles repeating the brand | 19 | **0** |
| Sitemap URLs returning 404 | 3 | **0** |
| Indexable pages missing from sitemap | 15 | **0** |
| Noindex pages in sitemap | 1 | **0** |
| Pages with a broken Open Graph image | 70 | **0** |
| Horizontal overflow at 375 px | 40 px on every page (415 px document) | **0 px** |
| Horizontal overflow at 1024 / 1440 px | 443 px / 171 px (desktop navigation) | **0 px** |
| axe serious/critical violations | colour contrast on 17 of 17 tested pages | **0** on all 71 pages |
| Lighthouse Best Practices / Accessibility | 73–77 / 95–96 | **100 / 100** (local build, 5 pages × mobile + desktop) |
| Mobile Total Blocking Time (lab) | 102–193 ms | 85–178 ms |
| Controls under 24 × 24 px (375 px, per page) | 17–22 | **0** |
| Third-party cookies on page load | 8 (Microsoft Clarity) | **0** until the visitor allows Clarity |
| Security headers | HSTS only | CSP, nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy |
| Homepage HTML caching | `no-store` (rendered per request) | `s-maxage=3600, stale-while-revalidate` (ISR) |

### Status of the 18 findings

| ID | Finding | Status |
|---|---|---|
| H1 | Missing H1 headings | FIXED |
| H2 | Sitemap errors and omissions | FIXED |
| H3 | Mobile horizontal overflow | FIXED |
| H4 | Keyword cannibalization | FIXED (on-page; ranking effect needs Search Console follow-up) |
| M1 | Long titles / duplicated branding | FIXED |
| M2 | Colour contrast | FIXED |
| M3 | Thin content and E-E-A-T | PARTIALLY FIXED |
| M4 | Security headers | FIXED |
| M5 | JavaScript performance | PARTIALLY FIXED (TBT < 200 ms everywhere; mobile LCP still 2.6–3.0 s in the lab) |
| M6 | Lighthouse Best Practices | FIXED (77 → 100) |
| L1 | Short meta descriptions | FIXED |
| L2 | Bad blog URL slugs | FIXED |
| L3 | Double space / long title | FIXED |
| L4 | Canonical formatting | FIXED |
| L5 | HTML caching | FIXED (verified locally; confirm on Vercel after deploy) |
| L6 | Small tap targets | PARTIALLY FIXED |
| L7 | Custom 404 page | FIXED |
| L8 | LinkedIn URL tracking parameters | FIXED (destination unverified: LinkedIn blocks automated requests) |

---

## 2. Baseline as reproduced

Every finding was checked against the live site and the code before fixing. The audit numbers held up, with these notes:

- **Missing H1:** 43 indexable pages + `/privacy-policy` (noindex) = the audit's 44.
- **Duplicated branding:** 19 rather than 16 — the extra three are titles such as `About | Chaitanya Raj Psychology & Counselling | Chaitanya Raj`, which also repeat the brand.
- **Mobile overflow:** 415 px document at 375 px (audit: 418 px). The same check also showed a much larger desktop overflow (443 px at 1024 px) that the audit didn't list.
- **Best Practices 73–77:** caused entirely by Microsoft Clarity's third-party cookies (added 15 Oct) plus a missing `/favicon.ico`.

---

## 3. Findings, root causes and fixes

### H1 — Missing H1 headings · FIXED
- **Root cause:** the shared `Section` component always rendered its title as `<h2>`. Pages that open with a `Section` (about pages, listings, therapy/case-study/training details, blog, fees, FAQ, contact, gallery, privacy) had no H1. Four CMS blog posts carried their own `<h1>` inside the content.
- **Fix:** `Section` takes `titleAs="h1"`; every page whose first section is the page title uses it, with unchanged styling. Card titles under those headings moved from `h3` to `h2` (`ConditionCard`, `TherapyCard`, case-study and training listings) so the outline has no gaps. Blog content: a content H1 matching the post title is dropped, any other becomes H2, and content headings that start at H3 move up a level.
- **Files:** `components/Section.tsx`, `components/ConditionCard.tsx`, `components/TherapyCard.tsx`, `lib/blog/seo.ts` (`prepareBlogHtml`), 24 page files.
- **Verification:** crawler — 0 indexable pages with 0 or >1 H1; heading-skip warnings 0.

### H2 — Sitemap · FIXED
- **Root cause:** `app/sitemap.ts` built blog URLs from `lib/data/blog.ts`, a static file with three posts that never existed on the live site, while real posts live in Firestore. Three live landing pages were never listed. `/privacy-policy` (noindex) was listed.
- **Fix:** the sitemap now lists indexable static routes explicitly, generates condition/therapy/training/case-study URLs from their data files, and reads published posts from Firestore (refreshed hourly, so new posts appear without a deploy). Blog `lastModified` is the CMS publish date; the CMS stores no edit dates, so none are invented and static pages carry none. Noindex pages and `/admin` are excluded. URLs use `https://www.chaitanyaraj.com` and the same root form as the canonical.
- **Files:** `app/sitemap.ts`, `lib/blog/seo.ts`.
- **Verification:** 71 URLs, all 200, none redirected or noindex, no duplicates, every crawled indexable page included, 12 valid `lastmod` dates.

### H3 — Mobile horizontal overflow · FIXED
- **Root causes (Playwright, element-level):**
  1. Footer email link in a half-width column (right edge at 415 px on a 375 px screen) — every page, 320–768 px.
  2. Desktop navigation: 10 items at 1,126 px inside a 1,104 px container, so the header overflowed from 1024 px up to ~1,900 px and pushed **Book a session** off-screen at 1024–1440 px.
  3. Hero H1s at 48 px on the hypnotherapy and online-therapy pages ("Hypnotherapist", "psychological" are wider than a 320–390 px screen).
- **Fix:** the contact column spans the full width on mobile and the email may wrap; the header container widens, the full navigation shows from 1280 px with shorter labels between 1280 and 1535 px ("Training", "International", "Corporate" — same links), the hamburger menu is used below 1280 px, and the last two dropdowns open leftwards. Those two hero H1s use 36 px below 640 px (the size the homepage and condition pages already use on mobile); all hero H1s get `break-words` as a safety net. The floating social bar stays visible on every screen size, as the site owner wants it on mobile. It is a fixed element, so it adds no horizontal scroll, and it sits below the open mobile menu. On narrow screens it still covers the right edge of the text, as it did before. `overflow-x: hidden` was not used.
- **Files:** `components/Footer.tsx`, `components/Header.tsx`, `components/Floatingocials.tsx`, `lib/data/socialLinks.ts`, hero pages.
- **Verification:** validation report §7 — all 71 sitemap pages at 320, 360, 375, 390, 414, 768, 1024 and 1440 px: 0 px overflow (the one page that still overflowed in the first full run was fixed and re-checked).

### H4 — Keyword cannibalization · FIXED (on-page)
- **Root cause:** four blog posts had CMS meta titles written as service pages ("Relationship Counselling in Navi Mumbai", "Trauma Therapy & Counselling in Navi Mumbai", "Anger Management Therapy in Navi Mumbai", "Sexual Aversion Disorder Treatment in Navi Mumbai"); the relationship condition page and the couples therapy page used near-identical couples titles; none of the pages linked to each other (the couples landing page linked only to `/contact`).
- **Intent and roles:**

  | Group | Main landing page (commercial) | Supporting pages (informational) |
  |---|---|---|
  | Couples / relationship | `/couples-counselling-navi-mumbai` — "couples counselling navi mumbai" | `/conditions/relationship-counselling-navi-mumbai` — relationship counselling (partner, spouse, family); `/therapies/couples-and-relationship-counselling` — how sessions work; blog posts on fixing a relationship, feeling unheard, intimacy |
  | Trauma | `/conditions/trauma-ptsd-counselling-navi-mumbai` | `/blog/how-to-overcome-emotional-trauma` |
  | Anger | `/conditions/anger-management-counselling-navi-mumbai` | `/blog/dealing-with-aggressive-people`, `/case-studies/anger-management` |
  | Aversion to sex | `/conditions/sexual-dysfunction-counselling-navi-mumbai` | `/blog/aversion-to-sex` (client story), `/case-studies/aversion-to-sex` (structured case) |

- **Fix:** informational titles for the four posts ("How to Fix a Relationship Before It's Too Late", "How to Overcome Emotional Trauma", "Dealing With Aggressive People", "Aversion to Sex in Marriage: A Client's Story"); relationship condition page retitled "Relationship Counselling in Navi Mumbai" with a partner/spouse/family description; the couples therapy page retitled "How Couples Counselling Sessions Work" with H1 "How Couples & Relationship Counselling Works". Internal links now run both ways: service pages → "Further reading"; posts → "What can help"; case studies → related pages; the couples landing page gained a "Further reading" section. Canonicals remain self-referencing and breadcrumbs match each page.
- **No merges or redirects:** the competing pages are distinct (a narrative post vs. a structured case; a method page vs. a service page), so nothing was consolidated. If `/therapies/couples-and-relationship-counselling` still competes after re-crawl, merging it into the couples landing page with a 301 is the next step.
- **Files:** `lib/blog/seo.ts`, `lib/seo/internalLinks.ts`, `lib/data/conditions.ts`, `lib/data/therapies.ts`, `app/conditions/[slug]/page.tsx`, `app/therapies/[slug]/page.tsx`, `app/case-studies/[slug]/page.tsx`, `app/couples-counselling-navi-mumbai/page.tsx`, `app/blog/[slug]/page.tsx`.
- **Limitation:** the CMS still stores the old meta titles; `lib/blog/seo.ts` overrides them. Update them in the admin and then delete the `metaTitle` overrides. Ranking changes can only be confirmed in Search Console after re-crawl.

### M1 — Titles · FIXED
- **Root cause:** the layout template appends ` | Chaitanya Raj`, and many page and CMS titles already ended with the brand or were too long to take a suffix.
- **Fix:** `buildMetadata` strips brand segments from any title (including CMS titles) and appends the brand only when the result fits in 60 characters; longer titles go out without it. The homepage title is written in full because the template doesn't apply to the root page. Hand-written titles were shortened where they lost meaning when cut.
- **Files:** `lib/seo/metadata.ts`, page metadata across `app/`.
- **Verification:** 0 titles over 60 characters, 0 duplicated brands, 0 duplicate titles, 0 whitespace problems.

### M2 — Colour contrast · FIXED
- **Root cause:** coral `#E0794F` used as small text on light surfaces (2.4–3.0:1): eyebrow labels, "Learn more →" links, testimonial names, error text. Faded `ink-soft/60–70` text (2.5–2.9:1). Footer copyright at 50 % opacity (3.7:1). A 60 %-white eyebrow on the teal band (3.9:1). The focus outline was the same coral (2.7:1, below the 3:1 needed).
- **Fix:** a new `accent-ink` token (`#AB471E`, same hue; 5.1:1 on the background, 4.6:1 on soft panels, 5.8:1 on white) for accent-coloured text; the original coral stays for buttons, borders and decoration. Faded text uses full `ink-soft` (5.4:1). Footer text ≥ 70 % opacity (5.8:1). Focus outline is dark teal on light sections (11:1) and gold on dark ones (7:1). Decorative gold bullet glyphs became CSS dots.
- **Files:** `tailwind.config.ts`, `app/globals.css`, components and pages using `text-accent`/faded text.
- **Verification:** axe-core 4.14 (WCAG 2.0/2.1/2.2 A/AA) — 0 serious or critical violations.

### M3 — Thin content and E-E-A-T · PARTIALLY FIXED
- **Measured:** main-content words (inside `<main>`, excluding header/footer) — therapy pages 68–123, case studies 79–112, training pages 75–96, team 46, fees 73, gallery 30 (photo albums).
- **Done:**
  - Therapy, case-study and training pages gained a practice section built only from facts already on the site: who leads the practice (founder name and published credentials, link to the founder page), where sessions take place (Vashi, CBD Belapur, online; the FAQ's note that some hypnotherapy/Ego State work suits in-person sessions), what to know before starting (mention medication or current care; sessions aren't an emergency service), related approaches, and links to fees and FAQs.
  - Complementary techniques (PLRT, SRT, Energy Exchange, Quantum Therapy) carry a note that they are not a substitute for evidence-based treatment, which restates what their pages already say.
  - Case studies say they describe one person's experience and are not a guarantee of a similar result.
  - Training pages show their place in the pathway.
  - Result: therapy pages 216–294 words, case studies 247–289, training 149–171.
  - `/about/chaitanya-raj` lost its visible "Replace this page … before launch" note and gained clinic, online and approach details taken from the founder data.
- **Not done (needs the practice):**
  - The team page is entirely placeholder ("Team member name"); it is now **noindex** and out of the sitemap rather than filled with invented people.
  - No therapy-specific clinical explanations, evidence, outcomes, FAQs, session counts, course dates or fees were written.
  - Fees, gallery and vastu pages were not expanded.
- **Limitation:** the added text is shared across pages and helps visitors and trust signals; it isn't unique per-topic content. Pages still need practitioner-written, clinically reviewed content.

### M4 — Security headers · FIXED
- **Fix:** headers for all routes via `next.config.js`:
  - `Content-Security-Policy` (enforced; allowlists Google Analytics, Microsoft Clarity, Firebase/Google APIs used by the admin, Web3Forms, Google Maps and YouTube frames; `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (camera, microphone, geolocation, payment, USB, topics disabled)
  - `X-Powered-By` removed
- **Why `'unsafe-inline'` for scripts:** Next.js streams page data in inline scripts. Nonces would force every page to render per request and undo the static/ISR caching in L5. Hash-based CSP isn't workable with per-page inline payloads in Next 14.
- **Caught in testing:** the first policy blocked Google Analytics hits to `analytics.google.com` and `www.google.com/g/collect` (a `*.` wildcard doesn't match the bare host). Both hosts were added before anything shipped.
- **Development mode:** under `next dev` the policy also allows `'unsafe-eval'`, which Next.js needs for its development bundles. Without it the page never hydrated locally (the consent buttons and menu did nothing). Production builds don't include it (checked in `.next/routes-manifest.json`).
- **Unchanged:** HSTS stays at Vercel's default (`max-age=63072000`); `includeSubDomains`/`preload` were not added, as instructed.
- **Verification:** headers present on every response; consent/CSP test — no CSP violations on public pages or `/admin/login`; GA and (after consent) Clarity load.
- **Limitation:** admin flows that need a login (uploads, editing) could not be exercised without credentials. Their domains (`*.googleapis.com`) are allowed. Check the browser console once on the preview deployment.

### M5 — JavaScript performance · PARTIALLY FIXED
- **Done:**
  - Google Analytics moved from `beforeInteractive` to `afterInteractive`.
  - Microsoft Clarity is no longer loaded until the visitor allows it (see M6).
  - `Hero` and `FloatingSocials` no longer ship as client components (Hero's animation CSS moved from styled-jsx to `globals.css`).
  - The unused Fraunces italic font (a ~46 KB preloaded file on every page) was removed.
  - Homepage, blog and gallery are statically generated with revalidation instead of rendered per request.
  - The breathing animation respects `prefers-reduced-motion`.
- **Not changed:** the React/Next runtime chunk and `gtag.js` itself (third-party), which are the remaining main-thread costs.
- **Result:** Lighthouse, same machine, median of 3, original vs. fixed code.

  | | Before | After |
  |---|---|---|
  | Mobile TBT | 102–162 ms | **85–178 ms** — under 200 ms on every tested page |
  | Mobile Performance | 71–95 | **92–96** |
  | Desktop Performance | 100 | 100 |
  | Homepage mobile LCP | 5.6 s | **3.0 s** |
  | Homepage first-load JS | 108 kB | **103 kB** |

  The audit's 270–390 ms TBT wasn't reproduced; the live site measured 161–193 ms on this machine before any change.
- **Why only partially fixed:**
  - Mobile LCP is 2.6–3.0 s in the local lab, above the 2.5 s goal. It is ~170 ms slower than before on two pages, within run-to-run variation here.
  - `gtag.js` (~180 KB) is still the largest single script.
  - Re-measure on production; the live baseline on the CDN was 2.1–2.6 s.

### M6 — Lighthouse Best Practices · FIXED
- **Root cause:** Microsoft Clarity sets eight third-party cookies (`clarity.ms`, `c.bing.com`) as soon as its tag loads, which fails `third-party-cookies` and `inspector-issues`; `/favicon.ico` returned 404 (`errors-in-console`).
- **Investigation:** in a real browser, Clarity's consent API (`consent`/`consentv2` denied) only stopped its first-party cookies; the third-party cookies were still set. The only way to avoid them is not to load the tag without permission.
- **Fix:**
  - A small, brand-styled consent banner. Clarity loads only after **Allow**, the choice is remembered, and "Analytics preferences" in the footer reopens it.
  - The privacy policy now discloses Clarity, its cookies and the Web3Forms form processor.
  - Favicon, icon and apple-touch-icon were added.
- **Banner rendering:** the banner is rendered in the server HTML and hidden before first paint for visitors who already chose (a one-line inline script reads the stored choice). A client-only version became the mobile LCP element on `/contact` and delayed it.
- **Result:** Best Practices **77 → 100** on all five tested pages, mobile and desktop. The automated consent test also confirms:
  - no Clarity request and no third-party cookies before consent
  - Clarity loads after **Allow**
  - the choice is remembered and can be changed
  - Google Analytics keeps working
- **Trade-off:** Clarity now records only visitors who opt in. To restore the previous behaviour, render the Clarity snippet unconditionally in `app/layout.tsx` (Best Practices will drop again).

### L1 — Short meta descriptions · FIXED
New descriptions of 126–159 characters for `/about/our-team`, `/privacy-policy`, `/fees`, `/testimonials`, `/about/vastu-consultation`, `/therapies/mindfulness-based-therapy` and `/therapies/couples-and-relationship-counselling`. Each one restates facts on its page. Typos also fixed in two descriptions ("counselling in in", "oonline", "clinets", "Bok"). One CMS description is 162 characters (warning only; edit in the admin).

### L2 — Bad blog slugs · FIXED
- `blogpast-life-regression-session-story-vashi` → `past-life-regression-session-story-vashi`
- `intimacy-problems-in-marriage-how-to-reconnect-excerpt` → `intimacy-problems-in-marriage-how-to-reconnect`
- **How:** the Firestore document IDs are the slugs, and editing production data wasn't in scope, so `lib/blog/slug-aliases.json` maps clean slugs to the existing documents. The old URLs return a single-hop **301** (`next.config.js`). Listings, homepage cards, sitemap, canonicals, breadcrumbs and Article schema use the clean URLs. Post lookup tries the clean ID first, so re-saving a post under its clean ID in the CMS later keeps working.
- **Verification:** old URLs → 301 → new URL → 200; no chains or loops.

### L3 — Double space and long title · FIXED
`Online Clinical  Psychologist for Global Clients | Therapy & Counselling` → `Online Therapy for International Clients | Chaitanya Raj` (56 characters). All titles are whitespace-normalised; the crawler checks for double, leading and trailing spaces.

### L4 — Canonical formatting · FIXED
- **Root cause:** Next.js serialises the homepage canonical without a trailing slash, while the sitemap used `https://www.chaitanyaraj.com/`.
- **Fix:**
  - The homepage URL is now `https://www.chaitanyaraj.com` everywhere: canonical, `og:url`, sitemap and JSON-LD.
  - Interior routes have no trailing slash, and `/about/` → 308 → `/about`.
  - Every page has exactly one absolute HTTPS `www` canonical, and none point to dead or redirected pages.

### L5 — HTML caching · FIXED (confirm on Vercel)
- **Root cause:** `export const dynamic = "force-dynamic"` on the homepage, blog and gallery made every request render on the server with `Cache-Control: private, no-store`.
- **Fix:** incremental static regeneration — homepage and gallery revalidate hourly, blog list and posts every 5 minutes, sitemap hourly. Blog posts are pre-rendered at build time from Firestore. Nothing personalised is rendered on these pages. Upcoming/previous events on the homepage are recalculated at most an hour late.
- **Verification:** local production server returns `s-maxage=3600, stale-while-revalidate` on `/`. Vercel's cache headers can only be confirmed after deployment.

### L6 — Small tap targets · PARTIALLY FIXED
- **Done:**
  - Every control is now at least 24 × 24 px (WCAG 2.2 AA 2.5.8). Footer links kept their visual rhythm by trading spacing for padding.
  - Primary controls are 44 px: menu button, mobile submenu toggles and links, location buttons, related-link chips, sidebar links, consent buttons and social icons.
- **Not done:** footer text links and the text logo are 24–30 px tall rather than 44 px. Making them 44 px would have lengthened the mobile footer by ~400 px.
- **Verification:** 0 controls under 24 px on tested pages (was 17–22).

### L7 — Custom 404 page · FIXED
`app/not-found.tsx`: brand layout, H1 "We couldn't find that page", links to conditions, therapies, counselling and blog, homepage and contact CTAs, and a phone link. It returns HTTP 404 with `noindex`, for unknown URLs and for unknown condition, therapy, case-study, training and blog slugs.

### L8 — LinkedIn URL · FIXED (destination unverified)
- **Floating bar:** `?utm_source=share_via&utm_content=profile&utm_medium=member_ios` was removed from the LinkedIn link, and `?igsh=…&utm_source=qr` from the Instagram link.
- **Shared list:** the links now live in one list (`lib/data/socialLinks.ts`) used by the floating bar.
- **Verification:** LinkedIn answered automated requests with HTTP 429, so the destination is **unverified**. Open the link in a browser to confirm it.

---

## 4. Other problems found and fixed

1. **Visible placeholder text on live pages:**
   - "Hero paragraph" at the start of the homepage hero text
   - "Replace this page … before launch" on `/about/chaitanya-raj`
   - a stale "Placeholder entries" note on `/about/media-highlights`, whose entry is real
2. **Contact page map:** clipped by a fixed `h-[320px] overflow-hidden` box. On mobile the map was not visible at all. The page now uses a compact map (clinic switcher, address and map) because the contact details are already listed above it.
3. **CMS formatting:** one post (`how-to-fix-a-relationship-before-its-too-late`) joined every word with `&nbsp;`, which blocked line wrapping. These are normalised when rendering.
4. **Media highlights:** the magazine image had a fixed 1,077 px height, cropping it heavily on mobile. It now uses the image's own aspect ratio.
5. **Missing assets:** `og-default.jpg` (1200 × 630), `logo.png`, `favicon.ico`, `icon.png` and `apple-icon.png` were generated from the existing CR logo. `/og-default.jpg` and `/logo.png` were referenced but returned 404.
6. **Structured data:**
   - Organization: stable `@id`, logo, founder link, Belapur clinic (address only — its coordinates are marked "to replace" in `site.ts`).
   - Person and Article: Person links to the founder page; Article uses the visible headline and has an image and `dateModified`.
   - Blog: BreadcrumbList added to blog posts.
   - Therapy pages: `MedicalTherapy` was replaced by `PsychologicalTreatment`, or by `Service` for the techniques the site itself calls complementary, so the markup doesn't present them as medical therapy.
7. **Accessibility extras:**
   - skip-to-content link
   - landmarks for the floating social bar and consent banner
   - `aria-expanded`/`aria-controls` on the menus
   - `aria-pressed` on the clinic switcher
   - "opens in a new tab" labels on social links
8. **Internal linking:** `/therapies`, `/fees`, `/faq` and `/testimonials` were in the sitemap but not linked from any page; they are now in the footer. `/about/vastu-consultation` is still unlinked, because its link on the About page had been commented out deliberately (see §6).
9. **Test hygiene:** the browser and Lighthouse scripts now block analytics hits so test runs don't appear in Google Analytics or Clarity. Earlier runs on 19 Oct did send some page views before this was added: the live-site baseline, and about one minute of a local run with hostname `localhost`. Filter `localhost` out in GA if it shows up.
10. **Heading layout:** a corporate-page heading ("organisation" at 60 px) overflowed at 768 px, and one CMS post had an empty `<h2>`. Both were found in the full-site run and fixed.

---

## 5. Files

- **New:**
  - `app/not-found.tsx`, `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`
  - `public/og-default.jpg`, `public/logo.png`
  - `components/AnalyticsConsent.tsx`, `components/AnalyticsPreferencesButton.tsx`, `components/PracticeDetails.tsx`
  - `lib/analyticsConsent.ts`, `lib/blog/seo.ts`, `lib/blog/slug-aliases.json`, `lib/data/socialLinks.ts`, `lib/seo/internalLinks.ts`
  - `scripts/seo/*` (four checkers + README)
  - `docs/SEO-FIX-REPORT.md`, `docs/SEO-VALIDATION-REPORT.md`
- **Modified (50):**
  - **config:** `next.config.js`, `tailwind.config.ts`, `package.json` (scripts only; no new dependencies)
  - **`app/` (32):** `layout.tsx`, `sitemap.ts`, `globals.css` and 29 page files
  - **`lib/` (4):** `seo/metadata.ts`, `seo/jsonld.tsx`, `data/conditions.ts`, `data/therapies.ts`
  - **`components/` (11):** Section, Header, Footer, Hero, Floatingocials, LocationMap, ConditionCard, TherapyCard, ContactForm, EventsSection, Testimonials

---

## 6. Needs a person: external and manual tasks

**Content and accuracy (do not publish as-is without review)**
- `/about/our-team` is placeholder ("Team member name") — add real people or remove the page; it's noindex meanwhile.
- `/privacy-policy` still says it is placeholder text pending professional review; it now discloses GA, Clarity and Web3Forms but needs a legal check.
- Confirm the three testimonials are genuine and consented, and that the fees are current.
- **Clinical/credential claims to review:**
  - "recognised by the British Psychological Society as an effective therapeutic technique" (About, Myths & Facts)
  - "research generally shows comparable outcomes" (FAQ)
  - founder description "NCAHP-registered clinical psychologist" — "clinical psychologist" is an RCI-regulated title in India; elsewhere the site says "Clinical Hypnotherapist & Counselling Psychologist"
  - case-study outcomes
  - the aversion-to-sex blog (hypnotherapy) and case study (CBT + Ego State) describe different approaches
- Instagram: the floating bar/footer link `@rajmeditation`, but the schema's `sameAs` uses `@rajeshbits` — confirm the official account.
- Belapur clinic coordinates in `lib/data/site.ts` are marked "replace with coords from Google Maps" (they drive the map embed).
- `/about/vastu-consultation` is indexable and in the sitemap but its About-page link was commented out — either link it or noindex it.
- Add practitioner-written, clinically reviewed content to therapy, case-study, training, fees and team pages (M3).

**CMS (Firestore admin)**
- Update the four posts' meta titles to match `lib/blog/seo.ts`, then remove those overrides.
- Optionally re-save the two posts under their clean slugs.
- Trim the 162-character description on the past-life-regression post.
- Consider recording an `updatedAt` on edits (check Firestore rules first) so the sitemap can report real modification dates.

**Hosting and Google**
- Merge `dev` → `main`, then confirm on production: `Cache-Control` on `/`, security headers, no console/CSP errors (including the admin login and upload), and the consent banner.
- Vercel domains: `http://chaitanyaraj.com` takes two hops (http → https → www). Set the apex to redirect straight to `https://www.chaitanyaraj.com` if Vercel allows; HSTS `includeSubDomains`/`preload` intentionally not enabled.
- Search Console: resubmit `sitemap.xml`, inspect the two redirected blog URLs, and watch impressions for the four cannibalization groups over the next 4–8 weeks.
- Run Google's Rich Results Test on the deployed URLs (it can't test localhost). FAQ rich results are now limited to authoritative government and health sites, so valid FAQPage markup may not show.
- INP was not measured (no CrUX/PSI field data access).
- Decide whether Google Analytics also needs consent (e.g. GA Consent Mode v2 for EEA/UK visitors); it currently loads for everyone with first-party cookies.
- ESLint isn't configured in the project (`next lint` asks to set it up); enabling it means adding `eslint` and `eslint-config-next`.

---

## 7. Google Search Console follow-up (report of 19 Oct 2026)

Each URL in the Search Console export was re-checked on the live site and on the `dev` build (redirect chains followed hop by hop, with a Googlebot user agent).

| GSC issue | URLs | Live now | After `dev` is merged | Still needs a person |
|---|---|---|---|---|
| Blocked due to other 4xx (first seen 10 Oct, last crawl 13 Oct) | 25 | All 16 new-site pages, including the homepage, return **200** to a Googlebot user agent. Of the 7 old WordPress URLs, 6 return 404 (`/contact/` already reaches `/contact`). | Old WordPress URLs 301 to their new pages. The fake blog post stays 404 and is out of the sitemap. | Find what returned 4xx on 10–13 Oct; the cause isn't visible from outside. **Vercel's firewall is active on this project:** `/wp-*` and `.php` requests get `X-Vercel-Mitigated: challenge`. Check Vercel → Firewall (Attack Challenge Mode, Bot Protection, custom rules), Usage and Deployments for 10–13 Oct. Then URL Inspection → Live Test on `https://www.chaitanyaraj.com/` and **Validate fix**. |
| Not found (404) | 25 | Still 404 | 19 now redirect (301) to the closest page. The other six stay as they are on purpose, because a redirect to an unrelated page is treated as a soft 404: `/feed`, the junk test posts `/blog/awd` and `/blog/ewkwjebfljksneef`, the never-published placeholder `/blog/supporting-a-partner-through-depression`, and the `/*` and `/wp-admin/*` entries (the latter is a firewall 403). | **Validate fix** after deploying. |
| Page with redirect | 7 | Expected (http → https, trailing slash). | Unchanged. The sitemap now lists only final URLs. | `http://chaitanyaraj.com` takes two hops (Vercel domain setting). |
| Blocked due to access forbidden (403) | 4 | `wp-json`, `wp-content`, `wp-admin`: 403 from Vercel's firewall challenge | Unchanged — these are leftovers from the old WordPress site, not pages. | Nothing required. Optionally mark as fixed/ignore in GSC. |
| Duplicate without user-selected canonical | 2 | `/online-therapy-international-clients` already has a self-referencing canonical. `/therapies/clinical-hypnotherapy` no longer exists (404). | `/therapies/clinical-hypnotherapy` → 301 → `/hypnotherapy-navi-mumbai`. | **Validate fix**. |
| Blocked by robots.txt | 1 (`/privacy-policy`) | robots.txt no longer blocks it. The page is intentionally `noindex` (placeholder policy). | Unchanged. | Nothing. |
| Crawled, currently not indexed | 10 | 5 old WordPress URLs return 404. The other 5 are font files (`.woff2`). | The 5 old URLs 301 to their new pages. One font file was removed (unused italic). | Fonts don't need action: Google lists them because it fetches them to render pages. Blocking `/_next/static/media/` in robots.txt isn't recommended because rendering uses them. |
| Discovered, not indexed | 1 | Placeholder post that never existed | Removed from the sitemap. | Nothing. |
| Sitemaps: 11 "Couldn't fetch" | 13 submitted | Current sitemap has 61 URLs, 3 of them 404 | Sitemap has 71 URLs, all 200 | In GSC → Sitemaps, **remove** every entry except `https://www.chaitanyaraj.com/sitemap.xml` (including the apex `https://chaitanyaraj.com/sitemap.xml`), then resubmit it. |
| Spam PHP sitemaps (`trust.php`, `godsend.php`, …) | 10 | Not served: Vercel returns a firewall 403 challenge, and the files don't exist in this project. | Unchanged | Make sure the **old WordPress hosting account is closed or cleaned**. Those files came from a compromise of that server, not this site. |
| Core Web Vitals: not enough data | – | Not an error; too little Chrome traffic for field data. | – | Use PageSpeed Insights lab data meanwhile. |

**Redirect hops on production:** an old WordPress URL on the bare domain will take three hops after deployment (Vercel apex → www, Next.js trailing slash, then the 301). Google follows up to 10 hops. To get a single hop, these redirects would have to move to Vercel's edge (`vercel.json`), which can only be tested after deploying.
