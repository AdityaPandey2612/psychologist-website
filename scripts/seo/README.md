# SEO checks

Reusable checks for the live site or a local production build. Run them against
`npm run build && npm run start` before merging SEO-sensitive changes.

| Command | What it checks | Extra packages |
|---|---|---|
| `npm run seo:check -- --base http://localhost:3000` | Crawls every page reachable from `/` and the sitemap: status codes, one H1, unique titles without duplicated branding, descriptions, canonicals, Open Graph/Twitter tags, JSON-LD, robots directives, broken internal links, sitemap coverage, robots.txt, 404 handling | none |
| `npm run seo:browser -- --base http://localhost:3000` | Horizontal overflow at 320–1440 px, axe-core accessibility, tap targets, console errors, mobile menu, keyboard focus, contact form (submissions are intercepted, nothing is sent) | `playwright-core`, `axe-core` |
| `npm run seo:consent -- --base http://localhost:3000` | Microsoft Clarity consent flow and Content-Security-Policy violations | `playwright-core` |
| `npm run seo:lighthouse -- --base http://localhost:3000` | Lighthouse mobile + desktop scores and lab metrics | `lighthouse` |

The browser-based checks use the installed Chrome (`CHROME_PATH` to override).
Their packages are deliberately not project dependencies; install them without
touching `package.json`:

```sh
npm i --no-save playwright-core axe-core lighthouse
```

Analytics hits (Google Analytics, Clarity) are blocked during the browser runs
so test traffic doesn't appear in the dashboards. Without `--base`, the checks
run against https://www.chaitanyaraj.com. Each script accepts `--json <file>`
to save a full report.
