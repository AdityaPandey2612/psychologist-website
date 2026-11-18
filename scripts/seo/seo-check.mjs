#!/usr/bin/env node
// Technical SEO checker. Crawls every internal page reachable from "/" and the
// sitemap, then verifies status codes, headings, metadata, canonicals, Open
// Graph/Twitter tags, JSON-LD, robots directives, internal links and sitemap
// coverage. Dependency-free (Node 18+).
//
// Usage:
//   node scripts/seo/seo-check.mjs                          # live site
//   node scripts/seo/seo-check.mjs --base http://localhost:3000
//   node scripts/seo/seo-check.mjs --json seo-report.json   # also write JSON
//
// Exits with code 1 when any page-level or sitemap check fails.

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[token.slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
}

const CANONICAL_ORIGIN = String(args.canonical ?? "https://www.chaitanyaraj.com").replace(/\/$/, "");
const BASE = String(args.base ?? CANONICAL_ORIGIN).replace(/\/$/, "");
const BRAND = "Chaitanya Raj";
const EXCLUDED = [/^\/admin(\/|$)/, /^\/api\//, /^\/_next\//];
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;
const CONCURRENCY = 6;

const decode = (s) =>
  (s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|&#160;/g, " ");

const collapse = (s) => decode(s).replace(/\s+/g, " ").trim();

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}=("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3]) : null;
};

function metas(head) {
  return (head.match(/<meta\b[^>]*>/gi) ?? []).map((t) => ({
    name: (attr(t, "name") ?? attr(t, "property") ?? "").toLowerCase(),
    content: attr(t, "content"),
  }));
}

const metaValue = (list, name) => list.find((m) => m.name === name)?.content ?? null;

const toPath = (url) => {
  try {
    const u = new URL(url, BASE);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
};

// Root URL without a trailing slash, matching how Next.js serialises canonicals.
const canonicalFor = (path) => (path === "/" ? CANONICAL_ORIGIN : `${CANONICAL_ORIGIN}${path}`);
const fetchUrlFor = (url) => url.replace(CANONICAL_ORIGIN, BASE);

async function request(url, method = "GET") {
  const started = Date.now();
  try {
    const res = await fetch(url, { method, redirect: "manual", headers: { "user-agent": "seo-check/1.0" } });
    const body = method === "GET" ? await res.text() : "";
    return { status: res.status, headers: res.headers, body, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, headers: new Headers(), body: "", ms: Date.now() - started, error: error.message };
  }
}

async function pool(items, worker) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx]);
      }
    })
  );
  return out;
}

function analyse(path, res) {
  const html = res.body;
  const head = html.split(/<\/head>/i)[0] ?? "";
  const metaList = metas(head);
  const rawTitles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1]));
  const title = collapse(rawTitles[0] ?? "");
  const description = metaValue(metaList, "description");
  const canonicals = (head.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi) ?? []).map((t) => attr(t, "href"));
  const robotsMeta = metaValue(metaList, "robots") ?? "";
  const robotsHeader = res.headers.get("x-robots-tag") ?? "";
  const noindex = /noindex/i.test(robotsMeta) || /noindex/i.test(robotsHeader);

  const bodyHtml = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const headings = [...bodyHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: collapse(m[2].replace(/<[^>]+>/g, " ")),
  }));
  const h1s = headings.filter((h) => h.level === 1);
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      skips.push(`h${headings[i - 1].level}→h${headings[i].level} ("${headings[i].text.slice(0, 40)}")`);
    }
  }

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgMissingAlt = imgs.filter((t) => attr(t, "alt") === null).length;

  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return { ok: true, data: JSON.parse(m[1]) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  const ldTypes = [];
  const ldUrls = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node["@type"]) ldTypes.push([].concat(node["@type"]).join("/"));
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && /^(url|item|@id|image|logo)$/.test(k) && v.startsWith("http")) ldUrls.push(v);
      else if (typeof v === "object") walk(v);
    }
  };
  jsonLd.filter((j) => j.ok).forEach((j) => walk(j.data));

  const links = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = decode(m[1]);
    if (/^(mailto:|tel:|#|javascript:)/i.test(href)) continue;
    let u;
    try {
      u = new URL(href, BASE);
    } catch {
      continue;
    }
    const internal = u.origin === BASE || u.origin === CANONICAL_ORIGIN;
    if (!internal) continue;
    const p = u.pathname.replace(/\/$/, "") || "/";
    if (/\.[a-z0-9]{2,5}$/i.test(p)) continue; // files, not pages
    links.add(p);
  }

  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ?? [])[1] ?? "";
  const mainWords = collapse(
    main.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  )
    .split(" ")
    .filter((w) => /[a-z0-9]/i.test(w)).length;

  return {
    path,
    status: res.status,
    location: res.headers.get("location"),
    ms: res.ms,
    title,
    rawTitle: rawTitles[0] ?? "",
    titleCount: rawTitles.length,
    description,
    canonicals,
    robotsMeta,
    robotsHeader,
    noindex,
    h1s: h1s.map((h) => h.text),
    headingSkips: skips,
    imgCount: imgs.length,
    imgMissingAlt,
    og: {
      title: metaValue(metaList, "og:title"),
      description: metaValue(metaList, "og:description"),
      url: metaValue(metaList, "og:url"),
      image: metaValue(metaList, "og:image"),
      type: metaValue(metaList, "og:type"),
      siteName: metaValue(metaList, "og:site_name"),
    },
    twitter: {
      card: metaValue(metaList, "twitter:card"),
      title: metaValue(metaList, "twitter:title"),
      description: metaValue(metaList, "twitter:description"),
      image: metaValue(metaList, "twitter:image"),
    },
    jsonLdInvalid: jsonLd.filter((j) => !j.ok).map((j) => j.error),
    ldTypes,
    ldUrls,
    links: [...links],
    mainWords,
  };
}

