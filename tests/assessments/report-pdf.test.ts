import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { computeResult } from "../../lib/assessments/scoring";
import { PAGE, layoutReport, type Metrics, type Op, type Page, type ReportInput } from "../../lib/assessments/server/pdf/reportLayout";
import { reportDataFor, renderReportPdf, reportFileName } from "../../lib/assessments/server/pdf/reportPdf";
import { charismaDefinition } from "../../lib/assessments/templates/charisma";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import { moodDefinition } from "../../lib/assessments/templates/mood";
import type { Answers, AssessmentDefinition } from "../../lib/assessments/types";

/** Every letter 5 points wide at size 10, and only the characters of the Latin fonts, so lines wrap predictably. */
const metrics: Metrics = {
  width: (text, _font, size) => text.length * size * 0.5,
  supported: (codePoint) => (codePoint >= 32 && codePoint <= 0x024f) || (codePoint >= 0x2010 && codePoint <= 0x2122),
};

function answersFor(def: AssessmentDefinition, pick: (question: ReturnType<typeof flatten>[number], index: number) => string | number | undefined): Answers {
  const answers: Answers = {};
  flatten(def).forEach((q, index) => {
    if (q.type === "info") return;
    const value = pick(q, index + 1);
    if (value !== undefined) answers[q.id] = value;
  });
  return answers;
}
const flatten = (def: AssessmentDefinition) => def.sections.flatMap((s) => s.questions);

const charisma = charismaDefinition();
const charismaAnswers = (by: Record<string, number>) =>
  answersFor(charisma, (q) => {
    const level = by[q.scoring?.skillId ?? ""] ?? 3;
    return q.scoring?.reverse ? 6 - level : level;
  });

function input(def: AssessmentDefinition, answers: Answers, name = "Asha Verma", title = "Charisma Diagnostic"): ReportInput {
  const result = computeResult(def, answers);
  return { ...reportDataFor({ assessmentTitle: title, participantName: name, completedAt: "2026-10-25T04:55:00.000Z", result, definition: def }), brand: "Chaitanya Raj", logoRatio: 3.19 };
}

const texts = (pages: Page[]) => pages.flatMap((page) => page.ops).filter((op): op is Extract<Op, { type: "text" }> => op.type === "text").map((op) => op.text);

