import { flattenQuestions, isInputQuestion } from "./conditions";
import { isScorableType } from "./scoring";
import { isValidEmail, newId, RESERVED_SLUGS, sanitizeText, SLUG_PATTERN } from "./text";
import {
  CONTENT_KINDS,
  FIELD_TYPES,
  RESULT_COMPONENT_LABELS,
  RESULT_COMPONENT_TYPES,
  RULE_OPERATORS,
  SCORE_OPERATORS,
  ZONE_KEYS,
  type AssessmentCategory,
  type AssessmentDefinition,
  type AssessmentMeta,
  type Choice,
  type Condition,
  type ConditionRule,
  type IntroHighlight,
  type ContentRule,
  type FieldType,
  type PlanWeek,
  type Question,
  type ResultComponent,
  type ResultComponentType,
  type ScoreCondition,
  type ScoreSource,
  type Section,
  type Skill,
  type ZoneMapConfig,
} from "./types";

// ---------------------------------------------------------------- defaults

export const DEFAULT_CATEGORIES: AssessmentCategory[] = [
  "Listening Skills",
  "Communication",
  "Emotional Awareness",
  "Self-Reflection",
  "Relationships",
  "Workplace Skills",
  "Personal Growth",
].map((name, index) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  name,
  order: index,
}));

export const ICON_KEYS = [
  "clipboard",
  "ear",
  "message",
  "heart",
  "brain",
  "users",
  "briefcase",
  "sprout",
  "compass",
  "sparkles",
] as const;

export const DEFAULT_DISCLAIMER =
  "This self-check is a tool for self-reflection. It is not a diagnosis, medical advice or a clinical measure, and it does not replace professional support.";

/** Notice shown in the highlighted box before the questions (editable per assessment). */
export const DEFAULT_INTRO_NOTICE = `${DEFAULT_DISCLAIMER} If you are in distress, please contact a healthcare provider or a crisis service.`;

/** Info tiles under the title. Placeholders are filled in when the form is shown. */
export function defaultHighlights(): IntroHighlight[] {
  return [
    { title: "Private", text: "Your results are shown on a private link only you have." },
    { title: "Takes about {{minutes}} minutes", text: "Up to {{questions}} questions to encourage meaningful reflection." },
    { title: "Self-reflection", text: "A starting point for understanding yourself, not a diagnosis." },
  ];
}

export function defaultResultComponents(): ResultComponent[] {
  const enabled: Partial<Record<ResultComponentType, boolean>> = {
    overall_score: true,
    classification: true,
    zone_map: false,
    chart: true,
    skill_breakdown: true,
    progress_bars: false,
    context_comparison: true,
    self_perception: true,
    peer_comparison: true,
    interpretation: true,
    strengths: true,
    growth_areas: true,
    habits: true,
    insights: true,
    misconceptions: true,
    recommendations: true,
    practice_plan: true,
    custom_message: false,
    copy_results: true,
    email_results: true,
  };
  const order: ResultComponentType[] = [
    "overall_score",
    "classification",
    "zone_map",
    "chart",
    "skill_breakdown",
    "progress_bars",
    "context_comparison",
    "self_perception",
    "peer_comparison",
    "interpretation",
    "strengths",
    "growth_areas",
    "habits",
    "insights",
    "misconceptions",
    "recommendations",
    "practice_plan",
    "custom_message",
    "copy_results",
    "email_results",
  ];
  return order.map((type) => ({
    id: `rc_${type}`,
    type,
    enabled: enabled[type] ?? false,
    ...(type === "chart" ? { variant: "radar" as const } : {}),
  }));
}

export function defaultDefinition(): AssessmentDefinition {
  return {
    intro: {
      heading: "Before you begin",
      body: "Answer honestly — there are no right or wrong answers. Your answers are saved as you go on this device, and you can go back to change them.",
      subtitle: "",
      badge: "Confidential & Self-Paced",
      highlights: defaultHighlights(),
      disclaimer: DEFAULT_INTRO_NOTICE,
    },
    navigation: { layout: "sections", allowBack: true, showProgress: true },
    sections: [{ id: newId("s"), title: "Section 1", questions: [] }],
    scoring: {
      enabled: false,
      method: "skills",
      skills: [],
      contexts: [],
      levels: [
        { id: "lvl_low", label: "Early", min: 0, description: "" },
        { id: "lvl_mid", label: "Developing", min: 40, description: "" },
        { id: "lvl_high", label: "Strong", min: 70, description: "" },
      ],
      skillBands: [
        { label: "Emerging", min: 0 },
        { label: "Developing", min: 40 },
        { label: "Strong", min: 70 },
      ],
      strengthsCount: 2,
      growthCount: 2,
      habitsCount: 3,
      contextGapThreshold: 10,
      contentRules: [],
      practicePlan: { enabled: false, title: "Your 30-day practice plan", focusCount: 2, weeks: [] },
    },
    results: { headline: "Your results", disclaimer: DEFAULT_DISCLAIMER, components: defaultResultComponents(), reportDownload: true },
    email: {
      enabled: true,
      subject: "Your {{assessment}} results",
      intro: "Thank you for completing the self-check. Here is a summary of your results.",
      footer: "This summary is for self-reflection and is not a diagnosis or clinical advice.",
      includeLink: true,
      includePlan: true,
      attachReport: true,
      adminNotify: { enabled: false, recipients: [] },
    },
    peer: {
      enabled: false,
      maxResponses: 3,
      intro: "Someone has asked for your honest view. Your answers are combined anonymously and help them see how others experience them.",
      relationships: ["Colleague", "Family member", "Friend", "Manager", "Other"],
    },
    privacy: { adminViewMode: "consented_only" },
  };
}

