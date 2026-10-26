import { site } from "../../data/site";
import { defaultDefinition, defaultResultComponents } from "../definition";
import type { AssessmentDefinition, AssessmentMeta, ContentRule, Level, Question, ResultComponentType } from "../types";

// Chaitanya Raj Mood Self-Assessment — built from the practice's own Word document
// ("Chaitanya_Raj_Mood_Self-Assessment.docx": 21 items, four statements each, in
// increasing order of severity).
//
// What came from the document: the title, subtitle, introduction, the clinical
// disclaimer, and all 21 items with their category labels, headings, prompts and
// answer statements (one obvious typo, "as as much", was corrected).
//
// What the document did NOT contain, and was added here as EDITABLE starter settings:
//  * scoring: each statement scores 0–3 by its position and the total is out of 63;
//  * score ranges: the commonly published BDI-II ranges (0–13, 14–19, 20–28, 29–63);
//  * support messages for the self-harm item (item 9) and level-based suggestions.
// Please confirm the scoring and ranges against the manual you are licensed to use
// (the items follow the Beck Depression Inventory-II) before publishing. The wording
// avoids diagnostic labels: results speak of "ranges of low-mood symptoms".
//
// The document's first tile said answers are "processed locally in your browser" and
// "not saved or stored". That is not how this platform works (answers are sent to the
// server to calculate results), so the tile was reworded to what is true.

export const MOOD_TEMPLATE_ID = "mood-self-assessment";
export const MOOD_SELF_HARM_QUESTION_ID = "q_mood_09";

interface Item {
  tag: string;
  title: string;
  prompt: string;
  options: string[];
}