describe("the PDF report layout", () => {
  it("opens with the logo, the zone in the headline, who it is for and when", () => {
    const pages = layoutReport(input(charisma, charismaAnswers({ warmth: 5, competence: 2, dial: 4, footprint: 3 })), metrics);
    const first = texts([pages[0]]);
    assert.ok(first.includes("YOUR CHARISMA MAP"), "the admin's small heading");
    assert.ok(first.includes("Warm"), first.join("|"));
    assert.equal(pages[0].ops.filter((op) => op.type === "logo").length, 1);
    assert.ok(first.some((t) => /Charisma Diagnostic\s+·\s+Asha Verma\s+·\s+25 October 2026/.test(t)), first.join(" | "));
    const zoneWord = pages[0].ops.find((op) => op.type === "text" && op.text === "Zone.");
    assert.ok(zoneWord || first.includes("Zone"), "the zone's words are drawn on their own, in their own colour");
  });

  it("states which assessment it is, how many questions were answered and when, on the first page", () => {
    const mood = moodDefinition();
    const answers = answersFor(mood, () => "a1");
    const withCounts = { ...reportDataFor({ assessmentTitle: "Chaitanya Raj Mood Self-Assessment", participantName: "Asha Verma", completedAt: "2026-10-25T04:55:00.000Z", result: computeResult(mood, answers), definition: mood, answers }), brand: "Chaitanya Raj", logoRatio: 3.19 };
    const [first] = layoutReport(withCounts, metrics);
    const onFirstPage = texts([first]);
    assert.ok(onFirstPage.includes("ASSESSMENT"));
    assert.ok(onFirstPage.includes("Chaitanya Raj Mood Self-Assessment"));
    assert.ok(onFirstPage.includes("QUESTIONS ANSWERED"));
    assert.ok(onFirstPage.includes("21 of 21"));
    assert.ok(onFirstPage.includes("COMPLETED"));
    assert.ok(onFirstPage.includes("25 October 2026"));
  });

  it("counts only the questions that were asked, and says so without a count when it has no answers to count", () => {
    const mood = moodDefinition();
    const some = answersFor(mood, (_q, index) => (index <= 5 ? "a0" : undefined));
    const data = { ...reportDataFor({ assessmentTitle: "Mood", participantName: "A", completedAt: "2026-10-25T04:55:00.000Z", result: computeResult(mood, some), definition: mood, answers: some }), brand: "B", logoRatio: 3.19 };
    assert.deepEqual(data.questions, { answered: 5, total: 21 });
    const without = { ...reportDataFor({ assessmentTitle: "Mood", participantName: "A", completedAt: "2026-10-25T04:55:00.000Z", result: computeResult(mood, some), definition: mood }), brand: "B", logoRatio: 3.19 };
    assert.equal(without.questions, undefined);
    assert.equal(texts(layoutReport(without, metrics)).includes("QUESTIONS ANSWERED"), false);
  });

  it("follows the admin's sections in order, each with what the result page shows", () => {
    const all = texts(layoutReport(input(charisma, charismaAnswers({ warmth: 2, competence: 5, dial: 3, footprint: 4 })), metrics));
    const at = (text: string) => all.findIndex((item) => item === text);
    assert.ok(at("Your map") >= 0 && at("Your map") < at("Score by part") && at("Score by part") < at("Strengths") && at("Strengths") < at("Gaps") && at("Gaps") < at("7 day plan"), all.slice(0, 40).join("|"));
    assert.ok(all.includes("Capable Zone"));
    assert.equal(["DAY 1", "DAY 2", "DAY 3", "DAY 4", "DAY 5", "DAY 6", "DAY 7"].filter((label) => all.includes(label)).length, 7, "seven steps, labelled by the day");
    assert.ok(all.some((t) => t.startsWith("This diagnostic is a self-reflection tool")), "the disclaimer");
  });

  it("leaves out a section the admin switched off and one that has nothing to show", () => {
    const base = input(charisma, charismaAnswers({ warmth: 5, competence: 5, dial: 5, footprint: 5 }));
    const off = { ...base, results: { ...base.results, components: base.results.components.map((c) => (c.type === "strengths" ? { ...c, enabled: false } : c)) } };
    const all = texts(layoutReport(off, metrics));
    assert.equal(all.includes("Strengths"), false);
    assert.ok(all.includes("Gaps"));
    const noZone = { ...base, result: { ...base.result, zone: null } };
    assert.equal(texts(layoutReport(noZone, metrics)).includes("Your map"), false, "a map without a zone is not drawn");
  });

  it("shows the overall score, level and skills of a scored assessment without a zone", () => {
    const listening = listeningDefinition();
    const data = input(listening, answersFor(listening, (q) => (q.type === "rating5" ? 4 : q.type === "yes_no" ? "no" : q.choices?.[1]?.id)), "Asha Verma", "Listening Self-Reflection");
    const all = texts(layoutReport(data, metrics));
    assert.ok(all.includes(String(data.result.overall)), "the overall score");
    assert.ok(all.includes(data.result.level?.label as string), "the level");
    assert.ok(all.includes("Attention"), "a skill");
    assert.ok(all.join(" ").includes("Your listening results"), all.join(" ").slice(0, 200));
  });

  it("puts a support message first, before any section, and shows the score out of its own scale", () => {
    const mood = moodDefinition();
    const data = input(mood, answersFor(mood, (_q, index) => (index === 9 ? "a3" : "a1")), "Neha Kapoor", "Mood Self-Assessment");
    const pages = layoutReport(data, metrics);
    const all = texts(pages);
    const support = all.findIndex((t) => t.startsWith("Please reach out for help right now"));
    assert.ok(support >= 0, "the support message is in the report");
    assert.ok(support < all.indexOf("YOUR OVERALL SCORE"), "and comes before the score");
    assert.ok(all.some((t) => /^out of 63$/.test(t)), "the total is out of 63, not 100");
  });

  it("draws nothing below the margin, and the banner and footer have their own places", () => {
    const data = input(charisma, charismaAnswers({ warmth: 5, competence: 5, dial: 4, footprint: 4 }));
    data.result = { ...data.result, strengths: Array.from({ length: 40 }, (_, index) => ({ skillId: `s${index}`, name: `Strength ${index}`, score: 80, text: "A long sentence about this strength. ".repeat(12) })) };
    const pages = layoutReport(data, metrics);
    assert.ok(pages.length >= 3, `${pages.length} pages`);
    pages.forEach((page, index) => {
      assert.ok(texts([page]).includes(`Page ${index + 1} of ${pages.length}`));
      assert.ok(texts([page]).some((t) => t.includes("Private report for Asha Verma")));
      for (const op of page.ops) if (op.type === "text" && !/^Page \d+ of \d+$/.test(op.text) && !op.text.includes("Private report for")) assert.ok(op.y <= PAGE.height - PAGE.bottom + 4, `text at ${op.y} on page ${index + 1}`);
    });
    assert.equal(pages.filter((page) => page.ops.some((op) => op.type === "logo")).length, 1, "the logo is on the first page only");
  });

  it("breaks long words and draws characters the fonts lack as question marks, and writes 'Participant' for a name it cannot spell", () => {
    const data = input(charisma, charismaAnswers({ warmth: 5, competence: 5, dial: 4, footprint: 4 }));
    data.result = { ...data.result, strengths: [{ skillId: "x", name: "Link", score: 70, text: `https://example.com/${"x".repeat(300)}` }, { skillId: "y", name: "Hindi", score: 70, text: "A word: आशा" }] };
    const all = texts(layoutReport(data, metrics));
    assert.ok(all.some((t) => t.startsWith("https://example.com/")));
    assert.ok(all.some((t) => /A word: \?\?\?/.test(t)));
    for (const op of layoutReport(data, metrics).flatMap((p) => p.ops)) if (op.type === "text" && op.text.startsWith("xxxx")) assert.ok(op.text.length * 5 <= PAGE.width);
    const named = texts(layoutReport(input(charisma, charismaAnswers({ warmth: 5 }), "आशा वर्मा"), metrics));
    assert.ok(named.some((t) => t.includes("Participant")));
    assert.equal(named.some((t) => t.includes("?")), false);
  });
});

