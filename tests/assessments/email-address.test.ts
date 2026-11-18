import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestEmailFix } from "../../lib/assessments/text";

describe("suggesting a fix for a mistyped address", () => {
  it("catches the usual slips in common domains: swapped letters, a missing or extra letter, a wrong ending", () => {
    const cases: Array<[string, string]> = [
      ["asha@gmial.com", "asha@gmail.com"],
      ["asha@gmai.com", "asha@gmail.com"],
      ["asha@gmaill.com", "asha@gmail.com"],
      ["asha@gnail.com", "asha@gmail.com"],
      ["asha@gmail.con", "asha@gmail.com"],
      ["asha@gmail.co", "asha@gmail.com"],
      ["asha@gmail.cm", "asha@gmail.com"],
      ["asha@yahooo.com", "asha@yahoo.com"],
      ["asha@yaho.com", "asha@yahoo.com"],
      ["asha@hotmial.com", "asha@hotmail.com"],
      ["asha@outlok.com", "asha@outlook.com"],
      ["asha@iclod.com", "asha@icloud.com"],
      ["asha@rediffmail.con", "asha@rediffmail.com"],
      ["  Asha.Verma+x@GMIAL.COM ", "asha.verma+x@gmail.com"],
    ];
    for (const [typed, fixed] of cases) assert.equal(suggestEmailFix(typed), fixed, typed);
  });

  it("leaves correct addresses alone, including real providers that look like a common one", () => {
    for (const ok of [
      "asha@gmail.com",
      "asha@yahoo.co.in",
      "asha@yahoo.in",
      "asha@mail.com", // one letter from gmail.com, and a real provider
      "asha@gmx.com",
      "asha@live.in",
      "asha@proton.me",
      "asha@outlook.com",
      "asha@vishvajeetshukla.in",
      "asha@maitriiinfotech.com",
      "asha@chaitanyaraj.com",
      "asha@company.co.uk",
      "asha@university.edu",
    ]) {
      assert.equal(suggestEmailFix(ok), null, ok);
    }
  });

  it("does not guess when two common domains are equally close, or when nothing is close", () => {
    assert.equal(suggestEmailFix("asha@zzzz.com"), null);
    assert.equal(suggestEmailFix("asha@example.org"), null);
  });

  it("copes with things that are not addresses at all", () => {
    for (const odd of ["", " ", "asha", "@gmail.com", "asha@", "asha@@gmial.com x"]) {
      assert.doesNotThrow(() => suggestEmailFix(odd), odd);
    }
    assert.equal(suggestEmailFix(""), null);
    assert.equal(suggestEmailFix("asha@"), null);
    assert.equal(suggestEmailFix("@gmial.com"), null);
  });
});