const ITEMS: Item[] = [
  {
    tag: "Sadness & Mood",
    title: "Overall Mood & Sadness",
    prompt: "Which statement best describes how you have been feeling over the past 2 weeks?",
    options: [
      "I do not feel sad or down overall.",
      "I feel sad or low much of the time.",
      "I am sad all the time and I can't seem to snap out of it.",
      "I am so sad or unhappy that I can hardly stand it.",
    ],
  },
  {
    tag: "Future Outlook",
    title: "Feeling About the Future",
    prompt: "How do you feel when you look ahead at your future?",
    options: [
      "I am not particularly discouraged about my future.",
      "I feel more discouraged about the future than I used to be.",
      "I feel I have nothing to look forward to.",
      "I feel the future is hopeless and that things will only get worse.",
    ],
  },
  {
    tag: "Sense Of Accomplishment",
    title: "Past Experiences & Failure",
    prompt: "Reflecting on your past and life achievements:",
    options: [
      "I do not feel like a failure.",
      "I feel I have failed more than the average person.",
      "As I look back on my life, all I see is a lot of failures.",
      "I feel I am a total failure as a person.",
    ],
  },
  {
    tag: "Capacity For Joy",
    title: "Ability to Enjoy Things",
    prompt: "How much pleasure do you get out of activities you usually like?",
    options: [
      "I get as much pleasure as I always did from things I enjoy.",
      "I don't enjoy things as much as I used to.",
      "I get very little pleasure from the things I used to enjoy.",
      "I can't get any pleasure from the things I used to enjoy.",
    ],
  },
  {
    tag: "Guilt Feelings",
    title: "Feelings of Guilt",
    prompt: "How often or deeply do you experience guilt?",
    options: [
      "I don't feel particularly guilty or at fault.",
      "I feel guilty over many things I have done or should have done.",
      "I feel quite guilty most of the time.",
      "I feel guilty all of the time.",
    ],
  },
  {
    tag: "Self-Punishment",
    title: "Feelings of Being Punished",
    prompt: "Do you feel like you deserve bad outcomes?",
    options: [
      "I don't feel I am being punished.",
      "I feel I may be punished for something.",
      "I expect to be punished.",
      "I feel I am being punished.",
    ],
  },
  {
    tag: "Self-Acceptance",
    title: "Feelings About Yourself",
    prompt: "How do you view yourself currently?",
    options: [
      "I feel the same about myself as ever.",
      "I have lost confidence in myself.",
      "I am disappointed in myself.",
      "I dislike or strongly hate myself.",
    ],
  },
  {
    tag: "Self-Criticism",
    title: "Self-Critical Attitudes",
    prompt: "How do you handle your own mistakes or shortcomings?",
    options: [
      "I don't criticize or blame myself more than usual.",
      "I am more critical of myself than I used to be.",
      "I criticize myself for all of my faults.",
      "I blame myself for everything bad that happens.",
    ],
  },
  {
    tag: "Thoughts About Life",
    title: "Thoughts About Life & Self-Harm",
    prompt: "Please answer honestly regarding any thoughts of harming yourself:",
    options: [
      "I don't have any thoughts of harming myself.",
      "I have thoughts of harming myself, but I would not carry them out.",
      "I would like to end my life or hurt myself.",
      "I would end my life if I had the chance.",
    ],
  },
  {
    tag: "Emotional Expression",
    title: "Crying & Emotional Release",
    prompt: "Have you noticed changes in your crying patterns?",
    options: [
      "I don't cry any more than I used to.",
      "I cry more now than I used to.",
      "I cry over every little thing.",
      "I feel like crying, but I simply can't.",
    ],
  },
  {
    tag: "Agitation & Restlessness",
    title: "Restlessness or Agitation",
    prompt: "How physically or mentally restless do you feel?",
    options: [
      "I am no more restless or agitated than usual.",
      "I feel more restless or wound up than usual.",
      "I am so restless that it's hard to stay still.",
      "I am so agitated that I have to keep moving or pacing.",
    ],
  },
  {
    tag: "Social Engagement",
    title: "Interest in People & Activities",
    prompt: "How connected do you feel to friends, family, or social life?",
    options: [
      "I haven't lost interest in other people or activities.",
      "I am less interested in other people or things than I used to be.",
      "I have lost most of my interest in other people or things.",
      "It's hard to get interested in anything or anyone.",
    ],
  },
  {
    tag: "Decision Making",
    title: "Making Decisions",
    prompt: "How easy or hard is it for you to make decisions right now?",
    options: [
      "I make decisions about as well as I ever could.",
      "I find it harder to make decisions than usual.",
      "I have much greater difficulty in making decisions than before.",
      "I have trouble making any decisions at all.",
    ],
  },
  {
    tag: "Sense Of Worth",
    title: "Feeling Worthy or Valuable",
    prompt: "How worthy do you feel as a person?",
    options: [
      "I do not feel worthless.",
      "I don't consider myself as worthwhile and useful as I used to.",
      "I feel more worthless compared to other people.",
      "I feel utterly worthless.",
    ],
  },
  {
    tag: "Energy Levels",
    title: "Energy Levels",
    prompt: "How are your daily stamina and physical energy levels?",
    options: [
      "I have as much energy as ever.",
      "I have less energy than I used to have.",
      "I don't have enough energy to do very much.",
      "I don't have enough energy to do anything.",
    ],
  },
  {
    tag: "Sleep Quality",
    title: "Changes in Sleeping Patterns",
    prompt: "How has your sleep been over the past two weeks?",
    options: [
      "I have not experienced any change in my sleep.",
      "I sleep somewhat more or somewhat less than usual.",
      "I sleep a lot more or a lot less than usual.",
      "I sleep most of the day OR wake up 1-2 hours early and can't get back to sleep.",
    ],
  },
  {
    tag: "Irritability",
    title: "Irritability & Patience",
    prompt: "How patient or easily annoyed have you felt recently?",
    options: [
      "I am no more irritable than usual.",
      "I am more easily irritated or annoyed than usual.",
      "I am much more irritable than usual.",
      "I feel irritable all the time.",
    ],
  },
  {
    tag: "Appetite & Eating",
    title: "Changes in Appetite",
    prompt: "Have you noticed changes in your appetite or food intake?",
    options: [
      "I have not experienced any change in my appetite.",
      "My appetite is somewhat less or somewhat greater than usual.",
      "My appetite is much less or much greater than usual.",
      "I have no appetite at all OR I crave food all the time.",
    ],
  },
  {
    tag: "Focus & Concentration",
    title: "Concentration & Focus",
    prompt: "How well can you maintain focus on work, reading, or tasks?",
    options: [
      "I can concentrate as well as ever.",
      "I can't concentrate as well as usual.",
      "It's hard to keep my mind on anything for very long.",
      "I find I can't concentrate on anything at all.",
    ],
  },
  {
    tag: "Physical Fatigue",
    title: "Tiredness or Physical Fatigue",
    prompt: "How tired or exhausted do you feel physically?",
    options: [
      "I am no more tired or fatigued than usual.",
      "I get more tired or fatigued more easily than usual.",
      "I am too tired or fatigued to do a lot of things I used to do.",
      "I am too tired or fatigued to do almost anything.",
    ],
  },
  {
    tag: "Intimacy & Sex",
    title: "Interest in Intimacy & Sex",
    prompt: "Have you noticed any changes in your interest in sex or intimacy?",
    options: [
      "I have not noticed any recent change in my interest in sex.",
      "I am less interested in sex than I used to be.",
      "I am much less interested in sex now.",
      "I have lost interest in sex completely.",
    ],
  },
];

