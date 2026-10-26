import { headlineParts, planStepPrefix, resultEyebrow } from "../../presentation";
import { MAP_SIZE, PLOT, zoneMapLayout } from "../../zoneMapLayout";
import type { AssessmentResult, ContentKind, ResultComponent, ResultsConfig, ZoneKey, ZoneMapConfig } from "../../types";

/**
 * The participant's PDF report, as drawing instructions. This module only decides what goes where
 * (it is pure and has no PDF library in it); reportPdf.ts turns the instructions into a file. Page
 * space is in points, y growing downwards, and a text's y is its baseline.
 *
 * The report holds what the result page holds, in the order the admin set up (the result
 * components), on a light page so it prints well: the practice logo on white, a dark teal band with
 * the headline, then the sections.
 */

export const PAGE = { width: 595.28, height: 841.89, margin: 46, top: 46, bottom: 58 };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const LOGO_HEIGHT = 44;
const BAND_TOP = 104;
const HEADER_HEIGHT = 232;

export const COLORS = {
  band: "#123a36",
  bandMuted: "#a9c4bd",
  gold: "#f0b860",
  white: "#ffffff",
  ink: "#16302e",
  muted: "#4c6864",
  primary: "#1f5c56",
  accent: "#ab471e",
  line: "#d5e2dd",
  track: "#dceae4",
  tint: "#f8e4bd",
  frame: "#9fbdb5",
  supportBg: "#fbeee5",
};

export type FontKey = "display" | "sans" | "sansBold";