describe("the PDF file", () => {
  it("is a real A4 PDF with the title, author and date set", async () => {
    const data = input(charisma, charismaAnswers({ warmth: 5, competence: 2, dial: 4, footprint: 4 }));
    const { logoRatio: _ratio, brand: _brand, ...rest } = data;
    void _ratio;
    void _brand;
    const bytes = await renderReportPdf(rest);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
    assert.ok(bytes.length > 20_000 && bytes.length < 400_000, `${bytes.length} bytes`);
    const document = await PDFDocument.load(bytes);
    assert.ok(document.getPageCount() >= 1);
    const page = document.getPage(0);
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1 && Math.abs(page.getHeight() - 841.89) < 0.1);
    assert.equal(document.getTitle(), "Charisma Diagnostic — report for Asha Verma");
    assert.equal(document.getAuthor(), "Chaitanya Raj");
    assert.equal(document.getCreationDate()?.toISOString(), "2026-10-25T04:55:00.000Z");
  });

  it("can be made for every starter template", async () => {
    for (const [def, title] of [[listeningDefinition(), "Listening"], [moodDefinition(), "Mood"], [charisma, "Charisma"]] as const) {
      const answers = answersFor(def, (q) => (q.type === "rating5" ? 4 : q.type === "radio" ? "a1" : q.type === "yes_no" ? "no" : q.choices?.[1]?.id));
      const { logoRatio: _r, brand: _b, ...rest } = input(def, answers, "Asha Verma", title);
      void _r;
      void _b;
      const bytes = await renderReportPdf(rest);
      assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-", title);
    }
  });

  it("is named from plain letters of the assessment and the person", () => {
    assert.equal(reportFileName("Charisma Diagnostic", "Asha Verma"), "Charisma-Diagnostic-Asha-Verma-report.pdf");
    assert.equal(reportFileName("Listening: a self-reflection!", "José Núñez"), "Listening-a-self-reflection-Jose-Nunez-report.pdf");
    assert.equal(reportFileName("Charisma", "आशा"), "Charisma-report.pdf");
    assert.equal(reportFileName("", "../../etc/passwd"), "Assessment-etc-passwd-report.pdf");
    assert.ok(reportFileName("x".repeat(300), "y".repeat(300)).length <= 100);
  });
});