const questions: Question[] = ITEMS.map((item, index) => ({
  id: `q_mood_${String(index + 1).padStart(2, "0")}`,
  type: "radio",
  label: item.title,
  description: item.prompt,
  tag: item.tag,
  required: true,
  choices: item.options.map((label, i) => ({ id: `a${i}`, label, points: i })),
  scoring: { scored: true, weight: 1, reverse: false },
}));

// Overall score is the total as a percentage of 63. Rounded to a whole percent, these
// minimums reproduce the published total ranges exactly: 0–13, 14–19, 20–28, 29–63.
const LEVELS: Level[] = [
  {
    id: "lvl_minimal",
    label: "Minimal",
    min: 0,
    description:
      "Your answers fall in the minimal range of low-mood symptoms (total 0–13 out of 63). You reported few signs of low mood over the past two weeks. It is still worth noticing how you feel from time to time.",
  },
  {
    id: "lvl_mild",
    label: "Mild",
    min: 22,
    description:
      "Your answers fall in the mild range of low-mood symptoms (total 14–19 out of 63). Some of your answers point to low mood or low energy. These feelings are common and often ease with support, rest and routine.",
  },
  {
    id: "lvl_moderate",
    label: "Moderate",
    min: 32,
    description:
      "Your answers fall in the moderate range of low-mood symptoms (total 20–28 out of 63). Several of your answers describe a noticeable weight on your mood, energy or daily life. Talking to a professional is likely to help.",
  },
  {
    id: "lvl_severe",
    label: "Severe",
    min: 46,
    description:
      "Your answers fall in the severe range of low-mood symptoms (total 29–63 out of 63). Many of your answers describe a heavy burden on your mood and daily life. Please consider speaking with a mental health professional or your doctor soon; you do not have to manage this alone.",
  },
];

const phone = site.phoneDisplay;

