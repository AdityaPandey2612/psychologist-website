import { defaultDefinition } from "../definition";
import type { AssessmentDefinition, AssessmentMeta, Question, ResultComponent, Section, Skill } from "../types";

// The 34 statements of the Stature Group charisma questionnaire ("Stature Assessment Questionnaire"
// Word document), in its four parts. They are statements to rate from 1 ("Not like me") to 5
// ("Very like me"); the ones marked `reverse` are worded the other way round on purpose and are
// scored in reverse.
//
// The document has the statements and the idea of a zone and a plan; it does not word the zones,
// the strengths and gaps of each part, or the plan. Those, the part headings after the first
// three and the 65-point "high" mark are EDITABLE starter wording: read them through before
// publishing. The result is a zone on a warmth / competence map plus a 7 day plan, not an overall
// score or a level, so the template has no levels.

export const CHARISMA_TEMPLATE_ID = "charisma-diagnostic";

interface Part {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  statements: Array<{ text: string; reverse?: boolean }>;
  strength: string;
  gap: string;
  plan: string[];
}

const PARTS: Part[] = [
  {
    key: "warmth",
    label: "Warmth",
    eyebrow: "Warmth · Trust",
    title: "Can people trust you?",
    description: "These statements look at how clearly you show warmth: the signals that tell people you are safe, friendly and on their side.",
    statements: [
      { text: "I smile early when I meet someone, and it is a real smile, not a polite one." },
      { text: "I use people's names and remember small details from last time, like their child's exam or their trip." },
      { text: "When someone is talking, I keep eye contact, nod, and keep my phone away." },
      { text: "I begin meetings with a little human conversation before moving to business." },
      { text: "I share short personal stories, including a mistake or two, to explain my point." },
      { text: "People come to me with their worries without being asked." },
      { text: "I let my feelings show: I laugh, and I say things like \"that must have been hard\"." },
      { text: "I give credit to others openly, in front of the team or the family." },
      { text: "People sometimes describe me as formal, distant or hard to read.", reverse: true },
      { text: "In a new group, I stay quiet and wait for others to approach me.", reverse: true },
    ],
    strength: "Warmth is one of your strongest signals: people can tell you are safe, friendly and on their side.",
    gap: "Warmth is where you have the most to gain: a real smile, names, listening and a human opening help people feel you are on their side.",
    plan: [
      "Open your next three conversations with a real smile and the person's name, and use their name once more before you part.",
      "Before you move to business in your next meeting, spend one minute on something human: ask about their week, then listen to the full answer.",
      "Give credit out loud today: name one person's contribution in front of the team or the family.",
    ],
  },
  {
    key: "competence",
    label: "Competence",
    eyebrow: "Competence · Reliability",
    title: "Can people rely on you?",
    description: "These statements look at how clearly you show competence: the signals that tell people you know your subject and can deliver.",
    statements: [
      { text: "I start with my main point or answer, then give the reasons." },
      { text: "I back up my points with a number, an example or a fact." },
      { text: "I speak at a steady pace and pause before my key points." },
      { text: "I sit and stand upright, and take up space calmly without fidgeting or shrinking." },
      { text: "I prepare for important meetings with an agenda, data and likely questions." },
      { text: "When asked, I give a clear recommendation instead of saying \"whatever you all prefer\"." },
      { text: "I end my sentences firmly. My voice does not rise at the end as if I were asking a question." },
      { text: "I wrap up discussions with a summary, next steps and owners." },
      { text: "I often use hedges like \"just\", \"maybe\" or \"sorry, but\" when I speak.", reverse: true },
      { text: "When people ask what I do, I downplay my achievements and expertise.", reverse: true },
    ],
    strength: "Competence is one of your strongest signals: people can tell you know your subject and can deliver.",
    gap: "Competence is where you have the most to gain: a clear point first, a fact to back it up and a firm close help people see how well you deliver.",
    plan: [
      "Lead with the answer: in your next three messages or meetings, state your main point in the first sentence, then give two reasons.",
      "Bring one number, example or fact for every point you plan to make in your next important meeting.",
      "End your next discussion with a short summary: what was decided, the next steps and who owns each. Leave out \"just\" and \"sorry, but\" in that conversation.",
    ],
  },
  {
    key: "dial",
    label: "The dial",
    eyebrow: "The dial · Flexibility",
    title: "Can you adjust to the room?",
    description:
      "The most charismatic people move flexibly inside the Charisma Zone. These statements check whether you turn your warmth and competence up or down for the person in front of you.",
    statements: [
      { text: "Before an important meeting, I think about whether the other person values connection or efficiency." },
      { text: "With a fact driven senior person, I skip the chitchat, bring numbers and keep to the agenda." },
      { text: "With someone who values rapport, I take time to connect before getting to business." },
      { text: "In pitches, interviews and negotiations, I deliberately raise my competence cues: structure, a steady voice, firm eye contact." },
      { text: "When I need trust and teamwork, I deliberately raise my warmth cues: listening, questions, a real smile." },
      { text: "After a meeting, I reflect on how I came across, not only on what I said." },
      { text: "I behave the same way with everyone, whether it is my boss, a client or my family.", reverse: true },
      { text: "When someone and I do not click, I assume the problem is with them.", reverse: true },
    ],
    strength: "You adjust well to the room: you turn your warmth and competence up or down for the person in front of you.",
    gap: "The dial is where you have the most to gain: turning your warmth and competence up or down for the person in front of you is what keeps you inside the Charisma Zone.",
    plan: [
      "Before your next important meeting, write down whether the other person values connection or efficiency, and plan your first two minutes for them.",
      "After one meeting, note how you came across, not only what you said, and choose one signal to turn up next time.",
      "Pick one person you do not click with. Assume part of the gap may be yours and ask one question to learn how they see it.",
    ],
  },
  {
    // The questionnaire lists these statements after the dial; their heading is a draft to edit.
    key: "footprint",
    label: "Your footprint",
    eyebrow: "Your footprint · Presence",
    title: "What do you leave behind?",
    description: "These statements look at the signals you leave when you are not in the room: your profile, messages, documents and workspace.",
    statements: [
      { text: "My LinkedIn profile has a friendly photo and clear proof of my work: roles, numbers and results." },
      { text: "My voice notes and calls sound warm and clear: I greet the person, speak slowly and state my purpose." },
      { text: "My emails and messages open with a human greeting, make a clear point and end with a next step." },
      { text: "My slides and documents are well structured and easy to read, with a human touch such as a story or a face." },
      { text: "My office or workspace looks organised and also has a personal touch." },
      { text: "On video calls, I look at the camera, keep good lighting and sit upright." },
    ],
    strength: "Your footprint backs you up: your profile, messages, documents and workspace say what you say in person.",
    gap: "Your footprint is where you have the most to gain: your profile, messages, documents or workspace could show more of your warmth and competence.",
    plan: [
      "Update your LinkedIn profile: a friendly, well-lit photo and one line that shows your role, a number and a result.",
      "Re-open your last three emails or messages and fix one: add a human greeting, a clear point and a next step.",
      "On your next video call, look at the camera, check your lighting and sit upright.",
    ],
  },
];

