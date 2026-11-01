import React from "react";
(globalThis as { React?: typeof React }).React = React; // the site files use the automatic JSX runtime; tsx needs React in scope
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildMetadata, DEFAULT_OG_IMAGE, ogLabel } from "../../lib/seo/metadata";
import { ArticleJsonLd } from "../../lib/seo/jsonld";

const imageOf = (meta: ReturnType<typeof buildMetadata>) => (meta.openGraph as { images: Array<{ url: string; width?: number; height?: number }> }).images[0];
const twitterImage = (meta: ReturnType<typeof buildMetadata>) => (meta.twitter as { images: string[] }).images[0];

describe("social-sharing images", () => {
  it("gives a page without its own picture an image made from its title and section", () => {
    const meta = buildMetadata({ title: "Anxiety & Panic Attack Therapy in Vashi", description: "d", path: "/conditions/anxiety-therapy-navi-mumbai" });
    const url = new URL(imageOf(meta).url);
    assert.equal(url.pathname, "/og");
    assert.equal(url.searchParams.get("title"), "Anxiety & Panic Attack Therapy in Vashi");
    assert.equal(url.searchParams.get("label"), "Condition");
    assert.equal(imageOf(meta).width, 1200);
    assert.equal(imageOf(meta).height, 630);
    assert.equal(twitterImage(meta), imageOf(meta).url, "the same picture for Twitter and Facebook");
  });

  it("makes different pages' images different", () => {
    const a = imageOf(buildMetadata({ title: "Anxiety", description: "d", path: "/conditions/a" })).url;
    const b = imageOf(buildMetadata({ title: "Depression", description: "d", path: "/conditions/b" })).url;
    assert.notEqual(a, b);
  });

  it("labels each kind of page", () => {
    const labels: Array<[string, string]> = [
      ["/conditions/x", "Condition"],
      ["/therapies/x", "Therapy"],
      ["/case-studies/x", "Case study"],
      ["/training-and-mentorship", "Training"],
      ["/blog/x", "Blog"],
      ["/about/the-founder", "About"],
      ["/corporate-wellness-programs-navi-mumbai", "Corporate wellness"],
      ["/fees", "Chaitanya Raj"],
    ];
    for (const [path, label] of labels) assert.equal(ogLabel(path), label, path);
  });

  it("keeps a page's own picture (blog covers) and the home page's default", () => {
    const own = buildMetadata({ title: "Post", description: "d", path: "/blog/post", image: "https://example.com/cover.jpg" });
    assert.equal(imageOf(own).url, "https://example.com/cover.jpg");
    assert.equal(twitterImage(own), "https://example.com/cover.jpg");
    assert.equal(imageOf(buildMetadata({ title: "Home", description: "d", path: "/" })).url, DEFAULT_OG_IMAGE);
  });

  it("puts odd characters in the title safely into the link", () => {
    const url = imageOf(buildMetadata({ title: 'Fear & "worry" #1 ? 100%', description: "d", path: "/therapies/x" })).url;
    assert.equal(new URL(url).searchParams.get("title"), 'Fear & "worry" #1 ? 100%');
  });
});

describe("the author and sources in a post's search data", () => {
  const render = (references?: { title: string; url: string }[]) => {
    const html = renderToStaticMarkup(<ArticleJsonLd title="T" description="D" path="/blog/t" datePublished="2026-10-28" references={references} />);
    return JSON.parse(html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
  };

  it("names the practitioner, a person, as the author, not the organisation", () => {
    const data = render();
    assert.equal(data["@type"], "Article");
    assert.equal(data.author["@type"], "Person");
    assert.equal(data.author.name, "Lt Col Rajesh Sharma (Retd)");
    assert.match(data.author.url, /\/about\/the-founder$/);
    assert.equal(data.publisher["@type"], "Organization");
  });

  it("lists the sources as citations, and adds nothing when there are none", () => {
    const data = render([{ title: "WHO", url: "https://www.who.int/x" }]);
    assert.deepEqual(data.citation, [{ "@type": "CreativeWork", name: "WHO", url: "https://www.who.int/x" }]);
    assert.equal("citation" in render(), false);
    assert.equal("citation" in render([]), false);
  });
});
