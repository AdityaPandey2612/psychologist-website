# SEO validation report — chaitanyaraj.com

**Date:** 19 October 2026 · **Branch:** `dev` (not deployed)
Companion to [SEO-FIX-REPORT.md](SEO-FIX-REPORT.md), which explains each change.

## 1. How this was measured

| Measurement | Environment |
|---|---|
| **Baseline (live)** | https://www.chaitanyaraj.com as deployed on 19 Oct 2026 (`main` @ `d153b28`, Vercel) |
| **Baseline (local)** | the same `main` commit built with `next build` and served by `next start` on this machine — used for like-for-like Lighthouse comparisons |
| **After** | `dev` with all fixes, built and served the same way |

- **Tools:**
  - `scripts/seo/seo-check.mjs` — crawler, no dependencies
  - `scripts/seo/mobile-a11y-check.mjs` — Playwright 1.64 + axe-core 4.14 in Chrome
  - `scripts/seo/consent-csp-check.mjs`
  - `scripts/seo/lighthouse.mjs` — Lighthouse 13.5, Chrome headless
- **Analytics:** Google Analytics/Clarity hits were blocked during browser and Lighthouse runs so tests don't count as visits. The scripts load the tags; only the hits are blocked.
- **What this report can't show:**
  - Local lab numbers are not production numbers: no CDN, same machine for server and browser.
  - Field data (CrUX, INP) was **not measured**.
  - Google's Rich Results Test needs a public URL and was **not run**.

## 2. Technical SEO (crawler)

The crawler starts at `/` and every sitemap URL and follows internal links (excluding `/admin`, `/api`).

| Check | Live baseline | After |
|---|---|---|
| URLs crawled / HTTP 200 / indexable | 76 / 73 / 72 | 72 / 72 / 71 |
| Non-200 URLs reached from the sitemap | 3 (404) | 0 |
| Indexable pages with no H1 | 43 | **0** |
| Pages with more than one H1 | 0 | 0 |
| Titles > 60 characters | 64 | **0** |
| Titles repeating the brand | 19 | **0** |
| Titles with double/leading/trailing spaces | 1 | 0 |
| Duplicate titles / descriptions | 0 / 0 | 0 / 0 |
| Pages whose `og:image` does not load | 70 | **0** |
| Canonical tags: missing / multiple / wrong | 0 / 0 / 1 (root form differed from sitemap) | 0 / 0 / 0 |
| Invalid JSON-LD blocks | 0 | 0 |
| Images without an `alt` attribute | 0 | 0 |
| Broken or redirected internal links | 0 | 0 |
| Sitemap URLs / sitemap problems / indexable pages missing from sitemap | 61 / 19 / 15 | 71 / **0** / **0** |
| `robots.txt` sitemap line and rules | OK | OK |
| Unknown URLs (6 probes incl. dynamic slugs) return 404 | yes | yes |
| Warnings | 64 long titles, 3 long descriptions | 1 description of 162 characters (CMS post) |

Total crawler failures: **135 → 0**.

## 3. Sitemap comparison

| | Before | After |
|---|---|---|
| URLs | 61 | 71 |
| Returning 404 | 3 | 0 |
| Noindex pages listed | 1 (`/privacy-policy`) | 0 |
| Homepage form | `https://www.chaitanyaraj.com/` (canonical had no slash) | `https://www.chaitanyaraj.com` (same as canonical) |
| `lastmod` | none | 12 (blog publish dates from the CMS; static pages have none rather than invented dates) |
| Source of blog URLs | static file with 3 non-existent posts | Firestore, refreshed hourly |

**Removed:**
- `/blog/grounding-techniques-before-a-big-moment` (404)
- `/blog/supporting-a-partner-through-depression` (404)
- `/blog/what-happens-in-your-first-cbt-session` (404)
- `/privacy-policy` (noindex)
- `/about/our-team` (now noindex — placeholder content)

**Added:**
- `/hypnotherapy-navi-mumbai`
- `/corporate-wellness-programs-navi-mumbai`
- `/gallery`
- the 12 published blog posts, including the two clean slugs `/blog/past-life-regression-session-story-vashi` and `/blog/intimacy-problems-in-marriage-how-to-reconnect`