export function blankMeta(): AssessmentMeta {
  return {
    title: "Untitled assessment",
    slug: "",
    description: "",
    category: DEFAULT_CATEGORIES[3].id,
    icon: "clipboard",
    tier: "free",
    estimatedMinutes: 10,
  };
}

export function newQuestion(type: FieldType): Question {
  const base: Question = { id: newId("q"), type, label: "", required: false };
  switch (type) {
    case "radio":
    case "dropdown":
    case "checkbox":
      return { ...base, choices: [0, 1, 2].map((i) => ({ id: newId("c"), label: `Option ${i + 1}`, points: i })) };
    case "rating5":
      return { ...base, minLabel: "Never", maxLabel: "Always" };
    case "rating_scale":
      return { ...base, min: 1, max: 10, step: 1, minLabel: "Low", maxLabel: "High" };
    case "slider":
      return { ...base, min: 0, max: 100, step: 5, minLabel: "Not at all", maxLabel: "Completely" };
    case "info":
      return { ...base, body: "" };
    case "short_text":
    case "long_text":
    case "email":
    case "number":
    case "date":
    case "yes_no":
    case "peer_feedback":
    default:
      return base;
  }
}

export function newScoring(): NonNullable<Question["scoring"]> {
  return { scored: true, weight: 1, reverse: false };
}

// ------------------------------------------------------------- normalising

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const str = (v: unknown, max: number, fallback = ""): string => (typeof v === "string" ? sanitizeText(v, max) : fallback);
const mstr = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? sanitizeText(v, max, { multiline: true }) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const optNum = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = num(v, NaN, lo, hi);
  return Number.isNaN(n) ? undefined : n;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const idOf = (v: unknown, prefix: string): string => (typeof v === "string" && ID_PATTERN.test(v) ? v : newId(prefix));
const opt = (s: string): string | undefined => (s ? s : undefined);

function normalizeRuleValue(v: unknown): ConditionRule["value"] {
  if (typeof v === "string") return sanitizeText(v, 200);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    return v
      .slice(0, 50)
      .filter((x): x is string | number => typeof x === "string" || (typeof x === "number" && Number.isFinite(x)))
      .map((x) => (typeof x === "string" ? sanitizeText(x, 200) : x));
  }
  return undefined;
}

function normalizeCondition(v: unknown): Condition | undefined {
  const c = obj(v);
  const rules: ConditionRule[] = [];
  for (const raw of arr(c.rules, 20)) {
    const r = obj(raw);
    const questionId = typeof r.questionId === "string" && ID_PATTERN.test(r.questionId) ? r.questionId : "";
    const operator = oneOf(r.operator, RULE_OPERATORS, "equals");
    if (!questionId) continue;
    const value = normalizeRuleValue(r.value);
    rules.push({ questionId, operator, ...(value !== undefined ? { value } : {}) });
  }
  if (rules.length === 0) return undefined;
  return { action: oneOf(c.action, ["show", "hide"] as const, "show"), match: oneOf(c.match, ["all", "any"] as const, "all"), rules };
}

function normalizeChoices(v: unknown): Choice[] {
  return arr(v, 50).map((raw, index) => {
    const c = obj(raw);
    const points = optNum(c.points, -1000, 1000);
    return { id: idOf(c.id, "c"), label: str(c.label, 200) || `Option ${index + 1}`, ...(points !== undefined ? { points } : {}) };
  });
}

