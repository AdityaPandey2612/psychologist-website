#!/usr/bin/env node
// Browser checks: horizontal overflow across viewports, axe-core accessibility,
// small tap targets, console/hydration errors, mobile menu and keyboard focus.
//
// Needs playwright-core and axe-core, which are intentionally not project
// dependencies. Install them without touching package.json:
//   npm i --no-save playwright-core axe-core
// or point SEO_TOOLS_DIR at a folder where they are installed.
//
// Usage:
//   node scripts/seo/mobile-a11y-check.mjs --base http://localhost:3000
//   node scripts/seo/mobile-a11y-check.mjs --pages /,/contact --json out.json
//   node scripts/seo/mobile-a11y-check.mjs --all          # every sitemap URL
// Uses the installed Chrome (override with CHROME_PATH).

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(
  process.env.SEO_TOOLS_DIR ? join(process.env.SEO_TOOLS_DIR, "noop.js") : import.meta.url
);
const { chromium } = require("playwright-core");
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[token.slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
}

const BASE = String(args.base ?? "https://www.chaitanyaraj.com").replace(/\/$/, "");
const CANONICAL_ORIGIN = "https://www.chaitanyaraj.com";
const VIEWPORTS = String(args.viewports ?? "320,360,375,390,414,768,1024,1440").split(",").map(Number);
const AXE_VIEWPORTS = [375, 1440];
const DEFAULT_PAGES = [
  "/", "/about", "/about/the-founder", "/about/our-team", "/conditions",
  "/conditions/anxiety-therapy-navi-mumbai", "/therapies", "/therapies/cognitive-behavioural-therapy",
  "/counselling-navi-mumbai", "/couples-counselling-navi-mumbai", "/online-therapy-international-clients",
  "/hypnotherapy-navi-mumbai", "/blog", "/case-studies/insomnia", "/fees", "/contact", "/gallery",
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

async function sitemapPages() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const p = new URL(m[1].trim()).pathname.replace(/\/$/, "");
    return p || "/";
  });
}

