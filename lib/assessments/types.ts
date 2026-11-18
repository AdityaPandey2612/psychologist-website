// Shared (browser + server) types for the dynamic assessment system.
//
// An assessment is described entirely by data: an `AssessmentDefinition` made of
// sections, questions, structured visibility rules, a scoring configuration and a
// results configuration. Nothing in here is executable — rules are plain JSON that
// the engines in conditions.ts and scoring.ts interpret.

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "number",
  "date",
  "radio",
  "dropdown",
  "checkbox",
  "rating5",
  "rating_scale",
  "slider",
  "yes_no",
  "peer_feedback",
  "info",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  date: "Date",
  radio: "Single choice (radio)",
  dropdown: "Dropdown",
  checkbox: "Multiple choice (checkbox)",
  rating5: "Rating 1–5",
  rating_scale: "Rating scale (custom range)",
  slider: "Slider",
  yes_no: "Yes / No",
  peer_feedback: "Invite peer feedback (optional)",
  info: "Information text block",
};

/** Answer types as stored: text/choice ids/dates are strings, yes_no is "yes" | "no". */
export type AnswerValue = string | number | boolean | string[];
export type Answers = Record<string, AnswerValue>;

// ---------------------------------------------------------------- conditions

export const RULE_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "answered",
  "not_answered",
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export type RuleValue = string | number | boolean | Array<string | number>;

export interface ConditionRule {
  questionId: string;
  operator: RuleOperator;
  value?: RuleValue;
}

/** Show or hide a section/question depending on earlier answers. */
export interface Condition {
  action: "show" | "hide";
  match: "all" | "any";
  rules: ConditionRule[];
}

// ----------------------------------------------------------------- questions

export interface Choice {
  id: string;
  label: string;
  /** Points used when the question is scored (defaults to the choice's position). */
  points?: number;
}

export interface QuestionScoring {
  scored: boolean;
  skillId?: string;
  contextId?: string;
  weight: number;
  reverse: boolean;
  /** Short label for the "strongest / growth habits" lists (defaults to the question text). */
  habit?: string;
}