export type Op =
  | { type: "rect"; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; dash?: [number, number] }
  | { type: "circle"; x: number; y: number; radius: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { type: "text"; x: number; y: number; text: string; font: FontKey; size: number; color: string; rotate?: 90 }
  | { type: "logo"; x: number; y: number; width: number; height: number };

export interface Page {
  ops: Op[];
}

/** What the layout needs to know about the fonts: how wide text is, and which characters they have. */
export interface Metrics {
  width(text: string, font: FontKey, size: number): number;
  supported(codePoint: number): boolean;
}

export interface ReportInput {
  assessmentTitle: string;
  participantName: string;
  completedAt: string;
  result: AssessmentResult;
  results: ResultsConfig;
  /** The zone map's settings (the four zone names), when the assessment has one. */
  zoneMap?: Pick<ZoneMapConfig, "zones"> | null;
  /** The practice's name, for the footer. */
  brand: string;
  /** The logo's proportions (width / height). */
  logoRatio: number;
}

interface Run {
  text: string;
  font: FontKey;
  color: string;
}
interface Word {
  text: string;
  font: FontKey;
  color: string;
  glued: boolean;
}

class Flow {
  readonly pages: Page[] = [];
  y = 0;

  constructor(private readonly metrics: Metrics) {}

  get page() {
    return this.pages[this.pages.length - 1];
  }
  op(op: Op) {
    this.page.ops.push(op);
  }
  newPage(top = PAGE.top) {
    this.pages.push({ ops: [] });
    this.y = top;
  }
  /** Starts a new page unless `height` more fits on this one. */
  ensure(height: number) {
    if (this.y + height > PAGE.height - PAGE.bottom) this.newPage();
  }

  width(text: string, font: FontKey, size: number) {
    return this.metrics.width(text, font, size);
  }

  /** Characters the fonts do not have (another script, an emoji) become "?" rather than empty boxes. */
  clean(text: string) {
    return Array.from(String(text ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u2029\uFEFF]/g, ""))
      .map((character) => (character === "\n" || character === "\t" || this.metrics.supported(character.codePointAt(0) as number) ? character : "?"))
      .join("");
  }

  wrap(text: string, font: FontKey, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of this.clean(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.width(candidate, font, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        let rest = word;
        // A word longer than a whole line (a long address) is cut into pieces.
        while (this.width(rest, font, size) > width && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && this.width(rest.slice(0, cut), font, size) > width) cut -= 1;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }

  /** A text at x, with its baseline at y; `anchor` says whether x is its left end, middle or right end. */
  text(text: string, x: number, y: number, font: FontKey, size: number, color: string, anchor: "start" | "middle" | "end" = "start", rotate?: 90) {
    const shown = this.clean(text);
    if (!shown) return;
    const width = this.width(shown, font, size);
    const offset = anchor === "end" ? width : anchor === "middle" ? width / 2 : 0;
    // Turned text reads upwards, so its start is below the point it is centred on.
    this.op(rotate ? { type: "text", x, y: y + offset, text: shown, font, size, color, rotate } : { type: "text", x: x - offset, y, text: shown, font, size, color });
  }

  /** Lines of text with the first line's top at `top`; the height they take is returned. */
  lines(lines: string[], x: number, top: number, font: FontKey, size: number, color: string, lineHeight = size * 1.45) {
    lines.forEach((line, index) => this.text(line, x, top + size + index * lineHeight - size * 0.15, font, size, color));
    return lines.length * lineHeight;
  }

  /** A paragraph at the cursor, continuing on the next page when it has to. */
  paragraph(text: string, font: FontKey, size: number, color: string, width = CONTENT_WIDTH, x = PAGE.margin, lineHeight = size * 1.5) {
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lineHeight);
      this.text(line, x, this.y + size, font, size, color);
      this.y += lineHeight;
    }
  }

  /** Words that keep the font and colour of the run they came from; a run that follows another without a space is glued to it. */
  words(runs: Run[]): Word[] {
    const words: Word[] = [];
    let glueNext = false;
    for (const run of runs) {
      const text = this.clean(run.text);
      const parts = text.split(/\s+/);
      parts.forEach((part, index) => {
        if (!part) return;
        const startsWithSpace = index === 0 && /^\s/.test(text);
        words.push({ text: part, font: run.font, color: run.color, glued: index === 0 && !startsWithSpace && glueNext && words.length > 0 });
      });
      glueNext = !/\s$/.test(text);
    }
    return words;
  }

  /** Lays words out in lines of at most `width`; each line is a list of words with their x offsets. */
  wrapWords(words: Word[], size: number, width: number) {
    const lines: Array<Array<Word & { x: number }>> = [];
    let line: Array<Word & { x: number }> = [];
    let x = 0;
    for (const word of words) {
      const space = line.length && !word.glued ? this.width(" ", line[line.length - 1].font, size) : 0;
      const wordWidth = this.width(word.text, word.font, size);
      if (line.length && x + space + wordWidth > width && !word.glued) {
        lines.push(line);
        line = [];
        x = 0;
        line.push({ ...word, x: 0 });
        x = wordWidth;
        continue;
      }
      line.push({ ...word, x: x + space });
      x += space + wordWidth;
    }
    if (line.length) lines.push(line);
    return lines;
  }
}

const dateLabel = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
};

const contentOf = (result: AssessmentResult, kinds: ContentKind[]) => result.content.filter((item) => kinds.includes(item.kind));

