import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { referencesFromText, referencesToText } from "../../lib/blog/references";

describe("a blog post's sources", () => {
  it("reads 'Title | link' lines, and a bare link", () => {
    assert.deepEqual(referencesFromText("WHO: Depression | https://www.who.int/news-room/fact-sheets/detail/depression\n\nhttps://www.nimh.nih.gov/health/topics/depression\n"), [
      { title: "WHO: Depression", url: "https://www.who.int/news-room/fact-sheets/detail/depression" },
      { title: "nimh.nih.gov", url: "https://www.nimh.nih.gov/health/topics/depression" },
    ]);
  });

  it("keeps only web links, so nothing unsafe is ever linked", () => {
    assert.deepEqual(referencesFromText("Bad | javascript:alert(1)\nAlso bad | data:text/html,x\nFile | file:///etc/passwd\nNo link here\nOK | http://example.org/a"), [{ title: "OK", url: "http://example.org/a" }]);
  });

  it("round-trips through the editor's text box", () => {
    const refs = [{ title: "NHS: Anxiety", url: "https://www.nhs.uk/mental-health/conditions/generalised-anxiety-disorder/" }];
    assert.deepEqual(referencesFromText(referencesToText(refs)), refs);
    assert.equal(referencesToText(undefined), "");
  });
});
