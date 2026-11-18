import React from "react";
(globalThis as { React?: typeof React }).React = React;
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { useWwwLinks } from "../../lib/blog/links";
import { conditions } from "../../lib/data/conditions";
import { fitDescription, buildMetadata } from "../../lib/seo/metadata";
import { LocalBusinessJsonLd } from "../../lib/seo/jsonld";

describe("meta descriptions", () => {
  it("leaves a description that already fits alone", () => {
    const text = "Book past life regression therapy in Mumbai, Navi Mumbai or online from anywhere in the world, including the UK, US and Canada. 25+ years' experience.";
    assert.equal(fitDescription(text), text);
  });

  it("shortens a long one to a snippet, at a sentence, a clause or a word", () => {
    const long = "A 5–7 minute, 21-question reflection on how you have been feeling over the past Months, with a private results summary and guidance on whether talking to someone could help.";
    const fitted = fitDescription(long);
    assert.ok(fitted.length <= 155, String(fitted.length));
    assert.ok(fitted.length >= 80);
    assert.match(fitted, /[.…]$/);
    const first = "A first sentence that is long and informative about the topic, the place and the people it is for, kept whole.";
    const sentence = fitDescription(`${first} ${"Second sentence ".repeat(12)}`);
    assert.equal(sentence, first, "cut after the last whole sentence that leaves most of the description");
    assert.equal(fitDescription("word ".repeat(60)).endsWith("…"), true);
  });

  it("is applied to every page's metadata", () => {
    const meta = buildMetadata({ title: "T", description: "x".repeat(10) + " word".repeat(60), path: "/p" });
    assert.ok((meta.description ?? "").length <= 156);
    assert.ok((meta.description ?? "").length > 0);
  });
});

describe("links inside blog posts", () => {
  it("send the bare domain and plain http to the preferred https://www address", () => {
    const html = useWwwLinks(
      '<p><a href="https://chaitanyaraj.com/">a</a> <a href="http://chaitanyaraj.com/contact">b</a> <a href="https://www.chaitanyaraj.com/fees">c</a> <a href=\'http://www.chaitanyaraj.com\'>d</a> <a href="https://example.com/chaitanyaraj.com">e</a></p>',
    );
    assert.match(html, /href="https:\/\/www\.chaitanyaraj\.com\/"/);
    assert.match(html, /href="https:\/\/www\.chaitanyaraj\.com\/contact"/);
    assert.match(html, /href="https:\/\/www\.chaitanyaraj\.com\/fees"/);
    assert.match(html, /href='https:\/\/www\.chaitanyaraj\.com'/);
    assert.match(html, /href="https:\/\/example\.com\/chaitanyaraj\.com"/, "another site is left alone");
    assert.equal(/href="https?:\/\/chaitanyaraj\.com/.test(html), false);
  });
});

describe("the sitemap", () => {
  it("lists addresses and real dates only: no changefreq or priority (Google ignores them)", () => {
    const code = readFileSync("app/sitemap.ts", "utf8")
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.equal(/changeFrequency|priority/.test(code), false);
    assert.match(code, /lastModified/);
  });
});

describe("what the site says about confidentiality", () => {
  it("never promises absolute confidentiality; the answers name the safety exceptions", () => {
    for (const c of conditions) {
      for (const text of [c.metaDescription, c.intro, ...(c.faqs ?? []).map((f) => f.answer)]) {
        assert.equal(/completely confidential|fully confidential|strictly confidential|absolutely confidential/i.test(text), false, `${c.slug}: ${text.slice(0, 60)}`);
      }
      for (const f of (c.faqs ?? []).filter((f) => /confidential/i.test(f.question))) {
        assert.match(f.answer, /exceptions|risk of harm|safety|safeguard/i, `${c.slug}: ${f.answer.slice(0, 80)}`);
      }
    }
  });
});

describe("the clinics in the structured data", () => {
  it("gives each branch clinic a stable @id", () => {
    const html = renderToStaticMarkup(<LocalBusinessJsonLd />);
    const data = JSON.parse(html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    assert.ok(data.department.length >= 1);
    for (const dept of data.department) assert.match(dept["@id"], /^https:\/\/www\.chaitanyaraj\.com\/#clinic-[a-z0-9-]+$/);
  });
});
