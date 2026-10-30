# Assessment platform — setup and operations guide

An admin-managed, database-backed assessment system: the admin builds assessments (any number of sections and
questions, conditional logic, scoring, results, email), visitors take them at `/assessments`, results are calculated
**on the server**, and — with consent — emailed to the participant.

Nothing here replaces existing functionality. The only edits to existing files are: the new floating button in
`components/Floatingocials.tsx` (social links untouched), one card on `app/admin/page.tsx`, the sitemap
(`app/sitemap.ts`), `package.json` (dependencies + `test` script) and `.gitignore` (`.data/`).

## 1. What was found in the project (and how the feature fits it)

| Area | What exists | What the feature does |
| --- | --- | --- |
| Framework | Next.js 14 App Router, TypeScript, Tailwind | New routes under `app/assessments`, `app/admin/assessments`, `app/api/**` |
| Database | Firebase / Firestore, **client SDK only** | New collections written through the **Firebase Admin SDK** (server only) |
| Admin auth | Firebase Auth, checked in the browser by `AdminGuard` | Admin APIs verify the Firebase **ID token on the server** (no extra credentials needed for that step) |
| Email | Only Web3Forms (delivers to the practice's own inbox; cannot email visitors) | New SMTP/Nodemailer provider adapter |
| Brand | "Chaitanya Raj Psychology & Counselling" (teal palette) | UI uses the site's existing tokens, fonts and buttons |

> The original brief mentioned a different site name, a `SocialLinks.jsx` component, `useLocation`, a Spotify link and
> admin-route hiding. None of that exists in this repository; the real component is `components/Floatingocials.tsx`
> (Instagram, YouTube, LinkedIn, Facebook — unchanged). The new button hides itself on `/admin*` and `/assessments*`.

## 2. Required setup

### 2.1 Install and run

```bash
npm install          # adds firebase-admin, nodemailer (+ tsx, @types/nodemailer for tests)
npm run dev
npm test             # unit/integration tests for scoring, logic, versions, email, auth, privacy
```

### 2.2 Environment variables (server only — never `NEXT_PUBLIC_*`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Yes in production** | Service-account JSON (raw or base64). Alternatively `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` (+ optional `FIREBASE_ADMIN_PROJECT_ID`). Create it in Firebase console → Project settings → Service accounts → Generate new private key. |
| `ASSESSMENT_ADMIN_EMAILS` | Strongly recommended | Comma-separated admin emails allowed to use the assessment admin APIs, e.g. `owner@example.com`. If unset, **any signed-in Firebase user** counts as admin (this matches the existing `AdminGuard`); the dashboard shows a warning. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | For emailing results | Any SMTP provider (Gmail app password, Brevo, Mailgun, SES SMTP, Zoho…). `SMTP_PORT` defaults to 587; `SMTP_SECURE=true` for port 465. |
| `MAIL_FROM` | For emailing results | e.g. `Chaitanya Raj <no-reply@chaitanyaraj.com>` (use an address your SMTP provider is allowed to send from). |
| `MAIL_REPLY_TO` | Optional | Reply-to address. |
| `ASSESSMENT_PUBLIC_BASE_URL` | Optional | Base URL used in emailed links; defaults to `NEXT_PUBLIC_SITE_URL` or `https://www.chaitanyaraj.com`. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Already set | Used to verify admin ID tokens. |
| `FIREBASE_STORAGE_BUCKET` | Optional | Bucket for thumbnail uploads; defaults to `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (already set). Uploads also need the service-account credentials above. |

Email works out of the box: the Gmail sign-in of the practice's sending account is kept in `lib/assessments/server/mailAccount.ts`
(same idea as the Firebase key: only safe while the repository stays private; to rotate it, delete the app password in the Google
account and put the new one in `SMTP_PASS`). The variables above, when set, take priority over it. `ASSESSMENT_IGNORE_EMBEDDED_MAIL=1`
switches the embedded sign-in off (the tests and local test copies use it, so they can never send real email).
Without any sign-in the platform still works: participants see their results on screen and the status reads
"Email delivery isn't set up", never "sent".

**Who gets which email, and when**

* **The participant** always gets their results by email, with the PDF report attached, at the address they entered (there is no
  tick box; the form says so under the email field). Turn it off per assessment under Settings -> Email.
* **The practice's own inbox** (`OWNER_EMAIL` in `mailAccount.ts`) is told about every completed self-check. The note has the
  person's name, email, the assessment, how many questions they answered, when they finished (IST), the score and level, a
  warning when a support message was shown, and the PDF report. That full note is sent when Settings -> Privacy is **"Everything"** (the Mood Self-Assessment uses it, and its form tells people their name, email and results go to the
  practice) or when the person ticked "Share my results with the practice". Otherwise the note only says that someone
  completed it. Addresses added under Settings -> Email are told as well.
* **The PDF report** (the download, the attachment for the participant and the one for the practice) states, on its first page,
  which assessment it is, how many questions were answered ("21 of 21") and the date.
* Both emails use the site colours and logo, and go out **after the response**: the participant sees their results at once and the
  results page shows "on their way", then "accepted for delivery" (or the failure, with a retry button) a few seconds later.

**Local development without credentials:** if no Firebase Admin credentials are present and `NODE_ENV` is not
`production`, a JSON file store at `.data/assessments-dev.json` is used so you can try everything locally. It is
git-ignored and is **refused in production**.

### 2.2b Adding the built-in assessments with a script

```bash
npm run assessments:seed                    # Mood Self-Assessment, added as a draft
npm run assessments:seed -- --publish       # ...and published straight away
npm run assessments:seed -- mood listening  # pick templates; add --force for another copy
```

The script reads `.env.local` and writes to the same storage as the site (Firestore when `FIREBASE_SERVICE_ACCOUNT_JSON` is set, otherwise the
local development file). Run twice, it does nothing the second time. Review the scoring in the admin builder before publishing.

**Keep the service-account key out of the code.** Put it in `.env.local` (git-ignored) and, for the live site, in Vercel → Settings →
Environment Variables as `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON or base64). Never hardcode it in a source file or commit the downloaded
`*-firebase-adminsdk-*.json`: anything pushed to GitHub is treated as public, and Google disables service-account keys it finds there.