// Runs in the page: elements that stick out past the viewport's right/left edge
// and are not clipped by an ancestor.
function findOverflow() {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const clippedByAncestor = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) {
        const r = a.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    if (clippedByAncestor(el)) continue;
    // Report the outermost offender only.
    if (el.parentElement) {
      const pr = el.parentElement.getBoundingClientRect();
      if ((pr.right > vw + 1 || pr.left < -1) && !clippedByAncestor(el.parentElement)) continue;
    }
    offenders.push({
      el: describe(el),
      left: Math.round(r.left),
      right: Math.round(r.right),
      text: (el.innerText || "").trim().slice(0, 60),
    });
  }
  // Text can overflow its own box (a long word in a narrow column) without any
  // element box crossing the edge, so look at text runs as well.
  if (!offenders.length && document.documentElement.scrollWidth > vw) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n && offenders.length < 10; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      range.selectNodeContents(n);
      const rect = [...range.getClientRects()].find((r) => r.right > vw + 1);
      if (rect) {
        offenders.push({
          el: `text in ${describe(n.parentElement)}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          text: n.textContent.trim().slice(0, 60),
        });
      }
    }
  }
  return {
    viewport: vw,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: offenders.slice(0, 10),
  };
}

// Runs in the page: visible interactive controls smaller than 44px / 24px,
// ignoring links that sit inline inside running text (WCAG 2.5.8 exception).
function findSmallTargets() {
  const out = { under44: [], under24: [] };
  const els = document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]");
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // 1×1 boxes are visually hidden (sr-only) controls such as the skip link.
    if (r.width <= 1 || r.height <= 1 || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    if (s.display === "inline") {
      const parentText = (el.parentElement?.innerText || "").trim();
      if (parentText.length > (el.innerText || "").trim().length + 15) continue;
    }
    const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.innerText || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
    if (r.width < 24 || r.height < 24) out.under24.push(label);
    if (r.width < 44 || r.height < 44) out.under44.push(label);
  }
  return out;
}

// Keeps test traffic out of the site's analytics: the tags still load (so CSP
// and script loading are exercised) but their hits never leave the browser.
const ANALYTICS_HITS =
  /^https:\/\/([a-z0-9-]+\.)*(google-analytics\.com|analytics\.google\.com|doubleclick\.net|clarity\.ms|bing\.com)\/|^https:\/\/www\.google\.com\/g\/collect/;

async function newContext(browser, options) {
  const context = await browser.newContext(options);
  await context.route(ANALYTICS_HITS, (route) => route.abort());
  return context;
}

async function settle(page) {
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

async function main() {
  const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH");
  const pages = args.all ? await sitemapPages() : args.pages ? String(args.pages).split(",") : DEFAULT_PAGES;

  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const results = [];

  for (const path of pages) {
    const url = BASE + path;
    const entry = { path, overflow: [], axe: {}, smallTargets: null, consoleErrors: [] };
    const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // Failures of the analytics hits blocked above are not site errors.
      if (ANALYTICS_HITS.test(msg.location()?.url ?? "")) return;
      entry.consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err) => entry.consoleErrors.push(`pageerror: ${err.message.slice(0, 200)}`));

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await settle(page);
      const o = await page.evaluate(findOverflow);
      entry.overflow.push({ width, scrollWidth: o.scrollWidth, overflowPx: Math.max(0, o.scrollWidth - o.viewport), offenders: o.offenders });

      if (width === 375) entry.smallTargets = await page.evaluate(findSmallTargets);

      if (AXE_VIEWPORTS.includes(width)) {
        await page.addScriptTag({ content: axeSource });
        const axe = await page.evaluate(async () => {
          // eslint-disable-next-line no-undef
          const r = await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
          });
          return r.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            count: v.nodes.length,
            sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").split("\n").slice(0, 2).join(" ").slice(0, 220) })),
          }));
        });
        entry.axe[width] = axe;
      }
    }
    await context.close();
    results.push(entry);
    const worst = Math.max(...entry.overflow.map((o) => o.overflowPx));
    const serious = Object.values(entry.axe).flat().filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log(
      `${path.padEnd(48)} overflow max ${String(worst).padStart(3)}px · axe serious/critical ${serious.length} (${[...new Set(serious.map((v) => v.id))].join(",") || "-"}) · tap<44 ${entry.smallTargets?.under44.length ?? "?"} · tap<24 ${entry.smallTargets?.under24.length ?? "?"} · console errors ${entry.consoleErrors.length}`
    );
  }

  // Interaction checks on a mobile viewport.
  const interactions = {};
  {
    const context = await newContext(browser, { viewport: { width: 375, height: 780 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const toggle = page.locator('header button[aria-label="Toggle menu"]');
    interactions.menuButton = await toggle.count();
    if (interactions.menuButton) {
      await toggle.click();
      const nav = page.locator("header nav").last();
      interactions.menuOpen = await nav.isVisible();
      interactions.menuLinks = await nav.locator("a").count();
      const sub = nav.locator('button[aria-label^="Toggle"]').first();
      if (await sub.count()) {
        const before = await nav.locator("a").count();
        await sub.click();
        interactions.submenuExpands = (await nav.locator("a").count()) > before;
      }
      await toggle.click();
      interactions.menuCloses = !(await page.locator("header nav").last().isVisible().catch(() => false)) || (await page.locator("header nav").count()) === 1;
    }

    // Keyboard: the first focusable elements must show a visible focus style.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const focus = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      focus.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
          return { el: `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 25)}"`, visible };
        })
      );
    }
    interactions.focus = focus.filter(Boolean);
    interactions.focusAllVisible = interactions.focus.every((f) => f.visible);
    await context.close();
  }

  // Contact form: fills the form and intercepts EVERY POST request (the form
  // posts straight to Web3Forms from the browser) so nothing is ever sent.
  {
    const context = await newContext(browser, { viewport: { width: 375, height: 780 } });
    const page = await context.newPage();
    let captured = null;
    await context.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") return route.fallback();
      let body = req.postData();
      try {
        body = JSON.parse(body);
      } catch {}
      captured = { url: req.url(), body };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, ok: true }) });
    });
    await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const form = page.locator("form").first();
    interactions.contactFormPresent = (await form.count()) > 0;
    if (interactions.contactFormPresent) {
      const fields = await form.locator("input, textarea, select").evaluateAll((els) =>
        els.map((e) => ({
          tag: e.tagName.toLowerCase(),
          type: e.getAttribute("type"),
          name: e.getAttribute("name"),
          id: e.id,
          required: e.required,
          honeypot: e.tabIndex === -1 || Boolean(e.closest('[aria-hidden="true"]')),
        }))
      );
      interactions.contactFields = fields;
      for (const f of fields) {
        if (f.honeypot) continue;
        const sel = f.id ? `#${f.id}` : f.name ? `[name="${f.name}"]` : null;
        if (!sel) continue;
        const loc = form.locator(sel);
        if (f.tag === "select") {
          const opts = await loc.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
          if (opts.length) await loc.selectOption(opts[0]);
        } else if (f.type === "checkbox" || f.type === "radio") {
          await loc.first().check().catch(() => {});
        } else if (f.type === "email") await loc.fill("seo-test@example.com");
        else if (f.type === "tel") await loc.fill("9999999999");
        else if (f.type !== "submit") await loc.fill("Automated SEO regression test — please ignore.");
      }
      await form.locator('button[type="submit"], button:not([type])').first().click();
      await page.waitForTimeout(1500);
      interactions.contactSubmitted = captured !== null;
      interactions.contactPostedTo = captured?.url ?? null;
      interactions.contactPayloadKeys =
        captured && typeof captured.body === "object" && captured.body ? Object.keys(captured.body).filter((k) => k !== "access_key") : null;
      interactions.contactSuccessShown = await page.getByText("Message sent").first().isVisible().catch(() => false);
    }
    await context.close();
  }

  await browser.close();

  const summary = {
    pages: results.length,
    viewports: VIEWPORTS,
    pagesWithOverflow: results.filter((r) => r.overflow.some((o) => o.overflowPx > 0)).map((r) => ({
      path: r.path,
      widths: r.overflow.filter((o) => o.overflowPx > 0).map((o) => `${o.width}:+${o.overflowPx}px`),
      offenders: r.overflow.find((o) => o.overflowPx > 0)?.offenders,
    })),
    axeSeriousByRule: {},
    pagesWithConsoleErrors: results.filter((r) => r.consoleErrors.length).map((r) => ({ path: r.path, errors: [...new Set(r.consoleErrors)].slice(0, 5) })),
    interactions,
  };
  for (const r of results) {
    for (const v of Object.values(r.axe).flat()) {
      const key = `${v.impact}:${v.id}`;
      summary.axeSeriousByRule[key] = summary.axeSeriousByRule[key] ?? { pages: new Set(), sample: v.sample };
      summary.axeSeriousByRule[key].pages.add(r.path);
    }
  }
  for (const v of Object.values(summary.axeSeriousByRule)) v.pages = [...v.pages];

  console.log("\nOverflow:", summary.pagesWithOverflow.length ? JSON.stringify(summary.pagesWithOverflow, null, 1) : "none");
  console.log("\naxe violations by rule:");
  for (const [k, v] of Object.entries(summary.axeSeriousByRule)) console.log(`  ${k}  pages=${v.pages.length}  e.g. ${v.sample[0]?.target} ${v.sample[0]?.summary ?? ""}`);
  console.log("\nConsole errors:", summary.pagesWithConsoleErrors.length ? JSON.stringify(summary.pagesWithConsoleErrors, null, 1) : "none");
  console.log("\nInteractions:", JSON.stringify(interactions, null, 1));

  if (args.json) await writeFile(String(args.json), JSON.stringify({ base: BASE, canonicalOrigin: CANONICAL_ORIGIN, summary, results }, null, 2));
  const failed =
    summary.pagesWithOverflow.length > 0 ||
    Object.keys(summary.axeSeriousByRule).some((k) => /^(serious|critical):/.test(k));
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