function normalizeQuestion(v: unknown): Question {
  const r = obj(v);
  const type = oneOf(r.type, FIELD_TYPES, "short_text");
  const q: Question = {
    id: idOf(r.id, "q"),
    type,
    label: str(r.label, 300),
    required: type === "info" ? false : bool(r.required, false),
  };
  const description = str(r.description, 1000);
  const helpText = str(r.helpText, 500);
  if (description) q.description = description;
  if (helpText) q.helpText = helpText;
  const tag = type === "info" ? "" : str(r.tag, 60);
  if (tag) q.tag = tag;
  const visibility = normalizeCondition(r.visibility);
  if (visibility) q.visibility = visibility;

  if (type === "short_text" || type === "long_text" || type === "email" || type === "number") {
    const placeholder = str(r.placeholder, 200);
    if (placeholder) q.placeholder = placeholder;
  }
  if (type === "short_text" || type === "long_text") {
    const maxLength = optNum(r.maxLength, 1, type === "short_text" ? 1000 : 10000);
    if (maxLength !== undefined) q.maxLength = Math.floor(maxLength);
  }
  if (type === "radio" || type === "dropdown" || type === "checkbox") {
    q.choices = normalizeChoices(r.choices);
  }
  if (type === "checkbox") {
    const min = optNum(r.minSelections, 0, 50);
    const max = optNum(r.maxSelections, 1, 50);
    if (min) q.minSelections = Math.floor(min);
    if (max) q.maxSelections = Math.floor(max);
  }
  if (type === "number") {
    const min = optNum(r.min, -1e9, 1e9);
    const max = optNum(r.max, -1e9, 1e9);
    if (min !== undefined) q.min = min;
    if (max !== undefined) q.max = max;
  }
  if (type === "rating5") {
    q.min = 1;
    q.max = 5;
    q.step = 1;
  }
  if (type === "rating_scale" || type === "slider") {
    q.min = num(r.min, type === "slider" ? 0 : 1, -1000, 1000);
    q.max = num(r.max, type === "slider" ? 100 : 10, -1000, 1000);
    q.step = num(r.step, 1, 0.0001, 1000);
  }
  if (type === "rating5" || type === "rating_scale" || type === "slider") {
    const minLabel = str(r.minLabel, 60);
    const maxLabel = str(r.maxLabel, 60);
    if (minLabel) q.minLabel = minLabel;
    if (maxLabel) q.maxLabel = maxLabel;
  }
  if (type === "info") {
    q.body = mstr(r.body, 5000);
  }

  if (isScorableType(type)) {
    const s = obj(r.scoring);
    if (Object.keys(s).length) {
      q.scoring = {
        scored: bool(s.scored, false),
        weight: num(s.weight, 1, 0, 100),
        reverse: bool(s.reverse, false),
        ...(opt(str(s.skillId, 64)) ? { skillId: str(s.skillId, 64) } : {}),
        ...(opt(str(s.contextId, 64)) ? { contextId: str(s.contextId, 64) } : {}),
        ...(opt(str(s.habit, 120)) ? { habit: str(s.habit, 120) } : {}),
      };
    }
  }

  const peer = obj(r.peer);
  if (type !== "info" && type !== "peer_feedback" && bool(peer.enabled, false)) {
    q.peer = { enabled: true, ...(opt(str(peer.label, 300)) ? { label: str(peer.label, 300) } : {}) };
  }
  return q;
}

function normalizeSections(v: unknown): Section[] {
  return arr(v, 30).map((raw) => {
    const r = obj(raw);
    const section: Section = {
      id: idOf(r.id, "s"),
      title: str(r.title, 200),
      questions: arr(r.questions, 200).map(normalizeQuestion),
    };
    const description = mstr(r.description, 1000);
    if (description) section.description = description;
    const visibility = normalizeCondition(r.visibility);
    if (visibility) section.visibility = visibility;
    return section;
  });
}

function normalizeScoreSource(v: unknown): ScoreSource {
  const s = obj(v);
  const type = oneOf(s.type, ["overall", "skill", "context", "question"] as const, "overall");
  if (type === "overall") return { type };
  return { type, id: str(s.id, 64) };
}

function normalizeScoreCondition(v: unknown): ScoreCondition {
  const c = obj(v);
  const operator = oneOf(c.operator, SCORE_OPERATORS, "lt");
  const cond: ScoreCondition = {
    source: normalizeScoreSource(c.source),
    operator,
    value: num(c.value, 0, 0, 100),
  };
  if (operator === "between") cond.value2 = num(c.value2, 100, 0, 100);
  return cond;
}

function normalizeContentRule(v: unknown): ContentRule {
  const r = obj(v);
  return {
    id: idOf(r.id, "cr"),
    kind: oneOf(r.kind, CONTENT_KINDS, "insight"),
    title: str(r.title, 200),
    text: mstr(r.text, 3000),
    when: arr(r.when, 6).map(normalizeScoreCondition),
  };
}

function normalizeSkill(v: unknown): Skill {
  const r = obj(v);
  const skill: Skill = { id: idOf(r.id, "sk"), name: str(r.name, 80), weight: num(r.weight, 1, 0, 100) };
  const description = str(r.description, 500);
  const strengthText = mstr(r.strengthText, 1000);
  const growthText = mstr(r.growthText, 1000);
  if (description) skill.description = description;
  if (strengthText) skill.strengthText = strengthText;
  if (growthText) skill.growthText = growthText;
  const tips = arr(r.tips, 10).map((t) => str(t, 400)).filter(Boolean);
  if (tips.length) skill.tips = tips;
  const planItems = arr(r.planItems, 12).map((t) => str(t, 500)).filter(Boolean);
  if (planItems.length) skill.planItems = planItems;
  return skill;
}

function normalizePlanWeek(v: unknown): PlanWeek {
  const r = obj(v);
  const week: PlanWeek = {
    id: idOf(r.id, "wk"),
    title: str(r.title, 120),
    days: str(r.days, 40),
    practices: arr(r.practices, 30).map((p) => {
      const pr = obj(p);
      const skillId = str(pr.skillId, 64);
      return { id: idOf(pr.id, "pr"), text: str(pr.text, 500), ...(skillId ? { skillId } : {}) };
    }),
  };
  const goal = str(r.goal, 300);
  if (goal) week.goal = goal;
  return week;
}

