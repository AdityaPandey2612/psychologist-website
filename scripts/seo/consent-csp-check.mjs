#!/usr/bin/env node
// Checks the Microsoft Clarity consent flow and the Content-Security-Policy:
//   1. first visit: banner shown, no Clarity request, no third-party cookies
//   2. "Allow": Clarity tag loads without CSP violations
//   3. reload: choice remembered, Clarity loads, banner hidden
//   4. footer "Analytics preferences" reopens the banner
//   5. "No thanks": Clarity is not loaded on the next page view
//   6. Google Analytics tag loads; key pages (incl. /admin/login) log no CSP violations
// Analytics hits (GA collect, Clarity collect, Bing pixel) are blocked so test
// runs never reach the dashboards.
//
// Needs playwright-core (npm i --no-save playwright-core, or SEO_TOOLS_DIR).
// Usage: node scripts/seo/consent-csp-check.mjs --base http://localhost:3000

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(
  process.env.SEO_TOOLS_DIR ? join(process.env.SEO_TOOLS_DIR, "noop.js") : import.meta.url
);
const { chromium } = require("playwright-core");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[token.slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
}
const BASE = String(args.base ?? "http://localhost:3000").replace(/\/$/, "");
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const BEACONS =
  /^https:\/\/([a-z0-9-]+\.)*(google-analytics\.com\/g\/collect|analytics\.google\.com|doubleclick\.net|bing\.com)|^https:\/\/www\.google\.com\/g\/collect|^https:\/\/[a-z]\.clarity\.ms\/(collect|c\.gif)/;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route(BEACONS, (route) => route.abort());

  const page = await context.newPage();
  const requests = [];
  const cspViolations = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) cspViolations.push(m.text().slice(0, 200));
  });
  const clarityRequested = () => requests.some((u) => /clarity\.ms\/tag\//.test(u));
  const banner = page.getByRole("region", { name: "Analytics preferences" });

  // 1. First visit
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("banner shown on first visit", await banner.isVisible());
  check("Clarity not requested before consent", !clarityRequested());
  const thirdPartyCookies = (await context.cookies()).filter((c) => !BASE.includes(c.domain.replace(/^\./, "")));
  check("no third-party cookies before consent", thirdPartyCookies.length === 0, thirdPartyCookies.map((c) => `${c.name}@${c.domain}`).join(", "));
  check("Google Analytics tag requested", requests.some((u) => u.includes("googletagmanager.com/gtag/js")));

  // 2. Allow
  await banner.getByRole("button", { name: "Allow" }).click();
  await page.waitForTimeout(3000);
  check("Clarity tag requested after Allow", clarityRequested());
  check("banner hidden after Allow", !(await banner.isVisible()));

  // 3. Reload remembers the choice
  requests.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check("choice remembered on reload (Clarity loads, no banner)", clarityRequested() && !(await banner.isVisible()));

  // 4. Footer button reopens the banner
  await page.getByRole("button", { name: "Analytics preferences" }).click();
  check("footer button reopens banner", await banner.isVisible());

  // 5. Decline
  await banner.getByRole("button", { name: "No thanks" }).click();
  requests.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check("Clarity not loaded after No thanks", !clarityRequested() && !(await banner.isVisible()));

  // 6. CSP across representative pages
  for (const path of ["/", "/contact", "/blog", "/gallery", "/conditions/anxiety-therapy-navi-mumbai", "/about/media-highlights", "/admin/login"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
  }
  check("no CSP violations on key pages (after consent flow)", cspViolations.length === 0, [...new Set(cspViolations)].join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