Every sitemap URL returned 200 and was indexable, unique and identical to its page's canonical.

## 4. Redirects, status codes, headers and caching (local production server)

| Check | Result |
|---|---|
| `/blog/blogpast-life-regression-session-story-vashi` | 301 → `/blog/past-life-regression-session-story-vashi` → 200 (one hop) |
| `/blog/intimacy-problems-in-marriage-how-to-reconnect-excerpt` | 301 → `/blog/intimacy-problems-in-marriage-how-to-reconnect` → 200 (one hop) |
| Trailing slash `/about/` | 308 → `/about` |
| Unknown page `/nope-xyz` | 404, branded page, `noindex`, H1 present |
| `Content-Security-Policy` | present (enforced) |
| `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` | `nosniff` / `SAMEORIGIN` / `strict-origin-when-cross-origin` / restrictive |
| `X-Powered-By` | removed |
| `Cache-Control` on `/` | before `private, no-cache, no-store` (live) → after `s-maxage=3600, stale-while-revalidate` |
| `/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/og-default.jpg`, `/logo.png` | all 200 (favicon and OG image were 404 before) |
| HTTP → HTTPS → www (live) | `http://chaitanyaraj.com` → `https://chaitanyaraj.com` → `https://www.chaitanyaraj.com` (2 hops; Vercel domain setting, unchanged) |

## 5. Page-level comparison

Live baseline → after. Main-content words are counted inside `<main>`, excluding header and footer. Two blog rows show the old slug → new slug.