/** The report's pages: a banner with the headline, then one section for each result component. */
export function layoutReport(input: ReportInput, metrics: Metrics): Page[] {
  const flow = new Flow(metrics);
  const { result, results } = input;
  // A name in a script the fonts do not have would print as question marks; say "Participant" instead.
  const cleanedName = flow.clean(input.participantName).trim();
  const participant = !cleanedName || (cleanedName.match(/\?/g) || []).length > cleanedName.length / 2 ? "Participant" : cleanedName;
  const firstName = participant === "Participant" ? undefined : participant.split(/\s+/)[0];

  // --- the logo on white, then the banner: small heading, headline with the zone picked out, who and when
  flow.newPage(0);
  const logoWidth = LOGO_HEIGHT * input.logoRatio;
  flow.op({ type: "logo", x: PAGE.margin, y: 30, width: logoWidth, height: LOGO_HEIGHT });
  flow.op({ type: "rect", x: 0, y: BAND_TOP, width: PAGE.width, height: HEADER_HEIGHT - BAND_TOP, fill: COLORS.band });
  const eyebrow = resultEyebrow(results, input.assessmentTitle);
  flow.text(eyebrow.toUpperCase(), PAGE.margin, BAND_TOP + 38, "sansBold", 8.5, COLORS.gold);
  const headlineSize = 27;
  const parts = headlineParts(results.headline, firstName, result.zone?.label);
  const headline = flow.wrapWords(
    flow.words(parts.map((part) => ({ text: part.text, font: "display" as const, color: part.emphasis ? COLORS.gold : COLORS.white }))),
    headlineSize,
    CONTENT_WIDTH,
  );
  headline.slice(0, 2).forEach((line, index) => {
    for (const word of line) flow.text(word.text, PAGE.margin + word.x, BAND_TOP + 68 + index * 31, word.font, headlineSize, word.color);
  });
  const meta = [eyebrow === input.assessmentTitle ? "" : input.assessmentTitle, participant, dateLabel(input.completedAt)].filter(Boolean).join("  ·  ");
  flow.text(meta, PAGE.margin, HEADER_HEIGHT - 20, "sans", 9.5, COLORS.bandMuted);
  flow.y = HEADER_HEIGHT + 30;

  // --- building blocks
  const section = (title: string, bodyHeight = 40) => {
    flow.ensure(40 + bodyHeight);
    flow.text(title, PAGE.margin, flow.y + 15, "display", 17, COLORS.ink);
    flow.op({ type: "line", x1: PAGE.margin, y1: flow.y + 23, x2: PAGE.width - PAGE.margin, y2: flow.y + 23, stroke: COLORS.line, width: 0.8 });
    flow.y += 36;
  };
  const label = (text: string) => flow.text(text.toUpperCase(), PAGE.margin, flow.y + 11, "sansBold", 8.5, COLORS.accent);
  const gap = (height = 22) => {
    flow.y += height;
  };
  const bars = (items: Array<{ label: string; score: number; note?: string }>) => {
    for (const item of items) {
      flow.ensure(30);
      flow.text(item.label, PAGE.margin, flow.y + 10, "sansBold", 10.5, COLORS.ink);
      if (item.note) flow.text(item.note, PAGE.margin + flow.width(flow.clean(item.label), "sansBold", 10.5) + 8, flow.y + 10, "sans", 9.5, COLORS.muted);
      flow.text(`${item.score}/100`, PAGE.width - PAGE.margin, flow.y + 10, "sansBold", 10.5, COLORS.ink, "end");
      flow.op({ type: "rect", x: PAGE.margin, y: flow.y + 16, width: CONTENT_WIDTH, height: 6, fill: COLORS.track });
      const filled = (CONTENT_WIDTH * Math.max(0, Math.min(100, item.score))) / 100;
      if (filled >= 1) flow.op({ type: "rect", x: PAGE.margin, y: flow.y + 16, width: filled, height: 6, fill: COLORS.primary });
      flow.y += 31;
    }
  };
  const bullets = (items: string[], x = PAGE.margin, size = 11) => {
    for (const item of items) {
      const lines = flow.wrap(item, "sans", size, CONTENT_WIDTH - (x - PAGE.margin) - 16);
      flow.ensure(lines.length * (size + 5) + 8);
      flow.text("•", x + 2, flow.y + size, "sansBold", size, COLORS.accent);
      flow.lines(lines, x + 16, flow.y, "sans", size, COLORS.ink, size + 5);
      flow.y += lines.length * (size + 5) + 8;
    }
  };
  /** A name and its score on one line, then the wording under it (strengths and growth areas). */
  const scored = (name: string, score: number, text: string, tips: string[] = []) => {
    const lines = flow.wrap(text, "sans", 10.5, CONTENT_WIDTH);
    flow.ensure(24 + lines.length * 15 + 8);
    flow.text(name, PAGE.margin, flow.y + 13, "display", 13.5, COLORS.ink);
    flow.text(String(score), PAGE.width - PAGE.margin, flow.y + 13, "sansBold", 11, COLORS.primary, "end");
    flow.y += 20;
    flow.y += flow.lines(lines, PAGE.margin, flow.y, "sans", 10.5, COLORS.muted, 15) + 4;
    bullets(tips, PAGE.margin + 4, 10.5);
    flow.y += 6;
  };
  const messages = (items: Array<{ title: string; text: string }>) => {
    for (const item of items) {
      const lines = flow.wrap(item.text, "sans", 10.5, CONTENT_WIDTH - 14);
      flow.ensure((item.title ? 22 : 0) + lines.length * 15 + 12);
      const top = flow.y;
      if (item.title) {
        flow.text(item.title, PAGE.margin + 14, flow.y + 13, "display", 13, COLORS.ink);
        flow.y += 20;
      }
      flow.y += flow.lines(lines, PAGE.margin + 14, flow.y, "sans", 10.5, COLORS.ink, 15) + 6;
      flow.op({ type: "line", x1: PAGE.margin + 3, y1: top + 1, x2: PAGE.margin + 3, y2: flow.y - 8, stroke: COLORS.line, width: 2.5 });
    }
  };

  // Support messages (for example crisis contacts) come first, before anything else.
  for (const item of contentOf(result, ["support"])) {
    const lines = flow.wrap(item.text, "sans", 10.5, CONTENT_WIDTH - 28);
    const height = (item.title ? 24 : 0) + lines.length * 15 + 24;
    flow.ensure(height + 10);
    flow.op({ type: "rect", x: PAGE.margin, y: flow.y, width: CONTENT_WIDTH, height, fill: COLORS.supportBg });
    flow.op({ type: "rect", x: PAGE.margin, y: flow.y, width: 3.5, height, fill: COLORS.accent });
    let top = flow.y + 12;
    if (item.title) {
      flow.text(item.title, PAGE.margin + 16, top + 13, "display", 14, COLORS.ink);
      top += 24;
    }
    flow.lines(lines, PAGE.margin + 16, top, "sans", 10.5, COLORS.ink, 15);
    flow.y += height + 16;
  }

  const zoneMap = (title: string) => {
    const zone = result.zone;
    if (!zone) return;
    const size = 270;
    section(title, size);
    flow.ensure(size + 6);
    const x0 = PAGE.margin;
    const y0 = flow.y;
    const k = size / MAP_SIZE;
    const X = (value: number) => x0 + value * k;
    const Y = (value: number) => y0 + value * k;
    const map = zoneMapLayout(zone, input.zoneMap || null);
    for (const key of Object.keys(map.quadrants) as ZoneKey[]) {
      const box = map.quadrants[key];
      if (key === zone.key) flow.op({ type: "rect", x: X(box.x), y: Y(box.y), width: box.width * k, height: box.height * k, fill: COLORS.tint });
    }
    flow.op({ type: "rect", x: X(PLOT.left), y: Y(PLOT.top), width: PLOT.size * k, height: PLOT.size * k, stroke: COLORS.frame, strokeWidth: 0.9 });
    flow.op({ type: "line", x1: X(map.split.x), y1: Y(PLOT.top), x2: X(map.split.x), y2: Y(map.bottom), stroke: COLORS.frame, width: 0.7, dash: [3, 3] });
    flow.op({ type: "line", x1: X(PLOT.left), y1: Y(map.split.y), x2: X(map.right), y2: Y(map.split.y), stroke: COLORS.frame, width: 0.7, dash: [3, 3] });
    for (const name of map.names) {
      flow.text(name.text.toUpperCase(), X(name.x), Y(name.y), "sansBold", 11 * k, name.key === zone.key ? COLORS.accent : COLORS.muted, name.anchor);
    }
    flow.op({ type: "circle", x: X(map.dot.x), y: Y(map.dot.y), radius: 15 * k, stroke: COLORS.primary, strokeWidth: 0.9, opacity: 0.5 });
    flow.op({ type: "circle", x: X(map.dot.x), y: Y(map.dot.y), radius: 7 * k, fill: COLORS.primary });
    flow.text("You", X(map.you.x), Y(map.you.y), "display", 16 * k, COLORS.ink, map.you.anchor);
    flow.text("0", X(PLOT.left - 8), Y(map.bottom + 4), "sans", 11 * k, COLORS.muted, "end");
    flow.text("100", X(PLOT.left - 8), Y(PLOT.top + 4), "sans", 11 * k, COLORS.muted, "end");
    flow.text("100", X(map.right), Y(map.bottom + 18), "sans", 11 * k, COLORS.muted, "end");
    flow.text(zone.xLabel, X(PLOT.left + PLOT.size / 2), Y(MAP_SIZE - 8), "sans", 13 * k, COLORS.muted, "middle");
    flow.text(zone.yLabel, X(16) + 13 * k * 0.35, Y(PLOT.top + PLOT.size / 2), "sans", 13 * k, COLORS.muted, "middle", 90);

    // the words beside the map
    const textX = x0 + size + 24;
    const textWidth = PAGE.width - PAGE.margin - textX;
    flow.text("YOUR ZONE", textX, y0 + 14, "sansBold", 8.5, COLORS.accent);
    const zoneLines = flow.wrap(zone.label, "display", 22, textWidth);
    let textY = y0 + 24;
    textY += flow.lines(zoneLines, textX, textY, "display", 22, COLORS.ink, 26) + 4;
    if (zone.description) textY += flow.lines(flow.wrap(zone.description, "sans", 10.5, textWidth), textX, textY, "sans", 10.5, COLORS.muted, 15.5) + 10;
    const stats = [
      [zone.yLabel, zone.y],
      [zone.xLabel, zone.x],
    ] as const;
    stats.forEach(([name, value], index) => {
      const left = textX + index * (textWidth / 2);
      flow.op({ type: "line", x1: left, y1: textY, x2: left + textWidth / 2 - 12, y2: textY, stroke: COLORS.gold, width: 2 });
      flow.text(name, left, textY + 16, "sans", 9.5, COLORS.muted);
      flow.text(String(value), left, textY + 40, "display", 24, COLORS.ink);
    });
    flow.y = Math.max(y0 + size, textY + 50) + 6;
  };

  const plan = () => {
    const practicePlan = result.practicePlan;
    if (!practicePlan) return;
    if (practicePlan.intro) {
      flow.paragraph(practicePlan.intro, "sans", 10.5, COLORS.muted);
      gap(8);
    }
    if (practicePlan.steps) {
      // Numbered steps ("Day 1" …): the word and the step on one row each.
      const textX = PAGE.margin + 62;
      practicePlan.weeks.forEach((step, index) => {
        const lines = flow.wrap(step.practices[0]?.text ?? "", "sans", 11, PAGE.width - PAGE.margin - textX);
        const height = Math.max(lines.length * 16, 18) + 16;
        flow.ensure(height);
        if (index > 0) flow.op({ type: "line", x1: PAGE.margin, y1: flow.y, x2: PAGE.width - PAGE.margin, y2: flow.y, stroke: COLORS.line, width: 0.6 });
        flow.text((step.title || `${planStepPrefix(undefined)} ${index + 1}`).toUpperCase(), PAGE.margin, flow.y + 21, "sansBold", 8.5, COLORS.primary);
        flow.lines(lines, textX, flow.y + 8, "sans", 11, COLORS.ink, 16);
        flow.y += height;
      });
      return;
    }
    for (const week of practicePlan.weeks) {
      flow.ensure(46);
      flow.text(week.title, PAGE.margin, flow.y + 12, "sansBold", 11.5, COLORS.primary);
      if (week.days) flow.text(week.days, PAGE.margin + flow.width(flow.clean(week.title), "sansBold", 11.5) + 8, flow.y + 12, "sans", 9.5, COLORS.muted);
      flow.y += 20;
      if (week.goal) {
        flow.paragraph(week.goal, "sans", 10, COLORS.muted);
        gap(2);
      }
      bullets(week.practices.map((p) => p.text), PAGE.margin, 10.5);
      gap(4);
    }
  };

  // --- one section for each result component that has something to show
  const enabled = results.components.filter((item) => item.enabled);
  const drawsSkillBars = enabled.some((item) => item.type === "skill_breakdown" || item.type === "progress_bars");
  const skills = result.skills.filter((item) => item.score !== null);
  const titleOf = (component: ResultComponent, fallback: string) => flow.clean(component.title?.trim() || fallback);

  for (const component of enabled) {
    const before = flow.pages.length;
    const startedAt = flow.y;
    switch (component.type) {
      case "overall_score": {
        if (!result.scored || result.overall === null || result.zone) break;
        const shown = result.display ? result.display.score : result.overall;
        const outOf = result.display ? result.display.max : 100;
        flow.ensure(96);
        label(titleOf(component, "Your overall score"));
        flow.text(String(shown), PAGE.margin, flow.y + 55, "display", 46, COLORS.ink);
        const numberWidth = flow.width(String(shown), "display", 46);
        flow.text(`out of ${outOf}`, PAGE.margin + numberWidth + 8, flow.y + 55, "sans", 12, COLORS.muted);
        if (result.level) flow.text(result.level.label, PAGE.width - PAGE.margin, flow.y + 55, "sansBold", 13, COLORS.primary, "end");
        flow.y += 70;
        flow.paragraph(
          `Calculated from ${result.stats.scoredQuestions} answer${result.stats.scoredQuestions === 1 ? "" : "s"}${result.stats.skippedOptional > 0 ? `; ${result.stats.skippedOptional} skipped question${result.stats.skippedOptional === 1 ? " was" : "s were"} left out, not counted as zero` : ""}.`,
          "sans",
          9.5,
          COLORS.muted,
        );
        break;
      }
      case "classification": {
        if (!result.level) break;
        flow.ensure(70);
        label(titleOf(component, "Where you are right now"));
        flow.text(result.level.label, PAGE.margin, flow.y + 38, "display", 22, COLORS.ink);
        flow.y += 48;
        if (result.level.description) flow.paragraph(result.level.description, "sans", 11, COLORS.muted);
        break;
      }
      case "zone_map":
        zoneMap(titleOf(component, "Your map"));
        break;
      case "skill_breakdown":
      case "progress_bars":
      case "chart": {
        if (!skills.length) break;
        // The chart is a picture of the same numbers: draw the bars for it only when nothing else does.
        if (component.type === "chart" && drawsSkillBars) break;
        section(titleOf(component, component.type === "progress_bars" ? "Skill scores" : "Your skills"), 40);
        bars(skills.map((s) => ({ label: s.name, score: s.score as number, note: s.band })));
        break;
      }
      case "context_comparison": {
        const contexts = result.contexts.filter((item) => item.score !== null);
        if (contexts.length < 2) break;
        section(titleOf(component, contexts.map((item) => item.name).join(" vs ")), 40);
        bars(contexts.map((c) => ({ label: c.name, score: c.score as number })));
        if (result.contextComparison) flow.paragraph(result.contextComparison.message, "sans", 10.5, COLORS.muted);
        break;
      }
      case "self_perception": {
        if (!result.selfPerception) break;
        section(titleOf(component, "How you see yourself"), 60);
        bars([
          { label: "Your own rating", score: result.selfPerception.selfScore },
          { label: "What your answers show", score: result.selfPerception.computedScore },
        ]);
        flow.paragraph(result.selfPerception.message, "sans", 10.5, COLORS.muted);
        break;
      }
      case "interpretation": {
        if (!result.level || result.overall === null) break;
        section(titleOf(component, "What this means"), 60);
        flow.paragraph(result.level.description, "sans", 11, COLORS.ink);
        const top = result.strengths[0];
        const low = result.growth[0];
        if (top || low) {
          gap(6);
          flow.paragraph(
            [top ? `Your highest-scoring area is ${top.name} (${top.score}).` : "", low ? `The area with the most room to grow is ${low.name} (${low.score}).` : ""].filter(Boolean).join(" "),
            "sans",
            11,
            COLORS.ink,
          );
        }
        gap(6);
        flow.paragraph("This is a snapshot of how you answered today, not a fixed trait. It will change as your habits do.", "sans", 9.5, COLORS.muted);
        break;
      }
      case "strengths":
        if (!result.strengths.length) break;
        section(titleOf(component, "Your strengths"), 60);
        for (const item of result.strengths) scored(item.name, item.score, item.text);
        break;
      case "growth_areas":
        if (!result.growth.length) break;
        section(titleOf(component, "Where you could grow"), 60);
        for (const item of result.growth) scored(item.name, item.score, item.text, item.tips);
        break;
      case "habits": {
        if (!result.strongestHabits.length && !result.growthHabits.length) break;
        section(titleOf(component, "Your habits in detail"), 60);
        if (result.strongestHabits.length) {
          flow.ensure(40);
          flow.text("What you do well", PAGE.margin, flow.y + 12, "display", 13, COLORS.ink);
          flow.y += 22;
          bars(result.strongestHabits.map((h) => ({ label: h.label, score: h.score })));
        }
        if (result.growthHabits.length) {
          flow.ensure(40);
          flow.text("Habits to work on", PAGE.margin, flow.y + 12, "display", 13, COLORS.ink);
          flow.y += 22;
          bars(result.growthHabits.map((h) => ({ label: h.label, score: h.score })));
        }
        break;
      }
      case "insights":
      case "misconceptions":
      case "recommendations": {
        const kinds: ContentKind[] = component.type === "insights" ? ["insight"] : component.type === "misconceptions" ? ["misconception"] : ["recommendation", "message"];
        const items = contentOf(result, kinds);
        if (!items.length) break;
        section(titleOf(component, component.type === "insights" ? "Insights" : component.type === "misconceptions" ? "Common misconceptions" : "Recommendations"), 60);
        messages(items);
        break;
      }
      case "practice_plan":
        if (!result.practicePlan) break;
        section(titleOf(component, result.practicePlan.title), 60);
        plan();
        break;
      case "custom_message":
        if (!component.text?.trim()) break;
        if (component.title?.trim()) section(titleOf(component, ""), 40);
        flow.paragraph(component.text, "sans", 11, COLORS.ink);
        break;
      default:
        break; // copy-to-clipboard, email status and the peer comparison belong to the page
    }
    if (flow.pages.length !== before || flow.y !== startedAt) gap(20);
  }

  // --- the disclaimer, then a footer on every page
  const disclaimer = flow.clean(results.disclaimer || "This report is for self-reflection and is not a diagnosis.");
  const lines = flow.wrap(disclaimer, "sans", 8.5, CONTENT_WIDTH);
  flow.ensure(lines.length * 12 + 16);
  flow.op({ type: "line", x1: PAGE.margin, y1: flow.y, x2: PAGE.width - PAGE.margin, y2: flow.y, stroke: COLORS.line, width: 0.6 });
  flow.lines(lines, PAGE.margin, flow.y + 8, "sans", 8.5, COLORS.muted, 12);

  flow.pages.forEach((page, index) => {
    const footerY = PAGE.height - 30;
    page.ops.push({ type: "line", x1: PAGE.margin, y1: footerY - 12, x2: PAGE.width - PAGE.margin, y2: footerY - 12, stroke: COLORS.line, width: 0.6 });
    const left = flow.clean(`${input.brand}  ·  Private report for ${participant}`);
    const right = `Page ${index + 1} of ${flow.pages.length}`;
    page.ops.push({ type: "text", x: PAGE.margin, y: footerY, text: left, font: "sans", size: 8, color: COLORS.muted });
    page.ops.push({ type: "text", x: PAGE.width - PAGE.margin - flow.width(right, "sans", 8), y: footerY, text: right, font: "sans", size: 8, color: COLORS.muted });
  });
  return flow.pages;
}