export interface Question {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  helpText?: string;
  /** Small category label above the question, e.g. "Sadness & Mood" (defaults to the section title on one-page forms). */
  tag?: string;
  required: boolean;
  placeholder?: string;
  choices?: Choice[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  maxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  /** Body text for `info` blocks (plain text; blank lines separate paragraphs). */
  body?: string;
  visibility?: Condition;
  scoring?: QuestionScoring;
  /** When enabled the question is also asked to a peer, worded from their point of view. */
  peer?: { enabled: boolean; label?: string };
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  visibility?: Condition;
  questions: Question[];
}

// ------------------------------------------------------------------- scoring

export interface Skill {
  id: string;
  name: string;
  description?: string;
  weight: number;
  strengthText?: string;
  growthText?: string;
  tips?: string[];
  /**
   * Steps for a numbered practice plan (see PracticePlanConfig.length): the plan takes one step at a
   * time from each skill's list, lowest-scoring skill first.
   */
  planItems?: string[];
}

export interface Context {
  id: string;
  name: string;
}

/** A level starts at `min` and runs up to the next level's `min` (the last runs to 100). */
export interface Level {
  id: string;
  label: string;
  min: number;
  description: string;
}

export interface SkillBand {
  label: string;
  min: number;
}

/** What a result message looks at: the overall score, a skill, a context, or one scored question (0–100 after reverse scoring). */
export type ScoreSource =
  | { type: "overall" }
  | { type: "skill"; id: string }
  | { type: "context"; id: string }
  | { type: "question"; id: string };

export const SCORE_OPERATORS = ["lt", "lte", "gt", "gte", "between"] as const;
export type ScoreOperator = (typeof SCORE_OPERATORS)[number];

export interface ScoreCondition {
  source: ScoreSource;
  operator: ScoreOperator;
  value: number;
  /** Upper bound for `between` (inclusive). */
  value2?: number;
}

export const CONTENT_KINDS = ["insight", "misconception", "recommendation", "message", "support"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** A block of result copy that appears when every `when` condition holds. */
export interface ContentRule {
  id: string;
  kind: ContentKind;
  title: string;
  text: string;
  when: ScoreCondition[];
}

export interface SelfPerceptionConfig {
  /** An unscored numeric question where the participant rates themselves. */
  questionId: string;
  /** Points (0–100) the self-rating may differ from the answer-based score before it is flagged. */
  gapThreshold: number;
  aligned: string;
  over: string;
  under: string;
}

export interface PlanPractice {
  id: string;
  /** When set, the practice only appears if this skill is one of the participant's growth areas. */
  skillId?: string;
  text: string;
}

export interface PlanWeek {
  id: string;
  title: string;
  days: string;
  goal?: string;
  practices: PlanPractice[];
}

export interface PracticePlanConfig {
  enabled: boolean;
  title: string;
  intro?: string;
  /** How many of the lowest-scoring skills personalise the plan. */
  focusCount: number;
  weeks: PlanWeek[];
  /**
   * When set (for example 7), the plan is that many numbered steps taken from the skills' `planItems`
   * instead of the weeks above: one step at a time from each skill, the lowest-scoring skill first.
   */
  length?: number;
  /** The word before each numbered step ("Day" gives "Day 1", "Day 2"…). Defaults to "Step". */
  labelPrefix?: string;
}

export const ZONE_KEYS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
export type ZoneKey = (typeof ZONE_KEYS)[number];

export interface ZoneDefinition {
  label: string;
  description: string;
}

/**
 * Places the participant in one of four zones from two skills: a skill score from `threshold` up is
 * "high" on that axis. The x skill runs along the bottom and the y skill up the side.
 */
export interface ZoneMapConfig {
  xSkillId: string;
  ySkillId: string;
  /** 1–99; a skill score from here up counts as high. */
  threshold: number;
  xLabel?: string;
  yLabel?: string;
  zones: Record<ZoneKey, ZoneDefinition>;
}

export interface ScoringConfig {
  enabled: boolean;
  /** `skills`: weighted mean of skill scores. `questions`: weighted mean of every scored answer. */
  method: "skills" | "questions";
  skills: Skill[];
  contexts: Context[];
  levels: Level[];
  skillBands: SkillBand[];
  strengthsCount: number;
  growthCount: number;
  habitsCount: number;
  /** Context scores further apart than this (points) trigger a comparison message. */
  contextGapThreshold: number;
  /**
   * Show the overall score out of this number (e.g. 63 for a 21-item 0–3 inventory) instead of out of 100.
   * Thresholds and conditions keep using the 0–100 scale.
   */
  displayMax?: number;
  selfPerception?: SelfPerceptionConfig;
  /** Places the participant on a two-skill map; shown by a "zone_map" result component. */
  zoneMap?: ZoneMapConfig;
  contentRules: ContentRule[];
  practicePlan: PracticePlanConfig;
}

// ------------------------------------------------------------------- results

export const RESULT_COMPONENT_TYPES = [
  "overall_score",
  "classification",
  "zone_map",
  "skill_breakdown",
  "progress_bars",
  "chart",
  "context_comparison",
  "peer_comparison",
  "self_perception",
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
] as const;
export type ResultComponentType = (typeof RESULT_COMPONENT_TYPES)[number];

export const RESULT_COMPONENT_LABELS: Record<ResultComponentType, string> = {
  overall_score: "Overall score",
  classification: "Score classification",
  zone_map: "Zone map",
  skill_breakdown: "Skill breakdown",
  progress_bars: "Progress bars",
  chart: "Chart",
  context_comparison: "Work vs home comparison",
  peer_comparison: "Self vs others comparison",
  self_perception: "Self-perception vs answers",
  interpretation: "Personalised interpretation",
  strengths: "Strengths",
  growth_areas: "Growth areas",
  habits: "Strongest and weakest habits",
  insights: "Insights",
  misconceptions: "Common misconceptions",
  recommendations: "Recommendations",
  practice_plan: "30-day practice plan",
  custom_message: "Custom message",
  copy_results: "Copy results button",
  email_results: "Email results",
};

export interface ResultComponent {
  id: string;
  type: ResultComponentType;
  enabled: boolean;
  title?: string;
  /** Body for `custom_message`. */
  text?: string;
  /** Chart style for `chart`. */
  variant?: "radar" | "bar";
}

export interface ResultsConfig {
  /** Headline of the result page. `{name}` (first name) and `{zone}` are filled in; the zone is set in italics. */
  headline: string;
  /** Small label above the headline; the assessment title when empty. */
  eyebrow?: string;
  disclaimer: string;
  components: ResultComponent[];
  /** Offer a "Download PDF report" button on the result page. On unless set to false. */
  reportDownload?: boolean;
}

// -------------------------------------------------------- email / peer / misc

export interface EmailConfig {
  enabled: boolean;
  subject: string;
  intro: string;
  footer: string;
  includeLink: boolean;
  includePlan: boolean;
  /** Attach the PDF report to the result email. On unless set to false. */
  attachReport?: boolean;
  /** Notify the practice of a completed assessment. Only ever sent with the participant's consent. */
  adminNotify: { enabled: boolean; recipients: string[] };
}

export interface PeerConfig {
  enabled: boolean;
  maxResponses: number;
  intro: string;
  relationships: string[];
}

export type AdminViewMode = "full" | "consented_only" | "anonymous" | "none";

export interface PrivacyConfig {
  /**
   * full: names, emails and answers visible to admins.
   * consented_only: identity + answers only for people who agreed to share with the practice.
   * anonymous: scores only. none: no per-submission listing (aggregate analytics only).
   */
  adminViewMode: AdminViewMode;
}

export interface NavigationConfig {
  layout: "sections" | "single_page";
  allowBack: boolean;
  showProgress: boolean;
}

export interface IntroHighlight {
  title: string;
  text: string;
}

export interface IntroConfig {
  heading: string;
  body: string;
  /** Line under the title, e.g. "Understanding Your Emotional Wellbeing". */
  subtitle: string;
  /** Short note shown as a pill under the subtitle, e.g. "Confidential & Self-Paced". */
  badge: string;
  /**
   * Up to three info tiles. `{{minutes}}`, `{{questions}}` and `{{sections}}` are
   * filled in when the form is shown.
   */
  highlights: IntroHighlight[];
  /** Notice shown in a highlighted box before the questions. Leave empty to hide it. */
  disclaimer: string;
}

export interface AssessmentDefinition {
  intro: IntroConfig;
  navigation: NavigationConfig;
  sections: Section[];
  scoring: ScoringConfig;
  results: ResultsConfig;
  email: EmailConfig;
  peer: PeerConfig;
  privacy: PrivacyConfig;
}

export type Tier = "free" | "premium";
export type AssessmentStatus = "draft" | "published" | "archived";

export interface AssessmentMeta {
  title: string;
  slug: string;
  description: string;
  /** Category id (see AssessmentCategory). */
  category: string;
  icon: string;
  tier: Tier;
  estimatedMinutes: number;
  /** Picture for the library card, uploaded in the builder (Firebase Storage address). */
  thumbnailUrl?: string;
}

export interface AssessmentCategory {
  id: string;
  name: string;
  description?: string;
  order: number;
}

/** The compact card shown in the public library; denormalised at publish time. */
export interface PublicSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  icon: string;
  tier: Tier;
  estimatedMinutes: number;
  thumbnailUrl?: string;
  questionCount: number;
  sectionCount: number;
  version: number;
  publishedAt: string;
}

/** Working copy edited in the admin dashboard. */
export interface AssessmentDoc extends AssessmentMeta {
  id: string;
  status: AssessmentStatus;
  /** Latest published version number (0 = never published). */
  version: number;
  /** Bumped on every draft save; compared with `publishedRevision` to flag unpublished changes. */
  draftRevision: number;
  publishedRevision: number;
  definition: AssessmentDefinition;
  published?: PublicSummary;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  publishedAt?: string;
}

/** Immutable snapshot of an assessment at the moment it was published. */
export interface AssessmentVersionDoc {
  id: string;
  assessmentId: string;
  version: number;
  meta: AssessmentMeta & { categoryName: string };
  definition: AssessmentDefinition;
  publishedAt: string;
  publishedBy?: string;
}

// ------------------------------------------------------------ calculated data

export interface SkillResult {
  id: string;
  name: string;
  description?: string;
  /** 0–100, or null when no answered question maps to the skill. */
  score: number | null;
  band?: string;
  answered: number;
  total: number;
}

export interface ContextResult {
  id: string;
  name: string;
  score: number | null;
  /** Per-skill scores within this context. */
  skills: Array<{ id: string; name: string; score: number | null }>;
}

export interface HabitResult {
  questionId: string;
  label: string;
  /** 0–100 after reverse scoring. */
  score: number;
  skillId?: string;
}

export interface ContentResult {
  id: string;
  kind: ContentKind;
  title: string;
  text: string;
}

export interface SelfPerceptionResult {
  selfScore: number;
  computedScore: number;
  gap: number;
  status: "aligned" | "over" | "under";
  message: string;
}

export interface PlanWeekResult {
  id: string;
  title: string;
  days: string;
  goal?: string;
  practices: Array<{ id: string; text: string; skillName?: string }>;
}

/** Where the participant sits on the zone map (see ZoneMapConfig). */
export interface ResultZone {
  key: ZoneKey;
  label: string;
  description: string;
  /** The two skill scores, 0–100. */
  x: number;
  y: number;
  xLabel: string;
  yLabel: string;
  threshold: number;
}

export interface AssessmentResult {
  scored: boolean;
  overall: number | null;
  /** The participant's zone, when the assessment has a zone map (results stored earlier have none). */
  zone?: ResultZone | null;
  /** The overall score on the assessment's own scale, when it has one (e.g. 14 out of 63). */
  display?: { score: number; max: number };
  level: { id: string; label: string; description: string } | null;
  skills: SkillResult[];
  contexts: ContextResult[];
  contextComparison: { higherId: string; lowerId: string; diff: number; message: string } | null;
  strengths: Array<{ skillId: string; name: string; score: number; text: string }>;
  growth: Array<{ skillId: string; name: string; score: number; text: string; tips: string[] }>;
  strongestHabits: HabitResult[];
  growthHabits: HabitResult[];
  selfPerception: SelfPerceptionResult | null;
  content: ContentResult[];
  /** `steps`: numbered steps ("Day 1"…) from a plan with a length, one practice each, no week dates. */
  practicePlan: { title: string; intro?: string; weeks: PlanWeekResult[]; steps?: boolean } | null;
  /** How many questions were scored / left out (hidden or unanswered optional). */
  stats: { scoredQuestions: number; skippedOptional: number };
  computedAt: string;
}

export interface PeerComparison {
  responses: number;
  overall: { self: number; peer: number } | null;
  skills: Array<{ id: string; name: string; self: number; peer: number; diff: number }>;
}

// ------------------------------------------------------------- submission data

export type EmailStatus = "not_requested" | "pending" | "sent" | "failed" | "not_configured";

export interface SubmissionEmailState {
  status: EmailStatus;
  attempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  messageId?: string;
  error?: string;
}

export interface SubmissionDoc {
  id: string;
  assessmentId: string;
  versionId: string;
  version: number;
  respondent: { name: string; email: string };
  consent: { storeResponses: boolean; emailResults: boolean; shareWithPractice: boolean; at: string };
  answers: Answers;
  result: AssessmentResult;
  /** Secret URL token for the participant's result page. Never returned by admin APIs. */
  accessToken: string;
  peer: { enabled: boolean; token: string; maxResponses: number; responseCount: number };
  email: SubmissionEmailState;
  createdAt: string;
}

export interface PeerResponseDoc {
  id: string;
  submissionId: string;
  assessmentId: string;
  versionId: string;
  relationship: string;
  answers: Answers;
  consentAt: string;
  createdAt: string;
}

export interface EmailRecordDoc {
  id: string;
  submissionId: string;
  assessmentId: string;
  kind: "result" | "admin_notification";
  to: string;
  subject: string;
  status: "sending" | "sent" | "failed";
  attempts: number;
  messageId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