| Page | Status | H1 count | Title length | Title (after) | Description length | Main-content words |
|---|---|---|---|---|---|---|
| / | 200 → 200 | 1 → 1 | 68 → 56 | Psychologist & Counsellor in Navi Mumbai \| Chaitanya Raj | 157 → 157 | 1339 → 1337 |
| /about | 200 → 200 | 0 → 1 | 62 → 56 | About Our Practice in Vashi, Navi Mumbai \| Chaitanya Raj | 138 → 138 | 195 → 195 |
| /about/chaitanya-raj | 200 → 200 | 0 → 1 | 29 → 51 | Our Mission and Approach to Therapy \| Chaitanya Raj | 160 → 153 | 83 → 141 |
| /about/media-highlights | 200 → 200 | 0 → 1 | 72 → 51 | Media Highlights and Press Coverage \| Chaitanya Raj | 157 → 157 | 54 → 42 |
| /about/myths-and-facts-about-hypnotherapy | 200 → 200 | 0 → 1 | 67 → 54 | Hypnotherapy Myths and Facts Explained \| Chaitanya Raj | 159 → 159 | 196 → 196 |
| /about/our-team | 200 → not crawled | 0 → - | 24 → - |  | 78 → - | 46 → - |
| /about/the-founder | 200 → 200 | 1 → 1 | 71 → 55 | Lt Col Rajesh Sharma (Retd) \| Psychologist, Navi Mumbai | 151 → 151 | 880 → 880 |
| /about/vastu-consultation | 200 → 200 | 0 → 1 | 34 → 49 | Vastu Consultation in Navi Mumbai \| Chaitanya Raj | 110 → 159 | 66 → 66 |
| /blog | 200 → 200 | 0 → 1 | 65 → 49 | Blog: Psychology, Therapy & Hypnotherapy Insights | 150 → 150 | 658 → 654 |
| /blog/aversion-to-sex | 200 → 200 | 0 → 1 | 65 → 45 | Aversion to Sex in Marriage: A Client's Story | 151 → 151 | 687 → 704 |
| /blog/blogpast-life-regression-session-story-vashi → /blog/past-life-regression-session-story-vashi | 200 → 200 | 0 → 1 | 67 → 51 | Inside a Past Life Regression Session: A Real Story | 147 → 147 | 817 → 831 |
| /blog/counselling-vs-therapy-vs-hypnotherapy-difference | 200 → 200 | 1 → 1 | 73 → 57 | Counselling vs Hypnotherapy \| Navi Mumbai \| Chaitanya Raj | 157 → 157 | 915 → 914 |
| /blog/dealing-with-aggressive-people | 200 → 200 | 0 → 1 | 70 → 46 | Dealing With Aggressive People \| Chaitanya Raj | 153 → 153 | 1101 → 1110 |
| /blog/feeling-unheard-in-your-marriage-the-silent-problem-behind-most-divorces | 200 → 200 | 1 → 1 | 65 → 49 | Feeling Unheard in Your Marriage? \| Chaitanya Raj | 139 → 139 | 1565 → 1562 |
| /blog/grounding-techniques-before-a-big-moment | 404 → not crawled | 0 → - | 68 → - |  | 160 → - | 0 → - |
| /blog/how-to-fix-a-relationship-before-its-too-late | 200 → 200 | 1 → 1 | 71 → 46 | How to Fix a Relationship Before It's Too Late | 151 → 151 | 1377 → 1370 |
| /blog/how-to-overcome-emotional-trauma | 200 → 200 | 0 → 1 | 75 → 48 | How to Overcome Emotional Trauma \| Chaitanya Raj | 153 → 153 | 1049 → 1062 |
| /blog/how-to-stop-negative-thoughts | 200 → 200 | 0 → 1 | 65 → 49 | How to Overcome Negative Thoughts \| Chaitanya Raj | 148 → 148 | 827 → 841 |
| /blog/intimacy-problems-in-marriage-how-to-reconnect-excerpt → /blog/intimacy-problems-in-marriage-how-to-reconnect | 200 → 200 | 0 → 1 | 79 → 47 | Intimacy Problems in Marriage: How to Reconnect | 127 → 126 | 855 → 860 |
| /blog/supporting-a-partner-through-depression | 404 → not crawled | 0 → - | 68 → - |  | 160 → - | 0 → - |
| /blog/understanding-depression-signs-research-and-real-stories | 200 → 200 | 0 → 1 | 68 → 52 | Signs of Depression: What Research and Practice Show | 148 → 148 | 1569 → 1577 |
| /blog/understanding-ocd-in-adults | 200 → 200 | 0 → 1 | 59 → 43 | Understanding OCD in Adults \| Chaitanya Raj | 133 → 133 | 1224 → 1226 |
| /blog/what-actually-happens-in-a-past-life-regression-session-and-why-people-sometimes-cry-halfway-through | 200 → 200 | 1 → 1 | 68 → 52 | What Happens in Past Life Regression \| Chaitanya Raj | 162 → 162 | 896 → 886 |
| /blog/what-happens-in-your-first-cbt-session | 404 → not crawled | 0 → - | 68 → - |  | 160 → - | 0 → - |
| /case-studies | 200 → 200 | 0 → 1 | 65 → 53 | Therapy Case Studies from Navi Mumbai \| Chaitanya Raj | 149 → 149 | 154 → 154 |
| /case-studies/anger-management | 200 → 200 | 0 → 1 | 67 → 51 | Case Study: Reactive Anger and Family Relationships | 151 → 151 | 100 → 273 |
| /case-studies/anxiety-and-depression | 200 → 200 | 0 → 1 | 71 → 55 | Case Study: Co-occurring Anxiety and Depression Treated | 146 → 146 | 98 → 274 |
| /case-studies/aversion-to-sex | 200 → 200 | 0 → 1 | 67 → 51 | Case Study: Working Through an Aversion to Intimacy | 147 → 147 | 112 → 289 |
| /case-studies/insomnia | 200 → 200 | 0 → 1 | 64 → 48 | Case Study: Chronic Insomnia and Racing Thoughts | 146 → 146 | 100 → 268 |
| /case-studies/migraine | 200 → 200 | 0 → 1 | 69 → 53 | Case Study: Reducing Stress-Linked Migraine Frequency | 139 → 139 | 79 → 247 |
| /conditions | 200 → 200 | 0 → 1 | 65 → 50 | Conditions We Treat in Navi Mumbai \| Chaitanya Raj | 120 → 120 | 306 → 306 |
| /conditions/abandonment-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Abandonment Issues Counselling in Vashi, Navi Mumbai | 144 → 144 | 528 → 528 |
| /conditions/abuse-trauma-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 65 → 49 | Abuse & Childhood Trauma Counselling, Navi Mumbai | 149 → 149 | 505 → 516 |
| /conditions/addiction-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 66 → 50 | Drug & Alcohol Dependence Counselling, Navi Mumbai | 142 → 142 | 515 → 515 |
| /conditions/anger-management-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 67 → 51 | Anger Management Counselling & Therapy, Navi Mumbai | 148 → 148 | 509 → 522 |
| /conditions/anxiety-therapy-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Anxiety & Panic Attack Therapy in Vashi, Navi Mumbai | 150 → 150 | 641 → 654 |
| /conditions/best-past-life-regression-therapy-in-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Past Life Regression Therapy in Navi Mumbai & Mumbai | 149 → 149 | 903 → 927 |
| /conditions/child-teen-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 67 → 51 | Child & Teenage Counselling Services in Navi Mumbai | 150 → 150 | 678 → 678 |
| /conditions/depression-therapy-navi-mumbai | 200 → 200 | 1 → 1 | 70 → 54 | Depression Counselling & Therapy in Vashi, Navi Mumbai | 147 → 147 | 606 → 621 |
| /conditions/grief-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 69 → 53 | Grief & Bereavement Counselling in Vashi, Navi Mumbai | 146 → 146 | 573 → 573 |
| /conditions/leadership-team-building-programs | 200 → 200 | 1 → 1 | 69 → 53 | Leadership & Team Building Programs for Organisations | 154 → 154 | 554 → 554 |
| /conditions/ocd-therapy-navi-mumbai | 200 → 200 | 1 → 1 | 69 → 53 | OCD Treatment in Vashi, Navi Mumbai \| Therapy for OCD | 149 → 149 | 681 → 687 |
| /conditions/phobia-treatment-navi-mumbai | 200 → 200 | 1 → 1 | 69 → 53 | Phobia Treatment & Fear Therapy in Vashi, Navi Mumbai | 141 → 141 | 562 → 562 |
| /conditions/relationship-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 72 → 55 | Relationship Counselling in Navi Mumbai \| Chaitanya Raj | 149 → 148 | 580 → 608 |
| /conditions/sexual-dysfunction-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Sexual Dysfunction Counselling in Vashi, Navi Mumbai | 148 → 148 | 485 → 503 |
| /conditions/sleep-disorder-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Insomnia & Sleep Disorder Counselling in Navi Mumbai | 144 → 144 | 508 → 517 |
| /conditions/stammering-therapy-navi-mumbai | 200 → 200 | 1 → 1 | 69 → 53 | Stammering & Stuttering Therapy in Vashi, Navi Mumbai | 146 → 146 | 460 → 460 |
| /conditions/stress-burnout-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 68 → 52 | Stress and Burnout Counselling in Vashi, Navi Mumbai | 143 → 143 | 600 → 608 |
| /conditions/trauma-ptsd-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 71 → 55 | PTSD & Trauma Therapy in Vashi and Belapur, Navi Mumbai | 149 → 149 | 533 → 540 |
| /contact | 200 → 200 | 0 → 1 | 72 → 57 | Book a Consultation in Vashi, Navi Mumbai \| Chaitanya Raj | 142 → 142 | 109 → 97 |
| /corporate-wellness-programs-navi-mumbai | 200 → 200 | 1 → 1 | 64 → 48 | Corporate Wellness Programs & EAP in Navi Mumbai | 153 → 153 | 1124 → 1124 |
| /counselling-navi-mumbai | 200 → 200 | 1 → 1 | 58 → 59 | Counselling in Navi Mumbai: Vashi & Belapur \| Chaitanya Raj | 146 → 146 | 1035 → 1035 |
| /couples-counselling-navi-mumbai | 200 → 200 | 1 → 1 | 81 → 50 | Couples Counselling in Navi Mumbai \| Chaitanya Raj | 162 → 148 | 780 → 862 |
| /faq | 200 → 200 | 0 → 1 | 42 → 56 | Frequently Asked Questions About Therapy \| Chaitanya Raj | 134 → 134 | 162 → 162 |
| /fees | 200 → 200 | 0 → 1 | 38 → 48 | Session Fees and Payment Options \| Chaitanya Raj | 102 → 143 | 73 → 73 |
| /gallery | 200 → 200 | 0 → 1 | 70 → 56 | Gallery: Workshops and Training Sessions \| Chaitanya Raj | 151 → 151 | 30 → 30 |
| /hypnotherapy-navi-mumbai | 200 → 200 | 1 → 1 | 61 → 54 | Clinical Hypnotherapist in Navi Mumbai \| Chaitanya Raj | 134 → 134 | 899 → 899 |
| /online-therapy-international-clients | 200 → 200 | 1 → 1 | 87 → 56 | Online Therapy for International Clients \| Chaitanya Raj | 174 → 149 | 819 → 819 |
| /privacy-policy | 200 noindex → 200 noindex | 0 → 1 | 30 → 30 | Privacy Policy \| Chaitanya Raj | 88 → 151 | 149 → 235 |
| /testimonials | 200 → 200 | 0 → 1 | 49 → 51 | Client Testimonials and Experiences \| Chaitanya Raj | 102 → 150 | 80 → 80 |
| /therapies | 200 → 200 | 0 → 1 | 67 → 56 | Therapies We Offer in Vashi, Navi Mumbai \| Chaitanya Raj | 140 → 140 | 195 → 195 |
| /therapies/age-regression | 200 → 200 | 0 → 1 | 69 → 53 | Age Regression Therapy in Navi Mumbai \| Chaitanya Raj | 151 → 151 | 106 → 246 |
| /therapies/behaviour-modification-therapy | 200 → 200 | 0 → 1 | 68 → 52 | Behaviour Modification Therapy in Vashi, Navi Mumbai | 141 → 141 | 78 → 216 |
| /therapies/cognitive-behavioural-therapy | 200 → 200 | 0 → 1 | 66 → 50 | Cognitive Behavioural Therapy (CBT) in Navi Mumbai | 146 → 146 | 100 → 237 |
| /therapies/couples-and-relationship-counselling | 200 → 200 | 0 → 1 | 66 → 53 | How Couples Counselling Sessions Work \| Chaitanya Raj | 114 → 158 | 74 → 241 |
| /therapies/ego-state-therapy | 200 → 200 | 0 → 1 | 70 → 54 | Ego State Therapy: How It Works \| Navi Mumbai Practice | 147 → 147 | 96 → 235 |
| /therapies/energy-exchange | 200 → 200 | 0 → 1 | 70 → 54 | Energy Exchange Therapy in Navi Mumbai \| Chaitanya Raj | 131 → 131 | 68 → 239 |
| /therapies/mindfulness-based-therapy | 200 → 200 | 0 → 1 | 72 → 56 | Mindfulness-Based Therapy in Navi Mumbai \| Chaitanya Raj | 113 → 152 | 77 → 216 |
| /therapies/past-life-regression-technique | 200 → 200 | 0 → 1 | 70 → 54 | How Past Life Regression Therapy Works \| The Technique | 156 → 156 | 123 → 294 |
| /therapies/quantum-therapy | 200 → 200 | 0 → 1 | 62 → 46 | Quantum Therapy in Navi Mumbai \| Chaitanya Raj | 141 → 141 | 75 → 246 |
| /therapies/spirit-release-therapy | 200 → 200 | 0 → 1 | 70 → 54 | Spirit Release Therapy (SRT) \| What a Session Involves | 152 → 152 | 96 → 267 |
| /therapies/third-party-regression | 200 → 200 | 0 → 1 | 77 → 45 | Third Party Regression Therapy in Navi Mumbai | 132 → 132 | 96 → 234 |
| /training-and-mentorship | 200 → 200 | 0 → 1 | 66 → 58 | Hypnotherapy & PLR Training in Navi Mumbai \| Chaitanya Raj | 152 → 152 | 64 → 64 |
| /training-and-mentorship/advanced-training-level-1 | 200 → 200 | 0 → 1 | 70 → 54 | Advanced Hypnotherapy Training - Level 1 \| Navi Mumbai | 149 → 149 | 79 → 163 |
| /training-and-mentorship/advanced-training-level-2 | 200 → 200 | 0 → 1 | 70 → 54 | Advanced Hypnotherapy Training - Level 2 \| Navi Mumbai | 145 → 145 | 75 → 149 |
| /training-and-mentorship/basic-training-in-hypnosis-and-plrt | 200 → 200 | 0 → 1 | 69 → 53 | Basic Training in Hypnosis & PLRT \| Foundation Course | 147 → 147 | 96 → 171 |