async function main() {
  const report = { base: BASE, canonicalOrigin: CANONICAL_ORIGIN, startedAt: new Date().toISOString() };

  // robots.txt + sitemap
  const robots = await request(`${BASE}/robots.txt`);
  const sitemapRes = await request(`${BASE}/sitemap.xml`);
  const sitemapEntries = [...sitemapRes.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: collapse((m[1].match(/<loc>([\s\S]*?)<\/loc>/) ?? [])[1] ?? ""),
    lastmod: collapse((m[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/) ?? [])[1] ?? "") || null,
  }));

  // Crawl: start from "/" and every sitemap URL, follow internal links.
  const pages = new Map();
  const queue = ["/", ...sitemapEntries.map((e) => toPath(e.loc)).filter(Boolean)];
  const seen = new Set();
  while (queue.length) {
    const batch = [];
    while (queue.length && batch.length < 30) {
      const p = queue.shift();
      if (seen.has(p) || EXCLUDED.some((r) => r.test(p))) continue;
      seen.add(p);
      batch.push(p);
    }
    const results = await pool(batch, async (p) => analyse(p, await request(BASE + (p === "/" ? "/" : p))));
    for (const page of results) {
      pages.set(page.path, page);
      if (page.status === 200) page.links.forEach((l) => !seen.has(l) && queue.push(l));
    }
  }

  // Status of every linked path (incl. ones excluded from analysis).
  const linkedFrom = new Map();
  for (const page of pages.values()) {
    for (const l of page.links) {
      if (!linkedFrom.has(l)) linkedFrom.set(l, []);
      linkedFrom.get(l).push(page.path);
    }
  }

  const ok200 = [...pages.values()].filter((p) => p.status === 200);
  const indexable = ok200.filter((p) => !p.noindex);

  // OG image reachability (unique URLs)
  const ogImages = [...new Set(indexable.map((p) => p.og.image).filter(Boolean))];
  const ogImageStatus = Object.fromEntries(
    await pool(ogImages, async (u) => {
      const r = await request(fetchUrlFor(u), "GET");
      return [u, { status: r.status, type: r.headers.get("content-type") }];
    })
  );

  // Title / description duplicates
  const countBy = (key) => {
    const m = new Map();
    for (const p of indexable) {
      const v = key(p);
      if (v) m.set(v, [...(m.get(v) ?? []), p.path]);
    }
    return m;
  };
  const titleDupes = countBy((p) => p.title);
  const descDupes = countBy((p) => p.description);

  const failures = [];
  const warnings = [];
  const fail = (path, check, detail) => failures.push({ path, check, detail });
  const warn = (path, check, detail) => warnings.push({ path, check, detail });

  for (const p of pages.values()) {
    if (p.status !== 200) {
      const from = linkedFrom.get(p.path);
      if (from) fail(p.path, "broken-or-redirected-link", `status ${p.status}${p.location ? " → " + p.location : ""}; linked from ${from.slice(0, 3).join(", ")}`);
    }
  }

  for (const p of indexable) {
    const expected = canonicalFor(p.path);
    if (p.h1s.length !== 1) fail(p.path, "h1-count", `${p.h1s.length} H1 elements`);
    else if (p.h1s[0].length < 3) fail(p.path, "h1-empty", `"${p.h1s[0]}"`);
    if (p.headingSkips.length) warn(p.path, "heading-level-skip", p.headingSkips.slice(0, 3).join("; "));
    if (!p.title) fail(p.path, "title-missing", "");
    if (p.titleCount > 1) fail(p.path, "title-multiple", `${p.titleCount} <title> tags`);
    if (p.title.split(BRAND).length - 1 > 1) fail(p.path, "title-duplicate-brand", p.title);
    if (/\s{2,}|^\s|\s$/.test(p.rawTitle)) fail(p.path, "title-whitespace", JSON.stringify(p.rawTitle));
    if (p.title.length > TITLE_MAX) warn(p.path, "title-long", `${p.title.length} chars: ${p.title}`);
    if ((titleDupes.get(p.title) ?? []).length > 1) fail(p.path, "title-duplicate", titleDupes.get(p.title).join(", "));
    if (!p.description) fail(p.path, "description-missing", "");
    else {
      if (p.description.length < DESC_MIN || p.description.length > DESC_MAX)
        warn(p.path, "description-length", `${p.description.length} chars`);
      if (/\s{2,}/.test(p.description)) warn(p.path, "description-whitespace", JSON.stringify(p.description.slice(0, 80)));
      if ((descDupes.get(p.description) ?? []).length > 1) fail(p.path, "description-duplicate", descDupes.get(p.description).join(", "));
    }
    if (p.canonicals.length !== 1) fail(p.path, "canonical-count", `${p.canonicals.length} canonical tags`);
    else if (p.canonicals[0] !== expected) fail(p.path, "canonical-mismatch", `${p.canonicals[0]} (expected ${expected})`);
    if (!p.og.title || !p.og.description || !p.og.url || !p.og.image || !p.og.type)
      fail(p.path, "og-incomplete", JSON.stringify(p.og));
    if (p.og.url && p.og.url !== expected) fail(p.path, "og-url-mismatch", `${p.og.url} (expected ${expected})`);
    if (p.og.image) {
      const s = ogImageStatus[p.og.image];
      if (!s || s.status !== 200 || !/^image\//.test(s.type ?? "")) fail(p.path, "og-image-broken", `${p.og.image} → ${s?.status} ${s?.type}`);
    }
    if (!p.twitter.card || !p.twitter.title || !p.twitter.description || !p.twitter.image)
      fail(p.path, "twitter-incomplete", JSON.stringify(p.twitter));
    if (p.jsonLdInvalid.length) fail(p.path, "jsonld-invalid", p.jsonLdInvalid.join("; "));
    for (const u of p.ldUrls) {
      if (!u.startsWith(CANONICAL_ORIGIN)) continue;
      const lp = toPath(u);
      if (/\.[a-z0-9]{2,5}$/i.test(lp)) continue;
      const target = pages.get(lp);
      if (target && target.status !== 200) fail(p.path, "jsonld-url-broken", `${u} → ${target.status}`);
    }
    if (p.imgMissingAlt) fail(p.path, "img-missing-alt", `${p.imgMissingAlt} of ${p.imgCount}`);
  }

  // Sitemap checks
  const sitemapPaths = new Map();
  const sitemapIssues = [];
  const now = Date.now() + 24 * 3600 * 1000;
  for (const e of sitemapEntries) {
    const path = toPath(e.loc);
    if (!e.loc.startsWith(CANONICAL_ORIGIN)) sitemapIssues.push({ loc: e.loc, issue: "non-canonical origin" });
    if (sitemapPaths.has(path)) sitemapIssues.push({ loc: e.loc, issue: "duplicate" });
    sitemapPaths.set(path, e);
    const page = pages.get(path);
    if (!page) sitemapIssues.push({ loc: e.loc, issue: "not crawled" });
    else if (page.status !== 200) sitemapIssues.push({ loc: e.loc, issue: `status ${page.status}${page.location ? " → " + page.location : ""}` });
    else if (page.noindex) sitemapIssues.push({ loc: e.loc, issue: "noindex page in sitemap" });
    else if (e.loc !== canonicalFor(path)) sitemapIssues.push({ loc: e.loc, issue: `loc differs from canonical ${canonicalFor(path)}` });
    if (e.lastmod && (Number.isNaN(Date.parse(e.lastmod)) || Date.parse(e.lastmod) > now))
      sitemapIssues.push({ loc: e.loc, issue: `invalid lastmod ${e.lastmod}` });
  }
  const missingFromSitemap = indexable.map((p) => p.path).filter((p) => !sitemapPaths.has(p));
  missingFromSitemap.forEach((p) => sitemapIssues.push({ loc: canonicalFor(p), issue: "indexable page missing from sitemap" }));

  const robotsSitemapLine = (robots.body.match(/^sitemap:\s*(\S+)/im) ?? [])[1] ?? null;
  const robotsIssues = [];
  if (robots.status !== 200) robotsIssues.push(`robots.txt status ${robots.status}`);
  if (robotsSitemapLine !== `${CANONICAL_ORIGIN}/sitemap.xml`) robotsIssues.push(`Sitemap line is ${robotsSitemapLine}`);
  const disallows = [...robots.body.matchAll(/^disallow:\s*(\S*)/gim)].map((m) => m[1]).filter(Boolean);
  for (const path of sitemapPaths.keys()) {
    if (disallows.some((d) => path.startsWith(d))) robotsIssues.push(`sitemap URL ${path} is disallowed in robots.txt`);
  }

  // Unknown URLs must return 404
  const probes = ["/this-page-does-not-exist-seo-check", "/blog/this-post-does-not-exist", "/conditions/not-a-condition", "/therapies/not-a-therapy", "/case-studies/not-a-case", "/training-and-mentorship/not-a-course"];
  const notFoundChecks = await pool(probes, async (p) => ({ path: p, status: (await request(BASE + p)).status }));
  notFoundChecks.filter((c) => c.status !== 404).forEach((c) => fail(c.path, "unknown-url-not-404", `status ${c.status}`));

  report.summary = {
    crawled: pages.size,
    http200: ok200.length,
    indexable: indexable.length,
    non200: [...pages.values()].filter((p) => p.status !== 200).map((p) => `${p.path} ${p.status}`),
    missingH1: indexable.filter((p) => p.h1s.length === 0).length,
    multipleH1: indexable.filter((p) => p.h1s.length > 1).length,
    titlesOver60: indexable.filter((p) => p.title.length > TITLE_MAX).length,
    duplicateBrandTitles: indexable.filter((p) => p.title.split(BRAND).length - 1 > 1).length,
    sitemapUrls: sitemapEntries.length,
    sitemapIssues: sitemapIssues.length,
    missingFromSitemap: missingFromSitemap.length,
    failures: failures.length,
    warnings: warnings.length,
  };
  report.robots = { status: robots.status, sitemapLine: robotsSitemapLine, disallows, issues: robotsIssues };
  report.sitemap = { entries: sitemapEntries, issues: sitemapIssues };
  report.notFoundChecks = notFoundChecks;
  report.ogImageStatus = ogImageStatus;
  report.failures = failures;
  report.warnings = warnings;
  report.pages = [...pages.values()].map(({ links, ldUrls, ...rest }) => ({ ...rest, linkCount: links.length }));

  // Console output
  const s = report.summary;
  console.log(`\nSEO check: ${BASE} (canonical origin ${CANONICAL_ORIGIN})`);
  console.log(`Crawled ${s.crawled} URLs · ${s.http200} × 200 · ${s.indexable} indexable`);
  if (s.non200.length) console.log(`Non-200: ${s.non200.join(", ")}`);
  console.log(`Missing H1: ${s.missingH1} · Multiple H1: ${s.multipleH1} · Titles > ${TITLE_MAX}: ${s.titlesOver60} · Duplicate-brand titles: ${s.duplicateBrandTitles}`);
  console.log(`Sitemap: ${s.sitemapUrls} URLs · ${s.sitemapIssues} issues · ${s.missingFromSitemap} indexable pages missing`);
  console.log(`robots.txt: ${robotsIssues.length ? robotsIssues.join("; ") : "OK"}`);
  console.log(`404 probes: ${notFoundChecks.map((c) => `${c.path}=${c.status}`).join(", ")}`);
  const group = (list) => {
    const m = new Map();
    list.forEach((x) => m.set(x.check, [...(m.get(x.check) ?? []), x]));
    return m;
  };
  console.log(`\nFAILURES (${failures.length})`);
  for (const [check, list] of group(failures)) {
    console.log(`  ${check} × ${list.length}`);
    list.slice(0, 8).forEach((x) => console.log(`    ${x.path}  ${x.detail}`));
    if (list.length > 8) console.log(`    … ${list.length - 8} more`);
  }
  console.log(`\nWARNINGS (${warnings.length})`);
  for (const [check, list] of group(warnings)) {
    console.log(`  ${check} × ${list.length}`);
    list.slice(0, 5).forEach((x) => console.log(`    ${x.path}  ${x.detail}`));
    if (list.length > 5) console.log(`    … ${list.length - 5} more`);
  }
  if (sitemapIssues.length) {
    console.log(`\nSITEMAP ISSUES (${sitemapIssues.length})`);
    sitemapIssues.slice(0, 25).forEach((x) => console.log(`  ${x.loc}  ${x.issue}`));
  }

  if (args.json) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(String(args.json), JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to ${args.json}`);
  }
  process.exitCode = failures.length || sitemapIssues.length || robotsIssues.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
