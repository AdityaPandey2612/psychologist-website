import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDefinition, normalizeDefinition, toPublicForm } from "../../lib/assessments/definition";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import { fillTokens } from "../../lib/assessments/text";
import { miniDefinition } from "./helpers";

describe("form branding (intro tiles, notice, category labels)", () => {
  it("fills {{minutes}}, {{questions}} and {{sections}} and leaves unknown names empty", () => {
    assert.equal(
      fillTokens("About {{minutes}} min, {{questions}} questions, {{ sections }} sections{{nope}}", { minutes: 12, questions: 26, sections: 9 }),
      "About 12 min, 26 questions, 9 sections",
    );
  });

  it("gives new assessments honest default tiles and a notice, and the starter a subtitle", () => {
    const def = defaultDefinition();
    assert.equal(def.intro.highlights.length, 3);
    assert.match(JSON.stringify(def.intro.highlights), /\{\{minutes\}\}/);
    // Answers are stored on the server, so the default tiles must not claim otherwise.
    assert.doesNotMatch(JSON.stringify(def.intro.highlights), /nothing is (saved|stored)|locally in your browser/i);
    assert.match(def.intro.disclaimer, /not a diagnosis/i);
    assert.ok(listeningDefinition().intro.subtitle.length > 0);
  });

  it("keeps an admin's empty tile list but fills in defaults when the field is absent", () => {
    const withoutField = normalizeDefinition({ ...miniDefinition(), intro: { heading: "Hi", body: "There" } });
    assert.equal(withoutField.intro.highlights.length, 3);
    const cleared = normalizeDefinition({ ...miniDefinition(), intro: { heading: "Hi", body: "There", highlights: [] } });
    assert.deepEqual(cleared.intro.highlights, []);
  });

  it("sanitises tiles, subtitle, badge and notice, and caps the tiles at three", () => {
    const def = normalizeDefinition({
      ...miniDefinition(),
      intro: {
        heading: "H",
        body: "B",
        subtitle: "<b>Sub</b> title",
        badge: "Private",
        disclaimer: "<script>x</script>Please note",
        highlights: [1, 2, 3, 4].map((n) => ({ title: `<i>T${n}</i>`, text: `text ${n}`, extra: true })),
      },
    });
    assert.equal(def.intro.subtitle, "Sub title");
    assert.equal(def.intro.disclaimer, "xPlease note");
    assert.equal(def.intro.highlights.length, 3);
    assert.deepEqual(def.intro.highlights[0], { title: "T1", text: "text 1" });
  });

  it("keeps a question's category label and passes it to participants", () => {
    const def = miniDefinition();
    def.sections[0].questions[0].tag = "Sadness & Mood";
    const normalized = normalizeDefinition(def);
    assert.equal(normalized.sections[0].questions[0].tag, "Sadness & Mood");
    const form = toPublicForm(normalized);
    assert.equal(form.sections[0].questions[0].tag, "Sadness & Mood");
    assert.equal(form.intro.highlights.length, 3);
  });
});