## 6. Structured data

| Page type | Before | After |
|---|---|---|
| All pages | MedicalBusiness (image URL returned 404) | MedicalBusiness with `@id`, working image and logo, founder link, Belapur clinic as `department` (address only) |
| `/about`, `/about/the-founder` | Person | Person with `@id`, founder-page URL, LinkedIn `sameAs` |
| Condition pages (18) | BreadcrumbList, FAQPage | unchanged (FAQ matches the visible accordion) |
| Therapy pages (11) | MedicalTherapy | PsychologicalTreatment (7) or Service for the complementary techniques (4) |
| Blog posts (12) | Article (+ FAQPage on 6) | Article with visible headline, image, `dateModified`, `mainEntityOfPage`; BreadcrumbList added; FAQPage unchanged |
| Breadcrumb roots | `https://www.chaitanyaraj.com/` | `https://www.chaitanyaraj.com` (matches canonical) |

- **Validity:** every JSON-LD block parses, and every in-site URL inside it returns 200. No ratings, reviews or credentials were added to markup.
- **Not tested:** Google Rich Results Test (needs the deployed URL). FAQ rich results are limited to authoritative government and health sites, so valid FAQPage markup may not produce them.

## 7. Mobile layout

### Before (live, 17 representative pages)

Horizontal overflow on **every** tested page, at every width:

