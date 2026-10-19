#!/usr/bin/env node
// Runs Lighthouse (mobile + desktop) for a set of pages and prints category
// scores plus the main lab metrics. Lighthouse is intentionally not a project
// dependency:  npm i --no-save lighthouse   (or set SEO_TOOLS_DIR).
//
// Usage:
//   node scripts/seo/lighthouse.mjs --base http://localhost:3000 --json lh.json
//   node scripts/seo/lighthouse.mjs --pages /,/contact --runs 3
// Uses the installed Chrome (override with CHROME_PATH). Lab data only — field
// data (CrUX, INP) is not measured here.

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(
  process.env.SEO_TOOLS_DIR ? join(process.env.SEO_TOOLS_DIR, "noop.js") : import.meta.url
);
const lighthouse = (await import(pathToFileURL(require.resolve("lighthouse")).href)).default;
const desktopConfig = (await import(pathToFileURL(require.resolve("lighthouse/core/config/desktop-config.js")).href)).default;
const chromeLauncher = await import(pathToFileURL(require.resolve("chrome-launcher")).href);

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[token.slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
}

const BASE = String(args.base ?? "https://www.chaitanyaraj.com").replace(/\/$/, "");
const PAGES = String(args.pages ?? "/,/conditions/anxiety-therapy-navi-mumbai,/therapies/cognitive-behavioural-therapy,/blog,/contact").split(",");
const RUNS = Number(args.runs ?? 1);
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function main() {
  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ["--headless=new", "--no-first-run"] });
  const results = [];
  try {
    for (const path of PAGES) {
      for (const formFactor of ["mobile", "desktop"]) {
        const runs = [];
        for (let i = 0; i < RUNS; i++) {
          const res = await lighthouse(
            BASE + path,
            {
              port: chrome.port,
              output: "json",
              logLevel: "error",
              // Analytics tags still load; only their hits are blocked so test
              // runs don't show up as visits.
              blockedUrlPatterns: ["*google-analytics.com/g/collect*", "*analytics.google.com*", "*doubleclick.net*", "*clarity.ms/collect*"]
            },
            formFactor === "desktop" ? desktopConfig : undefined
          );
          const lhr = res.lhr;
          const failing = (cat) =>
            lhr.categories[cat].auditRefs
              .filter((r) => r.weight > 0 && lhr.audits[r.id].score !== null && lhr.audits[r.id].score < 1)
              .map((r) => `${r.id}(${lhr.audits[r.id].score})`);
          runs.push({
            performance: Math.round(lhr.categories.performance.score * 100),
            accessibility: Math.round(lhr.categories.accessibility.score * 100),
            bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
            seo: Math.round(lhr.categories.seo.score * 100),
            fcp: lhr.audits["first-contentful-paint"].numericValue,
            lcp: lhr.audits["largest-contentful-paint"].numericValue,
            tbt: lhr.audits["total-blocking-time"].numericValue,
            cls: lhr.audits["cumulative-layout-shift"].numericValue,
            si: lhr.audits["speed-index"].numericValue,
            failingBestPractices: failing("best-practices"),
            failingSeo: failing("seo"),
            failingA11y: failing("accessibility"),
            unusedJsKiB: Math.round((lhr.audits["unused-javascript"]?.details?.overallSavingsBytes ?? 0) / 1024),
            thirdPartyKiB: Math.round(
              (lhr.audits["third-party-summary"]?.details?.items ?? []).reduce((s, x) => s + (x.transferSize ?? 0), 0) / 1024
            ),
          });
        }
        const pick = (k) => median(runs.map((r) => r[k]));
        const row = {
          path,
          formFactor,
          runs: RUNS,
          performance: pick("performance"),
          accessibility: pick("accessibility"),
          bestPractices: pick("bestPractices"),
          seo: pick("seo"),
          fcpMs: Math.round(pick("fcp")),
          lcpMs: Math.round(pick("lcp")),
          tbtMs: Math.round(pick("tbt")),
          cls: Number(pick("cls").toFixed(3)),
          siMs: Math.round(pick("si")),
          unusedJsKiB: pick("unusedJsKiB"),
          thirdPartyKiB: pick("thirdPartyKiB"),
          failingBestPractices: runs[0].failingBestPractices,
          failingSeo: runs[0].failingSeo,
          failingA11y: runs[0].failingA11y,
        };
        results.push(row);
        console.log(
          `${formFactor.padEnd(7)} ${path.padEnd(45)} P${row.performance} A${row.accessibility} BP${row.bestPractices} SEO${row.seo} · LCP ${row.lcpMs}ms TBT ${row.tbtMs}ms CLS ${row.cls} · BP fails: ${row.failingBestPractices.join(",") || "-"} · SEO fails: ${row.failingSeo.join(",") || "-"} · A11y fails: ${row.failingA11y.join(",") || "-"}`
        );
      }
    }
  } finally {
    await chrome.kill();
  }
  if (args.json) await writeFile(String(args.json), JSON.stringify({ base: BASE, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