const content: ContentRule[] = [
  {
    id: "cr_support_urgent",
    kind: "support",
    title: "Please reach out for help right now",
    text: `You told us you may want to end your life or hurt yourself. You matter, and you do not have to go through this alone.\n\nIf you are in immediate danger, or you think you might act on these thoughts, call 112 (India's emergency number) or go to the nearest hospital emergency department now, and ask someone you trust to stay with you. You can also call Tele-MANAS, the free 24×7 mental health helpline, on 14416. If you are outside India, please call your local emergency number.\n\nYou are also welcome to contact our practice on ${phone}.`,
    when: [{ source: { type: "question", id: MOOD_SELF_HARM_QUESTION_ID }, operator: "gte", value: 67 }],
  },
  {
    id: "cr_support_thoughts",
    kind: "support",
    title: "Thank you for being honest about your thoughts",
    text: `You mentioned thoughts of harming yourself. These thoughts can be frightening, and they are a good reason to talk to someone soon. Please consider contacting a mental health professional or your doctor today.\n\nIf at any point you feel you might act on these thoughts, call 112 or go to the nearest emergency department. Tele-MANAS (14416) is a free, 24×7 helpline in India. You can also reach our practice on ${phone}.`,
    when: [{ source: { type: "question", id: MOOD_SELF_HARM_QUESTION_ID }, operator: "between", value: 33, value2: 66 }],
  },
  {
    id: "cr_next_minimal",
    kind: "recommendation",
    title: "Keep checking in with yourself",
    text: "Your answers suggest few low-mood symptoms right now. Keep up the routines that help — regular sleep, movement and time with people you trust — and take this check again if things change.",
    when: [{ source: { type: "overall" }, operator: "lt", value: 22 }],
  },
  {
    id: "cr_next_mild",
    kind: "recommendation",
    title: "It may help to talk it through",
    text: `Mild symptoms often respond well to support. A counselling conversation can help you understand what is behind them and what would help. You are welcome to contact us on ${phone} or through the Contact page.`,
    when: [{ source: { type: "overall" }, operator: "between", value: 22, value2: 31 }],
  },
  {
    id: "cr_next_higher",
    kind: "recommendation",
    title: "Speaking with a professional is recommended",
    text: `Your answers are in a range where talking with a qualified professional is strongly worth considering. You can book a session with us through the Contact page or call ${phone}, or speak with your doctor. If it would help, take this summary with you.`,
    when: [{ source: { type: "overall" }, operator: "gte", value: 32 }],
  },
];

const ENABLED: Partial<Record<ResultComponentType, boolean>> = {
  overall_score: true,
  classification: true,
  interpretation: true,
  recommendations: true,
  copy_results: true,
  email_results: true,
};

const DISCLAIMER =
  "This assessment is a tool for self-reflection and screening, not a clinical diagnosis or medical evaluation. True diagnosis requires a comprehensive interview with a licensed mental health professional. If you are experiencing distress, please reach out to a healthcare provider or crisis service.";

export const MOOD_META: AssessmentMeta = {
  title: "Chaitanya Raj Mood Self-Assessment",
  slug: "mood-self-assessment",
  description:
    "A 5–7 minute, 21-question reflection on how you have been feeling over the past Months, with a private results summary and guidance on whether talking to someone could help.",
  category: "emotional-awareness",
  icon: "heart",
  tier: "free",
  estimatedMinutes: 7,
};

export function moodDefinition(): AssessmentDefinition {
  const base = defaultDefinition();
  return {
    ...base,
    intro: {
      heading: "Before you begin",
      body: "This self-assessment is designed to help you reflect on how you have been feeling over the past few weeks/months. It uses questions based on the validated Beck Depression Inventory (BDI-II) framework to measure your current emotional baseline.",
      subtitle: "Understanding Your Emotional Wellbeing",
      badge: "Confidential & Self-Paced",
      highlights: [
        { title: "Private", text: "Your results are shown on a private link only you have." },
        { title: "Takes 5–7 Minutes", text: "{{questions}} simple questions to encourage meaningful reflection." },
        { title: "Therapy Readiness", text: "Helps us discover if therapy can support your growth." },
      ],
      disclaimer: DISCLAIMER,
    },
    navigation: { layout: "single_page", allowBack: true, showProgress: true },
    sections: [
      {
        id: "sec_mood",
        title: "Your past two weeks",
        description: "In each group, choose the statement that best describes how you have been feeling.",
        questions,
      },
    ],
    scoring: {
      ...base.scoring,
      enabled: true,
      method: "questions",
      skills: [],
      contexts: [],
      levels: LEVELS,
      strengthsCount: 0,
      growthCount: 0,
      habitsCount: 0,
      displayMax: 63,
      contentRules: content,
    },
    results: {
      headline: "Your mood self-assessment results",
      disclaimer: DISCLAIMER,
      components: defaultResultComponents().map((c) => ({ ...c, enabled: ENABLED[c.type] ?? false })),
      reportDownload: true,
    },
    email: {
      ...base.email,
      subject: "Your Mood Self-Assessment results",
      intro: "Thank you for completing the Mood Self-Assessment. Here is a summary of your results.",
      includePlan: false,
    },
    peer: { ...base.peer, enabled: false },
  };
}