- 320 → +67 px
- 360 → +47 px
- 375 → +40 px (415 px document)
- 390 → +32 px
- 414 → +20 px
- 768 → +71 px
- 1024 → +443 px
- 1440 → +171 px

Offenders: the footer email link (≤ 768 px) and the desktop navigation plus **Book a session** button (1024 / 1440 px).

### After

All **71 sitemap pages** were checked at **8 widths** (320, 360, 375, 390, 414, 768, 1024, 1440 px).

| Result | Pages |
|---|---|
| 0 px overflow at every width | 70 of 71 on the first full run |
| Overflow found | `/corporate-wellness-programs-navi-mumbai`: +15 px at 768 px — the word "organisation" in a 60 px heading inside a half-width column. Fixed (48 px at 768–1023 px). |
| Re-check after that fix | `/corporate-wellness-programs-navi-mumbai`, `/blog/what-actually-happens-in-a-past-life-regression-session-and-why-people-sometimes-cry-halfway-through`, `/online-therapy-international-clients`, `/hypnotherapy-navi-mumbai` — 0 px at all 8 widths |

Earlier runs on the 17-page sample also caught, and led to fixes for:
- footer social icons at 768–1024 px
- the 48 px H1s on the hypnotherapy page (320–390 px) and the online-therapy page (320 px)