function normalizeZoneMap(v: unknown): ZoneMapConfig | undefined {
  const z = obj(v);
  const xSkillId = str(z.xSkillId, 64);
  const ySkillId = str(z.ySkillId, 64);
  if (!xSkillId || !ySkillId) return undefined;
  const zones = obj(z.zones);
  const zone = (key: string) => {
    const d = obj(zones[key]);
    return { label: str(d.label, 60), description: mstr(d.description, 600) };
  };
  const xLabel = str(z.xLabel, 40);
  const yLabel = str(z.yLabel, 40);
  return {
    xSkillId,
    ySkillId,
    threshold: num(z.threshold, 65, 1, 99),
    ...(xLabel ? { xLabel } : {}),
    ...(yLabel ? { yLabel } : {}),
    zones: Object.fromEntries(ZONE_KEYS.map((key) => [key, zone(key)])) as ZoneMapConfig["zones"],
  };
}

function normalizeEmails(v: unknown, max: number): string[] {
  return arr(v, max)
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter((e) => e);
}

/**
 * Turns untrusted admin JSON into a well-formed AssessmentDefinition: unknown keys
 * are dropped, text is sanitised and clamped, ids are generated where missing.
 * Semantic problems (broken references, missing skills…) are reported by
 * validateDefinition() rather than silently fixed here.
 */
export function normalizeDefinition(input: unknown): AssessmentDefinition {
  const base = defaultDefinition();
  const d = obj(input);
  const intro = obj(d.intro);
  const nav = obj(d.navigation);
  const sc = obj(d.scoring);
  const rs = obj(d.results);
  const em = obj(d.email);
  const pe = obj(d.peer);
  const pv = obj(d.privacy);
  const plan = obj(sc.practicePlan);
  const sp = obj(sc.selfPerception);
  const notify = obj(em.adminNotify);

  const sections = normalizeSections(d.sections);
  const components: ResultComponent[] = arr(rs.components, 40)
    .map((raw): ResultComponent | null => {
      const c = obj(raw);
      if (!(RESULT_COMPONENT_TYPES as readonly string[]).includes(c.type as string)) return null;
      const type = c.type as ResultComponentType;
      const component: ResultComponent = { id: idOf(c.id, "rc"), type, enabled: bool(c.enabled, true) };
      const title = str(c.title, 200);
      if (title) component.title = title;
      const text = type === "custom_message" ? mstr(c.text, 3000) : "";
      if (text) component.text = text;
      if (type === "chart") component.variant = oneOf(c.variant, ["radar", "bar"] as const, "radar");
      return component;
    })
    .filter((c): c is ResultComponent => c !== null);

  const zoneMap = normalizeZoneMap(sc.zoneMap);
  const levels = arr(sc.levels, 12)
    .map((raw) => {
      const l = obj(raw);
      return { id: idOf(l.id, "lvl"), label: str(l.label, 60), min: num(l.min, 0, 0, 100), description: mstr(l.description, 1000) };
    })
    .sort((a, b) => a.min - b.min);

  return {
    intro: {
      heading: str(intro.heading, 200, base.intro.heading),
      body: mstr(intro.body, 3000, base.intro.body),
      subtitle: str(intro.subtitle, 160),
      badge: str(intro.badge, 80, base.intro.badge),
      // A missing list means "use the defaults"; an empty list means the admin removed the tiles.
      highlights: Array.isArray(intro.highlights)
        ? arr(intro.highlights, 3)
            .map((raw) => {
              const h = obj(raw);
              return { title: str(h.title, 120), text: str(h.text, 300) };
            })
            .filter((h) => h.title || h.text)
        : base.intro.highlights,
      disclaimer: typeof intro.disclaimer === "string" ? mstr(intro.disclaimer, 1200) : base.intro.disclaimer,
    },
    navigation: {
      layout: oneOf(nav.layout, ["sections", "single_page"] as const, "sections"),
      allowBack: bool(nav.allowBack, true),
      showProgress: bool(nav.showProgress, true),
    },
    sections,
    scoring: {
      enabled: bool(sc.enabled, false),
      method: oneOf(sc.method, ["skills", "questions"] as const, "skills"),
      skills: arr(sc.skills, 20).map(normalizeSkill),
      contexts: arr(sc.contexts, 6).map((raw) => {
        const c = obj(raw);
        return { id: idOf(c.id, "ctx"), name: str(c.name, 60) };
      }),
      // A zone assessment has no levels of its own: the result is a zone, so an empty list stays empty.
      levels: levels.length || zoneMap ? levels : base.scoring.levels,
      skillBands: (() => {
        const bands = arr(sc.skillBands, 8)
          .map((raw) => {
            const b = obj(raw);
            return { label: str(b.label, 40), min: num(b.min, 0, 0, 100) };
          })
          .filter((b) => b.label)
          .sort((a, b) => a.min - b.min);
        return bands.length ? bands : base.scoring.skillBands;
      })(),
      strengthsCount: Math.floor(num(sc.strengthsCount, 2, 0, 10)),
      growthCount: Math.floor(num(sc.growthCount, 2, 0, 10)),
      habitsCount: Math.floor(num(sc.habitsCount, 3, 0, 10)),
      contextGapThreshold: num(sc.contextGapThreshold, 10, 0, 100),
      ...(optNum(sc.displayMax, 1, 1000) !== undefined ? { displayMax: Math.floor(optNum(sc.displayMax, 1, 1000) as number) } : {}),
      ...(str(sp.questionId, 64)
        ? {
            selfPerception: {
              questionId: str(sp.questionId, 64),
              gapThreshold: num(sp.gapThreshold, 15, 0, 100),
              aligned: mstr(sp.aligned, 800),
              over: mstr(sp.over, 800),
              under: mstr(sp.under, 800),
            },
          }
        : {}),
      ...(zoneMap ? { zoneMap } : {}),
      contentRules: arr(sc.contentRules, 60).map(normalizeContentRule),
      practicePlan: {
        enabled: bool(plan.enabled, false),
        title: str(plan.title, 120, base.scoring.practicePlan.title),
        ...(str(plan.intro, 600) ? { intro: str(plan.intro, 600) } : {}),
        focusCount: Math.floor(num(plan.focusCount, 2, 0, 10)),
        weeks: arr(plan.weeks, 8).map(normalizePlanWeek),
        ...(optNum(plan.length, 1, 30) !== undefined ? { length: Math.floor(optNum(plan.length, 1, 30) as number) } : {}),
        ...(str(plan.labelPrefix, 20) ? { labelPrefix: str(plan.labelPrefix, 20) } : {}),
      },
    },
    results: {
      headline: str(rs.headline, 120, base.results.headline),
      ...(str(rs.eyebrow, 80) ? { eyebrow: str(rs.eyebrow, 80) } : {}),
      disclaimer: mstr(rs.disclaimer, 1000, base.results.disclaimer),
      components: components.length ? components : base.results.components,
      reportDownload: bool(rs.reportDownload, true),
    },
    email: {
      enabled: bool(em.enabled, true),
      subject: str(em.subject, 200, base.email.subject) || base.email.subject,
      intro: mstr(em.intro, 1000, base.email.intro),
      footer: mstr(em.footer, 600, base.email.footer),
      includeLink: bool(em.includeLink, true),
      includePlan: bool(em.includePlan, true),
      attachReport: bool(em.attachReport, true),
      adminNotify: { enabled: bool(notify.enabled, false), recipients: normalizeEmails(notify.recipients, 5) },
    },
    peer: {
      enabled: bool(pe.enabled, false),
      maxResponses: Math.floor(num(pe.maxResponses, 3, 1, 10)),
      intro: mstr(pe.intro, 1000, base.peer.intro),
      relationships: (() => {
        const rel = arr(pe.relationships, 12).map((r) => str(r, 40)).filter(Boolean);
        return rel.length ? rel : base.peer.relationships;
      })(),
    },
    privacy: { adminViewMode: oneOf(pv.adminViewMode, ["full", "consented_only", "anonymous", "none"] as const, "consented_only") },
  };
}