const DISCLAIMER = "This diagnostic is a self-reflection tool for professional development. It is not a medical or psychological diagnosis.";

export const CHARISMA_META: AssessmentMeta = {
  title: "Charisma Diagnostic",
  slug: "charisma-diagnostic",
  description: "See how much warmth and competence you are showing right now, with your map, strengths, gaps and a 7 day plan.",
  category: "workplace-skills",
  icon: "sparkles",
  tier: "free",
  estimatedMinutes: 8,
};

export function charismaDefinition(): AssessmentDefinition {
  const base = defaultDefinition();

  const sections: Section[] = PARTS.map((part) => ({
    id: `sec_${part.key}`,
    title: part.title,
    description: part.description,
    questions: part.statements.map(
      (statement, index): Question => ({
        id: `q_${part.key}_${index + 1}`,
        type: "rating5",
        label: statement.text,
        tag: part.eyebrow,
        required: true,
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Not like me",
        maxLabel: "Very like me",
        scoring: { scored: true, skillId: part.key, weight: 1, reverse: Boolean(statement.reverse) },
      }),
    ),
  }));

  const skills: Skill[] = PARTS.map((part) => ({
    id: part.key,
    name: part.label,
    weight: 1,
    strengthText: part.strength,
    growthText: part.gap,
    planItems: part.plan,
  }));

  const components: ResultComponent[] = [
    { id: "rc_zone", type: "zone_map", enabled: true, title: "Your map" },
    { id: "rc_parts", type: "skill_breakdown", enabled: true, title: "Score by part" },
    { id: "rc_strengths", type: "strengths", enabled: true, title: "Strengths" },
    { id: "rc_gaps", type: "growth_areas", enabled: true, title: "Gaps" },
    { id: "rc_plan", type: "practice_plan", enabled: true, title: "7 day plan" },
    { id: "rc_copy", type: "copy_results", enabled: true },
    { id: "rc_email", type: "email_results", enabled: true },
  ];

  return {
    ...base,
    intro: {
      heading: "Before you begin",
      body: "Rate each statement from 1 (Not like me) to 5 (Very like me). Answer for how you act today, not how you would like to act. There are no right or wrong answers, and your answers are saved on this device as you go.",
      subtitle: "Where do people place you?",
      badge: "Confidential & Self-Paced",
      highlights: [
        { title: "{{questions}} statements", text: "About {{minutes}} minutes" },
        { title: "{{sections}} parts", text: "Warmth, competence, the dial and your footprint" },
        { title: "A zone and a plan", text: "Your map, strengths, gaps and a 7 day plan" },
      ],
      disclaimer: `${DISCLAIMER} Your responses are used to calculate and display this result.`,
    },
    navigation: { layout: "sections", allowBack: true, showProgress: true },
    sections,
    scoring: {
      ...base.scoring,
      enabled: true,
      method: "skills",
      skills,
      contexts: [],
      // The result is a zone on the map, not a level.
      levels: [],
      strengthsCount: 2,
      growthCount: 2,
      habitsCount: 0,
      // Competence along the bottom, warmth up the side; "high" starts at 65 of 100 (about 3.6 on the 1–5 scale).
      zoneMap: {
        xSkillId: "competence",
        ySkillId: "warmth",
        threshold: 65,
        zones: {
          topRight: {
            label: "Charisma Zone",
            description:
              "People read you as both warm and capable: they feel safe with you and trust you to deliver. The work now is to stay flexible, turning each signal up or down for the person in front of you.",
          },
          topLeft: {
            label: "Warm Zone",
            description:
              "People like you and feel at ease with you, but may not yet see you as the one who decides or delivers. Competence cues (a clear point first, facts, a firm close) are your fastest gain.",
          },
          bottomRight: {
            label: "Capable Zone",
            description: "People respect your expertise, but may keep their distance. Warmth cues (a real smile, names, listening, a human opening) will help them trust you faster.",
          },
          bottomLeft: {
            label: "Building Zone",
            description: "Neither signal comes through strongly yet. That is a starting point, not a verdict: both are habits you can build, starting with the plan below.",
          },
        },
      },
      practicePlan: { enabled: true, title: "Your 7 day plan", focusCount: 2, weeks: [], length: 7, labelPrefix: "Day" },
    },
    results: {
      headline: "You are in the {zone}.",
      eyebrow: "Your charisma map",
      disclaimer: DISCLAIMER,
      components,
      reportDownload: true,
    },
    email: {
      ...base.email,
      subject: "Your Charisma Diagnostic result",
      intro: "Thank you for completing the Charisma Diagnostic. Here is your zone, with your strengths, gaps and a 7 day plan.",
      includePlan: true,
    },
    peer: { ...base.peer, enabled: false },
  };
}