The overflow detector reports the outermost element past the edge and, when no element box is past the edge, the text run that is.

## 8. Accessibility (axe-core, WCAG 2.0/2.1/2.2 A and AA + best practices, at 375 and 1440 px)

| Rule | Before (live, 17 pages) | After |
|---|---|---|
| `color-contrast` (serious) | 17 of 17 pages, e.g. coral eyebrow 2.66:1, "Learn more" 2.99:1, faded text 2.45:1, footer 3.72:1 | **0** (71 pages × 2 widths) |
| `region` (moderate) | 17 of 17 (floating social bar outside landmarks) | **0** |
| `page-has-heading-one` (moderate) | 10 of 17 | **0** |

**Other accessibility checks after the fixes:**
- **Keyboard:** the first eight Tab stops all show a visible focus indicator.
- **Focus outline:** 11:1 on light and 7:1 on dark backgrounds (was 2.7:1).
- **Skip link:** a skip-to-content link is present.
- **Form labels:** all contact form fields have labels.
- **Menus:** they expose `aria-expanded`/`aria-controls`.

## 9. Tap targets (375 px)

| | Before (live) | After |
|---|---|---|
| Controls smaller than 24 × 24 px (WCAG 2.2 AA) per page | 17–22 | **0** on all 71 pages |
| Controls smaller than 44 × 44 px per page | 28–38 | 23–33 |

