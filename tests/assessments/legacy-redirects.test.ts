import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caseStudies } from "../../lib/data/caseStudies";
import { conditions } from "../../lib/data/conditions";
import { therapies } from "../../lib/data/therapies";
import { trainingPrograms } from "../../lib/data/training";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require("../../next.config.js") as { redirects: () => Promise<Array<{ source: string; destination: string; statusCode?: number; permanent?: boolean }>> };

const staticPaths = new Set([
  "/", "/about", "/about/the-founder", "/about/chaitanya-raj", "/about/myths-and-facts-about-hypnotherapy", "/about/media-highlights", "/conditions", "/therapies",
  "/counselling-navi-mumbai", "/couples-counselling-navi-mumbai", "/hypnotherapy-navi-mumbai", "/online-therapy-international-clients",
  "/corporate-wellness-programs-navi-mumbai", "/training-and-mentorship", "/case-studies", "/blog", "/gallery", "/fees", "/faq", "/testimonials", "/contact", "/assessments",
]);
const pagePaths = new Set<string>([
  ...staticPaths,
  ...conditions.map((c) => `/conditions/${c.slug}`),
  ...therapies.map((t) => `/therapies/${t.slug}`),
  ...trainingPrograms.map((p) => `/training-and-mentorship/${p.slug}`),
  ...caseStudies.map((c) => `/case-studies/${c.slug}`),
]);

describe("the old WordPress addresses", () => {
  it("each go to a page that exists, in one permanent step", async () => {
    const rules = await nextConfig.redirects();
    const legacy = rules.filter((r) => !r.source.includes(":") && !r.source.startsWith("/blog/") && r.source !== "/feed");
    assert.ok(legacy.length > 40, `only ${legacy.length} rules`);
    const sources = new Set(legacy.map((r) => r.source));
    for (const rule of legacy) {
      assert.equal(rule.statusCode, 301, rule.source);
      assert.ok(rule.destination.startsWith("/blog/") || pagePaths.has(rule.destination), `${rule.source} -> ${rule.destination} is not a page`);
      assert.equal(sources.has(rule.destination), false, `${rule.source} -> ${rule.destination} would be a chain of two redirects`);
      assert.notEqual(rule.destination, "/", `${rule.source} must not be sent to the home page`);
      assert.notEqual(rule.source, rule.destination);
    }
  });

  it("includes the ones found in the Internet Archive", async () => {
    const rules = await nextConfig.redirects();
    const find = (source: string) => rules.find((r) => r.source === source)?.destination;
    assert.equal(find("/phobia-or-fears"), "/conditions/phobia-treatment-navi-mumbai");
    assert.equal(find("/post-traumatic-stress-disorder-ptsd"), "/conditions/trauma-ptsd-counselling-navi-mumbai");
    assert.equal(find("/casestudies"), "/case-studies");
    assert.equal(find("/therapies/past-life-regression-technique"), "/conditions/best-past-life-regression-therapy-in-navi-mumbai");
  });
});