/** Thumbnails are uploaded to our own Firebase Storage bucket (or are site paths); anything else is dropped. */
const THUMBNAIL_PATTERN = /^(https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\/|\/(?!\/))[^\s"'<>]{1,500}$/i;

export function normalizeMeta(input: unknown, categories: AssessmentCategory[]): AssessmentMeta {
  const m = obj(input);
  const base = blankMeta();
  const slug = typeof m.slug === "string" ? m.slug.trim().toLowerCase().slice(0, 80) : "";
  const category = typeof m.category === "string" ? m.category : base.category;
  const thumbnail = typeof m.thumbnailUrl === "string" ? m.thumbnailUrl.trim() : "";
  return {
    ...(THUMBNAIL_PATTERN.test(thumbnail) ? { thumbnailUrl: thumbnail } : {}),
    title: str(m.title, 120, base.title),
    slug,
    description: str(m.description, 400),
    category: categories.some((c) => c.id === category) ? category : (categories[0]?.id ?? base.category),
    icon: oneOf(m.icon, ICON_KEYS, "clipboard"),
    tier: oneOf(m.tier, ["free", "premium"] as const, "free"),
    estimatedMinutes: Math.floor(num(m.estimatedMinutes, base.estimatedMinutes, 1, 240)),
  };
}

// --------------------------------------------------------------- validating

export interface Issue {
  path: string;
  message: string;
}

export interface DefinitionReport {
  errors: Issue[];
  warnings: Issue[];
}

const CHOICE_TYPES: FieldType[] = ["radio", "dropdown", "checkbox"];
const NUMERIC_TYPES: FieldType[] = ["rating5", "rating_scale", "slider", "number"];

export function countQuestions(definition: AssessmentDefinition): number {
  return flattenQuestions(definition.sections).filter(isInputQuestion).length;
}

export function validateMeta(meta: AssessmentMeta, categories: AssessmentCategory[], report: DefinitionReport) {
  if (!meta.title.trim()) report.errors.push({ path: "title", message: "Add a title." });
  if (!meta.slug) report.errors.push({ path: "slug", message: "Add a URL slug." });
  else if (!SLUG_PATTERN.test(meta.slug) || meta.slug.length < 3) {
    report.errors.push({ path: "slug", message: "Slug must be at least 3 characters: lowercase letters, numbers and single hyphens." });
  } else if (RESERVED_SLUGS.includes(meta.slug)) {
    report.errors.push({ path: "slug", message: `"${meta.slug}" is reserved. Choose another slug.` });
  }
  if (!meta.description.trim()) report.errors.push({ path: "description", message: "Add a short description for the library card." });
  if (!categories.some((c) => c.id === meta.category)) report.errors.push({ path: "category", message: "Choose a category." });
}

function validateCondition(
  condition: Condition | undefined,
  path: string,
  allowed: Map<string, Question>,
  report: DefinitionReport,
) {
  if (!condition) return;
  condition.rules.forEach((rule, i) => {
    const p = `${path}.rules[${i}]`;
    const target = allowed.get(rule.questionId);
    if (!target) {
      report.errors.push({ path: p, message: "A visibility rule points to a question that doesn't exist or comes later in the form." });
      return;
    }
    if (rule.operator === "answered" || rule.operator === "not_answered") return;
    if (rule.value === undefined || rule.value === "" || (Array.isArray(rule.value) && rule.value.length === 0)) {
      report.errors.push({ path: p, message: "A visibility rule is missing its value." });
      return;
    }
    const values = Array.isArray(rule.value) ? rule.value : [rule.value];
    if (["gt", "gte", "lt", "lte"].includes(rule.operator)) {
      if (!NUMERIC_TYPES.includes(target.type) || values.some((v) => !Number.isFinite(Number(v)))) {
        report.errors.push({ path: p, message: "Comparisons (>, <) need a numeric question and a number." });
      }
      return;
    }
    if (CHOICE_TYPES.includes(target.type)) {
      const ids = new Set(target.choices?.map((c) => c.id));
      if (values.some((v) => !ids.has(String(v)))) {
        report.errors.push({ path: p, message: "A visibility rule uses an answer choice that no longer exists." });
      }
    }
    if ((target.type === "yes_no" || target.type === "peer_feedback") && values.some((v) => v !== "yes" && v !== "no")) {
      report.errors.push({ path: p, message: 'Yes/No rules must use "yes" or "no".' });
    }
  });
}

export function validateDefinition(definition: AssessmentDefinition, meta?: AssessmentMeta, categories: AssessmentCategory[] = DEFAULT_CATEGORIES): DefinitionReport {
  const report: DefinitionReport = { errors: [], warnings: [] };
  const { sections, scoring } = definition;
  if (meta) validateMeta(meta, categories, report);

  if (sections.length === 0) report.errors.push({ path: "sections", message: "Add at least one section." });
  if (countQuestions(definition) === 0) report.errors.push({ path: "sections", message: "Add at least one question." });

  // Unique ids across every section, question and choice.
  // Namespaces: sections and questions share one (rules point at question ids); the rest are separate.
  const seen = new Set<string>();
  const claim = (id: string, path: string, ns = "form") => {
    const key = `${ns}:${id}`;
    if (seen.has(key)) report.errors.push({ path, message: `Duplicate id "${id}".` });
    seen.add(key);
  };

  const skillIds = new Set(scoring.skills.map((s) => s.id));
  const contextIds = new Set(scoring.contexts.map((c) => c.id));
  const earlier = new Map<string, Question>();
  let scoredCount = 0;
  let peerCount = 0;

  sections.forEach((section, si) => {
    const sp = `sections[${si}]`;
    claim(section.id, sp);
    if (!section.title.trim()) report.errors.push({ path: sp, message: `Section ${si + 1} needs a title.` });
    validateCondition(section.visibility, `${sp}.visibility`, earlier, report);

    section.questions.forEach((q, qi) => {
      const qp = `${sp}.questions[${qi}]`;
      claim(q.id, qp);
      if (q.type === "info") {
        if (!q.body?.trim() && !q.label.trim()) report.errors.push({ path: qp, message: "An information block needs a title or text." });
      } else if (!q.label.trim()) {
        report.errors.push({ path: qp, message: `Question ${qi + 1} in "${section.title || `section ${si + 1}`}" needs text.` });
      }

      if (CHOICE_TYPES.includes(q.type)) {
        const choices = q.choices ?? [];
        if (choices.length < 2) report.errors.push({ path: qp, message: `"${q.label || "A choice question"}" needs at least two options.` });
        choices.forEach((c, ci) => {
          claim(c.id, `${qp}.choices[${ci}]`, `choice:${q.id}`);
          if (!c.label.trim()) report.errors.push({ path: `${qp}.choices[${ci}]`, message: "An answer option is empty." });
        });
      }
      if ((q.type === "rating_scale" || q.type === "slider") && !((q.max ?? 0) > (q.min ?? 0))) {
        report.errors.push({ path: qp, message: "The maximum value must be greater than the minimum." });
      }
      if (q.type === "rating_scale" && (q.max ?? 0) - (q.min ?? 0) > 20) {
        report.errors.push({ path: qp, message: "A rating scale can span at most 20 steps; use a slider for wider ranges." });
      }
      if (q.type === "number" && q.min !== undefined && q.max !== undefined && q.max <= q.min) {
        report.errors.push({ path: qp, message: "The maximum value must be greater than the minimum." });
      }

      // A question's rules may only look at questions before it — never itself or later ones.
      validateCondition(q.visibility, `${qp}.visibility`, earlier, report);

      if (q.scoring?.scored) {
        scoredCount += 1;
        const qp2 = `${qp}.scoring`;
        if (scoring.method === "skills" && !q.scoring.skillId) {
          report.errors.push({ path: qp2, message: `"${q.label || "A scored question"}" needs a skill, because overall scores are built from skills.` });
        }
        if (q.scoring.skillId && !skillIds.has(q.scoring.skillId)) {
          report.errors.push({ path: qp2, message: `"${q.label || "A scored question"}" uses a skill that doesn't exist.` });
        }
        if (q.scoring.contextId && !contextIds.has(q.scoring.contextId)) {
          report.errors.push({ path: qp2, message: `"${q.label || "A scored question"}" uses a context that doesn't exist.` });
        }
        if (q.type === "number" && (q.min === undefined || q.max === undefined)) {
          report.errors.push({ path: qp2, message: "A scored number question needs a minimum and maximum." });
        }
        if (CHOICE_TYPES.includes(q.type)) {
          const pts = (q.choices ?? []).map((c, i) => c.points ?? i);
          if (new Set(pts).size < 2) report.errors.push({ path: qp2, message: "Scored choices need at least two different point values." });
        }
      }
      if (q.peer?.enabled) peerCount += 1;
      earlier.set(q.id, q);
    });
  });

  // ---- scoring
  if (scoring.enabled) {
    if (scoring.method === "skills" && scoring.skills.length === 0) {
      report.errors.push({ path: "scoring.skills", message: "Add at least one skill, or switch the overall score to be built from all questions." });
    }
    if (scoredCount === 0) report.errors.push({ path: "scoring", message: "Scoring is on, but no question is marked as scored." });
    const names = new Set<string>();
    scoring.skills.forEach((s, i) => {
      claim(s.id, `scoring.skills[${i}]`, "skill");
      if (!s.name.trim()) report.errors.push({ path: `scoring.skills[${i}]`, message: "A skill needs a name." });
      if (names.has(s.name.toLowerCase())) report.errors.push({ path: `scoring.skills[${i}]`, message: `Two skills are called "${s.name}".` });
      names.add(s.name.toLowerCase());
      if (scoring.method === "skills" && !flattenQuestions(sections).some((q) => q.scoring?.scored && q.scoring.skillId === s.id)) {
        report.warnings.push({ path: `scoring.skills[${i}]`, message: `No scored question is linked to the skill "${s.name}".` });
      }
    });
    scoring.contexts.forEach((c, i) => {
      claim(c.id, `scoring.contexts[${i}]`, "context");
      if (!c.name.trim()) report.errors.push({ path: `scoring.contexts[${i}]`, message: "A context needs a name." });
    });
    if (scoring.levels.length === 0) {
      // A zone assessment shows a zone instead of a level.
      if (!scoring.zoneMap) report.errors.push({ path: "scoring.levels", message: "Add at least one result level." });
    } else {
      if (scoring.levels[0].min !== 0) report.errors.push({ path: "scoring.levels", message: "The lowest level must start at 0." });
      scoring.levels.forEach((l, i) => {
        if (!l.label.trim()) report.errors.push({ path: `scoring.levels[${i}]`, message: "A level needs a label." });
        if (i > 0 && l.min <= scoring.levels[i - 1].min) {
          report.errors.push({ path: `scoring.levels[${i}]`, message: "Level thresholds must increase from one level to the next." });
        }
      });
    }
    if (scoring.selfPerception) {
      const target = earlier.get(scoring.selfPerception.questionId);
      if (!target || !NUMERIC_TYPES.includes(target.type)) {
        report.errors.push({ path: "scoring.selfPerception", message: "The self-rating question must be an existing rating, slider or number question." });
      }
    }
    scoring.contentRules.forEach((rule, i) => {
      claim(rule.id, `scoring.contentRules[${i}]`, "rule");
      if (!rule.title.trim() && !rule.text.trim()) report.errors.push({ path: `scoring.contentRules[${i}]`, message: "A result message is empty." });
      rule.when.forEach((cond) => {
        if (cond.source.type === "skill" && !skillIds.has(cond.source.id)) {
          report.errors.push({ path: `scoring.contentRules[${i}]`, message: `A condition for "${rule.title || "a message"}" uses a skill that doesn't exist.` });
        }
        if (cond.source.type === "question" && !earlier.get(cond.source.id)?.scoring?.scored) {
          report.errors.push({ path: `scoring.contentRules[${i}]`, message: `A condition for "${rule.title || "a message"}" uses a question that is missing or not counted towards the score.` });
        }
        if (cond.source.type === "context" && !contextIds.has(cond.source.id)) {
          report.errors.push({ path: `scoring.contentRules[${i}]`, message: `A condition for "${rule.title || "a message"}" uses a context that doesn't exist.` });
        }
      });
    });
    if (scoring.zoneMap) {
      const zm = scoring.zoneMap;
      if (!skillIds.has(zm.xSkillId) || !skillIds.has(zm.ySkillId)) {
        report.errors.push({ path: "scoring.zoneMap", message: "The zone map plots a skill that doesn't exist. Choose the two skills again." });
      } else if (zm.xSkillId === zm.ySkillId) {
        report.errors.push({ path: "scoring.zoneMap", message: "The zone map needs two different skills, one for each side." });
      }
      if (!(zm.threshold >= 1 && zm.threshold <= 99)) {
        report.errors.push({ path: "scoring.zoneMap", message: "The zone map's “high from” score must be a number from 1 to 99." });
      }
      for (const key of ZONE_KEYS) {
        if (!zm.zones[key].label.trim()) report.errors.push({ path: `scoring.zoneMap.zones.${key}`, message: "Every zone on the map needs a name." });
      }
    }
    if (scoring.practicePlan.enabled && scoring.practicePlan.length && !scoring.skills.some((s) => (s.planItems?.length ?? 0) > 0)) {
      report.errors.push({ path: "scoring.practicePlan", message: "The practice plan has a number of steps, but no skill has plan steps. Add them on each skill, or clear the number to use weeks." });
    }
    scoring.practicePlan.weeks.forEach((w, i) => {
      claim(w.id, `scoring.practicePlan.weeks[${i}]`, "week");
      w.practices.forEach((p, pi) => {
        if (p.skillId && !skillIds.has(p.skillId)) {
          report.errors.push({ path: `scoring.practicePlan.weeks[${i}].practices[${pi}]`, message: "A practice is linked to a skill that doesn't exist." });
        }
      });
    });
  } else if (scoredCount > 0) {
    report.warnings.push({ path: "scoring", message: "Some questions are marked as scored but scoring is switched off." });
  }

  // ---- results, email, peer
  if (!definition.results.components.some((c) => c.enabled)) {
    report.warnings.push({ path: "results", message: "No result sections are enabled, so participants will see an empty results page." });
  }
  if (definition.results.components.some((c) => c.type === "zone_map" && c.enabled) && !scoring.zoneMap) {
    report.warnings.push({ path: "results", message: "The zone map section is on, but no zone map is set up (Results tab), so it will show nothing." });
  }
  definition.results.components.forEach((c, i) => {
    if (c.type === "custom_message" && c.enabled && !c.text?.trim()) {
      report.errors.push({ path: `results.components[${i}]`, message: "The custom message is enabled but empty." });
    }
  });
  if (definition.email.adminNotify.enabled) {
    if (definition.email.adminNotify.recipients.length === 0) {
      report.errors.push({ path: "email.adminNotify", message: "Add at least one recipient for practice notifications." });
    }
    definition.email.adminNotify.recipients.forEach((e) => {
      if (!isValidEmail(e)) report.errors.push({ path: "email.adminNotify", message: `"${e}" is not a valid email address.` });
    });
  }
  if (definition.peer.enabled && peerCount === 0) {
    report.errors.push({ path: "peer", message: "Peer feedback is on, but no question is marked to be asked of the other person." });
  }
  if (Object.keys(definition).length === 0) report.errors.push({ path: "", message: "Empty definition." });

  return report;
}

export function labelForComponent(type: ResultComponentType): string {
  return RESULT_COMPONENT_LABELS[type];
}

// ------------------------------------------------------ public projections

/**
 * Whether participants are asked if the practice may see their results. Needed when
 * notifications are on, and when admins only see people who agreed ("consented_only").
 */
export function sharingOffered(definition: Pick<AssessmentDefinition, "email" | "privacy">): boolean {
  return definition.email.adminNotify.enabled || definition.privacy.adminViewMode === "consented_only";
}

/**
 * What the participant's browser receives: no weights, reverse flags, or result copy.
 * Pass `emailAvailable: false` when the server has no mail credentials: the form then
 * does not offer to email results at all.
 */
export function toPublicForm(definition: AssessmentDefinition, options: { emailAvailable?: boolean } = {}) {
  // When the practice sees everyone's results anyway, there is nothing to ask: the form says so instead.
  const practiceSeesResults = definition.privacy.adminViewMode === "full";
  return {
    intro: definition.intro,
    navigation: definition.navigation,
    peerEnabled: definition.peer.enabled,
    emailEnabled: definition.email.enabled && (options.emailAvailable ?? true),
    practiceSeesResults,
    shareWithPracticeOffered: sharingOffered(definition) && !practiceSeesResults,
    sections: definition.sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      visibility: s.visibility,
      questions: s.questions.map((q) => {
        const { scoring: _scoring, peer: _peer, ...rest } = q;
        void _scoring;
        void _peer;
        return rest;
      }),
    })),
  };
}
export type PublicForm = ReturnType<typeof toPublicForm>;
export type PublicQuestion = PublicForm["sections"][number]["questions"][number];
export type PublicSection = PublicForm["sections"][number];

/** Questions a peer sees: only those flagged for peers that apply to this participant, reworded. */
export function toPeerForm(definition: AssessmentDefinition, applicable: ReadonlySet<string>) {
  const sections: PublicSection[] = [];
  for (const section of definition.sections) {
    const questions = section.questions
      .filter((q) => q.peer?.enabled && applicable.has(q.id))
      .map((q) => {
        const { scoring: _s, peer, visibility: _v, ...rest } = q;
        void _s;
        void _v;
        return { ...rest, label: peer?.label?.trim() || q.label };
      });
    if (questions.length) sections.push({ id: section.id, title: section.title, description: section.description, visibility: undefined, questions });
  }
  return { intro: definition.peer.intro, relationships: definition.peer.relationships, sections };
}
export type PeerForm = ReturnType<typeof toPeerForm>;