The remaining sub-44 px controls are footer text links and the text logo (24–30 px tall), plus phone/email links. These are kept at ≥ 24 px by design (see L6 in the fix report).

## 10. Functional checks (after)

| Check | Result |
|---|---|
| Mobile menu: opens, 11 top-level links, submenu expands, closes | pass |
| Contact form: fields filled, submit posts to `api.web3forms.com` (intercepted, nothing sent), success message shown | pass |
| Consent: banner on first visit, no Clarity request and no third-party cookies before consent | pass |
| Consent: Clarity loads after **Allow**, choice remembered on reload, footer button reopens, **No thanks** keeps Clarity off | pass |
| Google Analytics tag loads | pass |
| CSP: no violations on `/`, `/contact`, `/blog`, `/gallery`, a condition page, `/about/media-highlights`, `/admin/login` | pass |
| Console errors on tested pages | 0 errors on all 71 pages (failures of the analytics hits the harness blocks are excluded) |
| Dynamic routes (conditions, therapies, case studies, training, blog) render; unknown slugs return 404 | pass |

## 11. Lighthouse

Lab data, mobile (Moto G Power emulation, simulated throttling) and desktop. Columns: Performance, Accessibility, Best Practices, SEO, FCP / LCP / TBT in ms, CLS.

### Live baseline (single run, Vercel, 19 Oct)

| Page | Form | P | A | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| / | mobile | 89 | 96 | 73 | 100 | 1103 | 2612 | 179 | 0 |
| / | desktop | 99 | 96 | 77 | 100 | 314 | 592 | 0 | 0 |
| /conditions/anxiety-therapy-navi-mumbai | mobile | 95 | 96 | 77 | 100 | 931 | 2432 | 187 | 0 |
| /conditions/anxiety-therapy-navi-mumbai | desktop | 100 | 96 | 77 | 100 | 273 | 553 | 0 | 0 |
| /therapies/cognitive-behavioural-therapy | mobile | 96 | 96 | 77 | 100 | 939 | 2139 | 193 | 0 |
| /therapies/cognitive-behavioural-therapy | desktop | 100 | 95 | 77 | 100 | 275 | 515 | 0 | 0 |
| /blog | mobile | 95 | 96 | 77 | 100 | 1032 | 2439 | 184 | 0 |
| /blog | desktop | 100 | 96 | 77 | 100 | 300 | 634 | 0 | 0 |
| /contact | mobile | 96 | 96 | 77 | 100 | 934 | 2434 | 161 | 0 |
| /contact | desktop | 100 | 96 | 77 | 100 | 274 | 514 | 0 | 0 |

Best Practices failures on every page: `third-party-cookies`, `inspector-issues` (Microsoft Clarity); plus `errors-in-console` (favicon 404) on the mobile homepage. Accessibility failure: `color-contrast`.

### Like-for-like: original code vs fixed code (same machine, median of 3 runs)