### 2.3 Firestore rules and indexes

New collections: `assessments`, `assessmentVersions`, `assessmentSubmissions`, `assessmentPeerResponses`,
`assessmentEmails`, `assessmentCategories`, `assessmentStats`.

All access goes through the Admin SDK (which bypasses rules), so browsers must have **no** direct access. Add to
your Firestore rules (do not replace the existing rules — merge this in) and make sure no catch-all rule such as
`match /{document=**} { allow read: if true; }` exposes them:

```
match /assessments/{doc=**}              { allow read, write: if false; }
match /assessmentVersions/{doc=**}       { allow read, write: if false; }
match /assessmentSubmissions/{doc=**}    { allow read, write: if false; }
match /assessmentPeerResponses/{doc=**}  { allow read, write: if false; }
match /assessmentEmails/{doc=**}         { allow read, write: if false; }
match /assessmentCategories/{doc=**}     { allow read, write: if false; }
match /assessmentStats/{doc=**}          { allow read, write: if false; }
```

No composite indexes are required: queries are single or double equality filters (Firestore's automatic indexes).

## 3. How it works

### Data model (embedded where it helps)

* `assessments/{id}` — the **working draft** (meta + `definition`: sections → questions, scoring, results, email, peer,
  privacy) plus status (`draft | published | archived`), `version`, `draftRevision`, `publishedRevision` and a
  denormalised public summary.
* `assessmentVersions/{id}__v{n}` — an **immutable snapshot** created on every publish. Submissions point at the
  version they answered, so editing questions, thresholds or scoring later never alters historical results.
  Re-publishing without changes does not create a new version.
* `assessmentSubmissions/{id}` — respondent, consent record, validated answers (visible questions only), the
  server-calculated result, secret result token, peer-link state and email state. The id is derived from the client's
  idempotency key, so a double click or retry can never create two submissions or send two emails.
* `assessmentPeerResponses`, `assessmentEmails` (one delivery record per submission and kind), `assessmentCategories`,
  `assessmentStats` (anonymous "start" counter for completion statistics).

### Rules, not code

Visibility is a structured rule `{ action: show|hide, match: all|any, rules: [{ questionId, operator, value }] }`.
Scoring is configuration (skills, contexts, weights, reverse flags, levels, content rules). There is no `eval`, no
formula strings and no admin-supplied JavaScript anywhere; unknown operators fall back to a safe default.

### Scoring engine (`lib/assessments/scoring.ts`)

Each answer is normalised to 0–1 (rating/slider/number by range, yes/no, choice points, multi-select), flipped if
*reverse-scored*, and weighted. Skill score = weighted mean × 100; overall = weighted mean of skills (or of all
questions). Hidden questions and unanswered optional questions are excluded from numerator **and** denominator.
Context scores (e.g. work vs home), strengths/growth areas, strongest/weakest habits, self-perception gap, insights,
misconceptions, recommendations and the personalised 30-day plan are derived from the same configuration. All of it
runs on the server; scores sent by a browser are ignored.

### Listening Self-Reflection (starter template)

Installed from **Admin → Assessments → "Install Listening Self-Reflection starter"** as a **draft**: nine short
sections, ~12 minutes, four skills (Attention, Understanding, Restraint, Curiosity), work/home contexts, a self-rating
used for the self-perception comparison, optional peer feedback, levels *Waiting / Hearing / Listening / Attentive*
and a 4-week plan. No existing questionnaire or scoring document was found in the repository, so the questions,
thresholds (0 / 40 / 60 / 80) and weights are **editable starter content, not a validated instrument**. Review and edit
everything, then publish. The copy avoids diagnostic claims.

### Mood Self-Assessment (from the practice's Word document)

Install it from **Admin → Assessments → New assessment → Mood Self-Assessment** (a draft, like the Listening starter). It uses the 21 items,
category labels, headings, prompts and four answer statements exactly as written in `Chaitanya_Raj_Mood_Self-Assessment.docx` (one typo,
"as as much", was fixed) and shows them as one page of numbered cards, as in the document.

* **Scoring (not in the document, editable):** each statement scores 0–3 by position; the total is shown out of 63 (**Scoring → Show the
  score out of**). Ranges use the commonly published BDI-II totals: 0–13 Minimal, 14–19 Mild, 20–28 Moderate, 29–63 Severe — stored as 0 / 22 /
  32 / 46 on the 0–100 scale, which reproduces those totals exactly (covered by a test for every total from 0 to 63). The items follow the Beck
  Depression Inventory-II, so confirm the scoring and ranges against the manual you are licensed to use before publishing. Results speak of
  "ranges of low-mood symptoms" and never call anything a diagnosis.
* **Safety:** item 9 (self-harm) triggers a highlighted **support message** at the very top of the results and in the result email (India:
  112 and the Tele-MANAS helpline 14416, plus the practice phone). It depends on that answer, not on the total, and cannot be hidden from the
  Results tab. If the person agreed to share with the practice, the practice notification also says a support message was shown. Check the
  numbers and wording in **Scoring → Result messages** for your region.
* **Next steps:** a short suggestion by range (keep checking in / talking it through may help / speaking with a professional is recommended).
* **One change from the document:** its first tile said answers are "processed locally in your browser, nothing is saved or stored". That is
  not how this platform works (answers are sent to the server to calculate results), so the tile now says results are shown on a private link
  only the participant has. Edit it under **Settings → Introduction → Info tiles**.

### Charisma Diagnostic (from the Stature Group questionnaire)

Install it from **Admin -> Assessments -> New assessment -> Charisma Diagnostic**. It has the 34 statements of the questionnaire in four parts
(warmth, competence, the dial, your footprint), rated 1-5 ("Not like me" to "Very like me"); six statements are worded the other way round and are
reverse-scored. It is a **zone assessment**: there is no overall score or level. The result is a zone on a warmth / competence map ("You are in the
Warm Zone."), the two strongest parts as strengths, the two lowest as gaps, and a 7 day plan.

The zone names and meanings, the strength and gap wording of each part, the plan steps, the headings of the fourth part and the "high from 65 of 100"
mark are **editable starter wording** (the questionnaire only promises the page), so read them through before publishing.

* **Zone map** (Results tab): pick the two skills for the axes, the score from which a skill counts as high (1-99, default 65), optional axis names and the
  name and meaning of each of the four zones. Adding a map adds the "Zone map" result section; removing it removes the section. Deleting a skill that the
  map plots (Scoring tab) removes the map and says so first. A zone assessment may have no levels.
* **Numbered plan** (Scoring tab -> Practice plan): give a number of steps (for example 7) and the word before each step ("Day" gives "Day 1"). The plan
  then takes one step at a time from every skill's **Plan steps** (written on each skill), the lowest-scoring skill first. Leave the number empty to use weeks.
* **Result headline**: `{name}` is the first name and `{zone}` the zone ("You are in the {zone}."); the zone is set in italics. The small heading above it
  (**Results tab -> Small heading**) defaults to the assessment's title.
* The result email leads with "Zone: ..." instead of an overall score, and lists the steps ("Day 1: ...").

## 4. Using it

### Admin: create and publish

1. Sign in at `/admin/login`, open **Assessments** (`/admin/assessments`).
2. **New assessment** → Blank, or install the Listening starter.
3. **Basics**: title, slug (locked after first publish), description, category, icon, free/premium, duration.
4. **Questions**: add sections and any of the 14 field types; mark required; add help text; configure choices;
   add visibility rules ("show if… / hide if…"); flag questions to also ask peers.
5. **Scoring**: enable, define skills/contexts, link scored questions, set levels (thresholds), self-perception,
   insights/misconceptions/recommendations (conditional on scores) and the practice plan.
6. **Results**: enable/disable/reorder result sections, add custom messages, choose chart style.
7. **Settings**: introduction, navigation, email template, extra practice recipients (details only with participant consent), peer
   feedback, privacy mode.
8. **Preview**: run the whole participant experience with your unsaved edits; nothing is stored or emailed.
9. **Publish** (validation errors block publishing). Unpublish, archive, duplicate from the same bar.

### How the form looks

Every assessment opens as a branded sheet: the practice logo (`public/logo.png`) centred above a teal banner, then the title,
subtitle and a short note (for example *Confidential & Self-Paced*), up to three info tiles and a highlighted notice box on the
introduction page, and the questions as numbered cards (*CATEGORY | Question 3 of 21*). Colours, fonts and buttons come from the
site theme. Admins control the wording in **Settings → Introduction** (subtitle, note, tiles, notice) and give a question a
category label in the question editor (on one-page forms it defaults to the section title). Tiles can use `{{minutes}}`,
`{{questions}}` and `{{sections}}`; keep their text accurate — the default tiles say results are shown on a private link, not that
answers are never stored. On a one-page form with a single section, the section's title and description are not repeated above the
questions (the "Assessment questions" heading introduces them; the title stays for screen readers and as the default category label). The logo also appears on the results page, the peer-feedback page and the result email.

### Participant

Floating **Take a Self-Check** button → library (search/filter) → assessment page → name, email and consent →
intro → sections (progress, back/next, drafts kept on the device) → server validates, scores and saves → private result
page (`/assessments/results/<secret>`) → emailed summary and PDF to the address they entered.

### The PDF report: a download on the result page and an attachment on the email

* **A "Download PDF report" button** at the top of the participant's private result page opens `GET /api/assessments/results/<token>/pdf`. It uses the same
  private link as the result page (a wrong link answers 404), is rate limited, never cached and `noindex`.
* **An attachment on the result email**, for everyone who is emailed their result. The email says "A PDF copy of your report is attached to this
  email." If the report cannot be made the email is still sent, without the attachment and without that sentence.

The report holds what the result page holds, in the order of the admin's **Result sections**: the practice logo on white, a dark teal band with the headline
(the zone picked out in gold), then one section for each enabled result section (overall score and level, zone map, skills, work/home comparison, self vs
answers, strengths, growth areas, habits, insights, misconceptions, recommendations, the plan, custom messages) and the disclaimer. **A support message
(for example the crisis contacts of the Mood template) always comes first.** Every page has "Chaitanya Raj - Private report for <name>" and "Page n of N".
The answers themselves are not included, and the copy-link, email-status and peer-comparison sections (which only make sense on screen) are left out.
It is made from the result and the version of the assessment the person answered, so an earlier result keeps what its version offered.

Admins switch each way off (both are on by default, and assessments saved earlier get them too):

* **Results tab -> "Offer a Download PDF report button on the result page".** Off: no button, and the PDF address answers 404 for new results.
* **Settings tab -> Email -> "Attach the PDF report to the email".** Off: the email is sent as before.

How it is built: plain JavaScript (`pdf-lib` and `@pdf-lib/fontkit`; no browser, so it runs on Vercel). `lib/assessments/server/pdf/reportLayout.ts` decides what
goes where (pure, unit-tested), `reportPdf.ts` draws it, and `lib/assessments/zoneMapLayout.ts` is shared with the result page's SVG map. The site's typefaces
(Fraunces for headings, Public Sans for text; SIL Open Font License) and the logo are embedded as base64 in `lib/assessments/server/pdf/assets.ts`, because
serverless functions do not ship `public/`. To regenerate it: instantiate the variable fonts at wght 400 (Fraunces, opsz 36) and wght 400/700 (Public Sans)
with `fontTools.varLib.instancer`, subset them to Latin with `pyftsubset`, save as TrueType (not WOFF2) and base64 them, with `public/logo.png` as a JPEG.
The fonts cover Latin letters with accents and common punctuation; a character outside them (Devanagari, Cyrillic...) is drawn as "?", and a participant
whose name cannot be written at all appears as "Participant". The result page and the email are unaffected.

### Email

Emailing is **optional** at three levels: the assessment can switch it off (Settings → Email), the participant ticks a box, and the server needs
mail credentials. **Without credentials the "email my results" option is not shown at all and no email is attempted** — everyone simply sees
their results on screen, and the admin dashboard says email is off.

HTML + plain text, with score, level, skill scores, strengths, growth areas, recommendations, the 30-day plan and a
private link. "Sent" is shown only when the SMTP server **accepted** the recipient. Transient failures retry once;
failures leave the result visible with a *Retry* button (max 6 sends per submission, ≥30 s apart). Admins can retry
from the submissions screen. Nothing is emailed to the practice unless the assessment enables notifications **and**
the participant ticks an explicit "share with the practice" box.

### Thumbnails, deleting and the submissions screen

* **Thumbnail image** (Basics tab): the admin chooses a PNG, JPEG, WebP or GIF (up to 2 MB); the server judges it by its first bytes (SVG is refused), stores
  it in Firebase Storage under a random name and the card in the library shows it. Nobody types a web address. Needs the service-account credentials and the
  storage bucket; without them the upload says so. "Remove image" clears it.
* **Deleting an assessment**: a published one must be unpublished first (the Delete button is off, with the reason beside it). One with responses asks a
  second time, naming how many answers go with it; only then are its submissions, peer answers, email records, versions and start counter deleted too.
* **Submissions screen**: "How each question went" shows the average answer for every scored question (0-100 after reverse scoring, lowest first; "Highest
  first" and "Show all" are one click away; only totals, never names). The people table has a search (name or email), filters (result or zone, email status,
  "Agreed to share") and an order. **Search never reaches what the privacy mode hides**: an anonymous row cannot be found by its name. "View answers" opens
  one person's answers, where the privacy mode allows it.
* **"i" tips**: the question editor explains each setting (Required, Count towards the score, Skill, Context, Weight, Reverse-scored, peer questions,
  Conditional visibility, labels...) in plain words, from a small "i" beside it. They open on hover, focus or tap and close with Escape.

### What visitors call it

On the site, in emails and in the PDF, participants read **"self-check"** ("Take a Self-Check", "Start self-check", "Self-checks"), not "assessment". The
address stays `/assessments/`, the admin screens still say "Assessments", the library's page description keeps the word once ("self-check assessments")
because that is what people search for, and the names of the individual assessments are the admin's own words.

### Privacy modes (per assessment)

`consented_only` (default) · `full` · `anonymous` · `none`. Result pages never return raw answers or the full email
address; admins can delete a participant's data from the submissions screen. Result and peer tokens are 256/192-bit
random, `noindex`, and not guessable.

## 5. Known limitations

* **Rate limiting is per server instance** (in memory), like the existing contact form. Submissions are idempotent and
  email sends are capped in the database, but add a shared limiter (e.g. Upstash) if you expect abuse.
* "Completion rate" uses an anonymous start counter; abandoned forms are not stored server-side (drafts live in the
  participant's browser only).
* Only SMTP is implemented as a mail provider; add another by implementing `MailProvider` in `lib/assessments/server/mail.ts`.
* Without `ASSESSMENT_ADMIN_EMAILS`, any signed-in Firebase user is an admin (same as the existing admin area). If your
  Firebase project allows public sign-up, set the allowlist.
* The starter Listening content is not psychometrically validated (see above).
* The PDF report cannot print scripts the bundled fonts lack (Devanagari, Cyrillic, Arabic, CJK...): they become "?" and an unwritable name becomes
  "Participant". Supporting them means adding a font that covers the script to `assets.ts` and the layout's font list.
* The report is made again on every download (about a tenth of a second); there is no stored copy.
* Thumbnails that are replaced or removed stay in Firebase Storage; old uploads are not deleted automatically.