| Page | Form | P | A | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| **Before** | | | | | | | | | |
| / | mobile | 71 | 96 | 77 | 100 | 3162 | 5578 | 160 | 0 |
| / | desktop | 100 | 96 | 77 | 100 | 415 | 586 | 0 | 0 |
| /conditions/anxiety-therapy-navi-mumbai | mobile | 94 | 96 | 77 | 100 | 1514 | 2611 | 156 | 0.003 |
| /conditions/anxiety-therapy-navi-mumbai | desktop | 100 | 96 | 77 | 100 | 337 | 592 | 0 | 0.001 |
| /therapies/cognitive-behavioural-therapy | mobile | 95 | 96 | 77 | 100 | 1512 | 2466 | 162 | 0 |
| /therapies/cognitive-behavioural-therapy | desktop | 100 | 95 | 77 | 100 | 336 | 509 | 0 | 0 |
| /blog | mobile | 95 | 96 | 77 | 100 | 1061 | 2780 | 102 | 0 |
| /blog | desktop | 100 | 96 | 77 | 100 | 372 | 588 | 0 | 0 |
| /contact | mobile | 95 | 96 | 77 | 100 | 1516 | 2617 | 134 | 0.001 |
| /contact | desktop | 100 | 96 | 77 | 100 | 334 | 504 | 0 | 0 |
| **After** | | | | | | | | | |
| / | mobile | 92 | 100 | 100 | 100 | 1817 | 3023 | 94 | 0.008 |
| / | desktop | 100 | 100 | 100 | 100 | 453 | 642 | 0 | 0 |
| /conditions/anxiety-therapy-navi-mumbai | mobile | 93 | 100 | 100 | 100 | 1667 | 2794 | 178 | 0.011 |
| /conditions/anxiety-therapy-navi-mumbai | desktop | 100 | 100 | 100 | 100 | 415 | 625 | 0 | 0.001 |
| /therapies/cognitive-behavioural-therapy | mobile | 95 | 100 | 100 | 100 | 1664 | 2629 | 142 | 0.008 |
| /therapies/cognitive-behavioural-therapy | desktop | 100 | 100 | 100 | 100 | 412 | 548 | 0 | 0.001 |
| /blog | mobile | 95 | 100 | 100 | 100 | 1070 | 2804 | 107 | 0.008 |
| /blog | desktop | 100 | 100 | 100 | 100 | 335 | 590 | 0 | 0 |
| /contact | mobile | 96 | 100 | 100 | 100 | 1516 | 2631 | 85 | 0.009 |
| /contact | desktop | 100 | 100 | 100 | 100 | 377 | 551 | 0 | 0 |

**What changed:**
- **Best Practices:** 77 → **100** on all 10 page/form-factor combinations. Microsoft Clarity's third-party cookies are gone until consent, and the favicon 404 is fixed.
- **Accessibility:** 95–96 → **100**.
- **SEO:** 100 → 100.
- **Desktop Performance:** 100 everywhere.
- **Homepage (mobile):** Performance 71 → **92**, FCP 3.2 s → 1.8 s and LCP 5.6 s → 3.0 s on this machine. The homepage is now static/ISR instead of calling Firestore on every request.
- **Mobile TBT:** 85–178 ms (before 102–162 ms), under the 200 ms target on every page. Google Analytics now loads after hydration and Clarity only after consent.

**What didn't improve:**
- **Mobile LCP:** 2.6–3.0 s, above the 2.5 s goal in this local lab setup. On the anxiety and CBT pages it is ~170 ms slower than before (FCP ~150 ms slower), which is within the variation seen between runs here but is not an improvement. The LCP element is the intro text on `/`, `/contact` and the condition page, and the first cover image on `/blog`. The consent banner is no longer the LCP element on `/contact`; it was while it rendered client-side, so it is now server-rendered. On the CDN, the live baseline showed 2.1–2.6 s for the same pages; re-measure on production after deploying.
- **CLS:** ≤ 0.011, up from ≤ 0.003; both are well within the 0.1 "good" threshold.
- **INP:** not measured (needs field data).

## 12. Build and code checks

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | pass, 0 errors |
| `next build` | pass. `/`, `/blog`, `/blog/[slug]` and `/gallery` moved from `ƒ` (rendered per request) to `○`/`●` (static/ISR). 12 blog posts are pre-rendered from Firestore. |
| First-load JS | shared 87.4 kB (unchanged); homepage 108 kB → 103 kB (page code 6.61 kB → 1.58 kB, because the hero is no longer a client component); other routes unchanged within ±0.1 kB |
| `next lint` | **not run** — ESLint is not configured in the project (`next lint` asks to set it up; adding it means new dev dependencies) |
| Project test suite | none exists; the four `scripts/seo` checks are the automated tests |

## 13. Re-running

```sh
npm run build && npm run start          # in one terminal
npm i --no-save playwright-core axe-core lighthouse
npm run seo:check -- --base http://localhost:3000
npm run seo:browser -- --base http://localhost:3000 --all
npm run seo:consent -- --base http://localhost:3000
npm run seo:lighthouse -- --base http://localhost:3000 --runs 3
```

Run `npm run seo:check` without `--base` against production after deploying to confirm the live site.
