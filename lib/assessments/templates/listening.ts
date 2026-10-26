import { DEFAULT_DISCLAIMER, DEFAULT_INTRO_NOTICE, defaultDefinition, defaultResultComponents } from "../definition";
import type {
  AssessmentDefinition,
  AssessmentMeta,
  Condition,
  ContentRule,
  PlanWeek,
  Question,
  Section,
  Skill,
} from "../types";

// STARTER TEMPLATE — Listening Self-Reflection Assessment.
//
// The questions, thresholds and scoring weights below are editable starting
// points written to match the brief (nine short sections, four skills, work and
// home contexts, optional peer feedback, a 30-day plan). They are NOT a
// professionally validated questionnaire and the thresholds are not clinically
// derived. Review and edit everything in the admin builder before publishing.
//
// Ids are fixed (not random) so that the template is reproducible and tests can
// refer to questions by name.

export const LISTENING_TEMPLATE_ID = "listening-self-reflection";

const SKILLS: Skill[] = [
  {
    id: "attention",
    name: "Attention",
    weight: 1,
    description: "Giving the speaker your full focus, without distractions or drifting thoughts.",
    strengthText: "You tend to give people your undivided attention, which makes them feel heard.",
    growthText: "Your attention can drift — to screens, to your own thoughts, or to what you want to say next.",
    tips: [
      "Put your phone face-down or out of sight when someone starts talking.",
      "When you notice your mind wandering, gently return to the speaker's words.",
    ],
  },
  {
    id: "understanding",
    name: "Understanding",
    weight: 1,
    description: "Making sure you have understood both the words and the feelings behind them.",
    strengthText: "You check for meaning and notice feelings as well as facts.",
    growthText: "You may sometimes assume you know what is meant before it has been fully said.",
    tips: [
      "Reflect back what you heard in your own words before responding.",
      "Name the feeling you notice (\"It sounds like that was frustrating\") and let them correct you.",
    ],
  },
  {
    id: "restraint",
    name: "Restraint",
    weight: 1,
    description: "Holding back interruptions, advice and quick fixes so the other person can finish.",
    strengthText: "You let people finish and are comfortable with pauses.",
    growthText: "The urge to jump in, advise or fix can arrive before the other person has finished.",
    tips: [
      "Count a silent breath after the other person stops before you reply.",
      "Ask \"Would advice be helpful right now?\" before offering any.",
    ],
  },
  {
    id: "curiosity",
    name: "Curiosity",
    weight: 1,
    description: "Asking open questions and staying interested in views that differ from your own.",
    strengthText: "You ask real questions and stay interested even when you disagree.",
    growthText: "You could ask more open questions and stay curious about perspectives unlike yours.",
    tips: [
      "Replace one closed question a day with \"what\" or \"how\".",
      "When you disagree, ask \"What leads you to see it that way?\" before you respond.",
    ],
  },
];

const scale = (min: string, max: string) => ({ minLabel: min, maxLabel: max });

const WORK: Condition = {
  action: "show",
  match: "all",
  rules: [{ questionId: "q_where", operator: "in", value: ["work", "both"] }],
};
const HOME: Condition = {
  action: "show",
  match: "all",
  rules: [{ questionId: "q_where", operator: "in", value: ["home", "both"] }],
};

interface RatingSpec {
  id: string;
  skill: string;
  context: "work" | "home";
  label: string;
  reverse?: boolean;
  habit: string;
  peer: string;
}

// 1–5 frequency ratings. `reverse` items describe the unhelpful habit, so a high
// rating lowers the score.
const RATINGS: RatingSpec[] = [
  { id: "q_attn_work_1", skill: "attention", context: "work", label: "At work, I put my phone and other distractions away while someone is speaking to me.", habit: "Putting distractions away at work", peer: "At work, they put their phone and other distractions away while I'm speaking." },
  { id: "q_attn_work_2", skill: "attention", context: "work", reverse: true, label: "At work, my mind drifts to what I want to say next while the other person is still talking.", habit: "Staying with the speaker instead of rehearsing a reply at work", peer: "At work, they seem to be thinking about their own reply while I'm still talking." },
  { id: "q_attn_home_1", skill: "attention", context: "home", label: "At home, I turn towards the person and pause what I'm doing when they start talking to me.", habit: "Turning towards people at home", peer: "At home, they turn towards me and pause what they're doing when I start talking." },
  { id: "q_attn_home_2", skill: "attention", context: "home", reverse: true, label: "At home, I keep looking at a screen or doing something else while someone is talking to me.", habit: "Putting screens down at home", peer: "At home, they keep looking at a screen or doing something else while I'm talking." },

  { id: "q_und_work_1", skill: "understanding", context: "work", label: "At work, I check I've understood by summarising what the other person said before I respond.", habit: "Summarising before responding at work", peer: "At work, they check they've understood me by summarising what I said before responding." },
  { id: "q_und_work_2", skill: "understanding", context: "work", label: "At work, I notice how someone feels, not just the words they use.", habit: "Noticing feelings at work", peer: "At work, they notice how I feel, not just the words I use." },
  { id: "q_und_home_1", skill: "understanding", context: "home", label: "At home, I can repeat back what someone told me in a way they would agree is accurate.", habit: "Reflecting back accurately at home", peer: "At home, they can repeat back what I've told them in a way I'd agree is accurate." },
  { id: "q_und_home_2", skill: "understanding", context: "home", reverse: true, label: "At home, I assume I already know what the person is going to say.", habit: "Not assuming what people will say at home", peer: "At home, they act as though they already know what I'm going to say." },

  { id: "q_res_work_1", skill: "restraint", context: "work", label: "At work, I let people finish their sentences without interrupting.", habit: "Letting people finish at work", peer: "At work, they let me finish my sentences without interrupting." },
  { id: "q_res_work_2", skill: "restraint", context: "work", reverse: true, label: "At work, I jump in with advice or a solution before the person has finished explaining.", habit: "Holding back advice until the person has finished at work", peer: "At work, they jump in with advice or a solution before I've finished explaining." },
  { id: "q_res_home_1", skill: "restraint", context: "home", label: "At home, I stay quiet and let a pause happen instead of rushing to fill it.", habit: "Letting pauses happen at home", peer: "At home, they stay quiet and let a pause happen instead of rushing to fill it." },
  { id: "q_res_home_2", skill: "restraint", context: "home", reverse: true, label: "At home, I get impatient when someone takes a long time to get to the point.", habit: "Staying patient with long explanations at home", peer: "At home, they seem impatient when I take a long time to get to the point." },

  { id: "q_cur_work_1", skill: "curiosity", context: "work", label: "At work, I ask open questions (\"what\", \"how\") to understand someone's point of view.", habit: "Asking open questions at work", peer: "At work, they ask open questions to understand my point of view." },
  { id: "q_cur_work_2", skill: "curiosity", context: "work", label: "At work, I stay curious even when I disagree with what someone is saying.", habit: "Staying curious when I disagree at work", peer: "At work, they stay curious even when they disagree with me." },
  { id: "q_cur_home_1", skill: "curiosity", context: "home", label: "At home, I ask follow-up questions about the other person's day or feelings.", habit: "Asking follow-up questions at home", peer: "At home, they ask follow-up questions about my day or feelings." },
  { id: "q_cur_home_2", skill: "curiosity", context: "home", label: "At home, I'm interested in perspectives that differ from mine.", habit: "Welcoming different perspectives at home", peer: "At home, they're interested in perspectives that differ from theirs." },
];

function rating(spec: RatingSpec): Question {
  return {
    id: spec.id,
    type: "rating5",
    label: spec.label,
    required: true,
    min: 1,
    max: 5,
    step: 1,
    ...scale("Never", "Always"),
    visibility: spec.context === "work" ? WORK : HOME,
    scoring: { scored: true, skillId: spec.skill, contextId: spec.context, weight: 1, reverse: Boolean(spec.reverse), habit: spec.habit },
    peer: { enabled: true, label: spec.peer },
  };
}

const ratingsFor = (skill: string) => RATINGS.filter((r) => r.skill === skill).map(rating);

const INTRO_Q: Question[] = [
  {
    id: "q_self_rating",
    type: "rating5",
    label: "Overall, how good a listener do you think you are?",
    description: "This is only used to compare how you see yourself with the pattern in your answers. It isn't scored.",
    required: true,
    min: 1,
    max: 5,
    step: 1,
    ...scale("Not very good", "Excellent"),
    scoring: { scored: false, weight: 1, reverse: false },
  },
  {
    id: "q_where",
    type: "radio",
    label: "Where do you mainly want to reflect on your listening?",
    description: "The following questions adapt to your choice.",
    required: true,
    choices: [
      { id: "work", label: "At work" },
      { id: "home", label: "At home" },
      { id: "both", label: "Both" },
    ],
  },
];

const PATIENCE_Q: Question[] = [
  {
    id: "q_res_urge",
    type: "rating5",
    label: "When I hear something I disagree with, I feel a strong urge to interrupt.",
    required: true,
    min: 1,
    max: 5,
    step: 1,
    ...scale("Never", "Always"),
    scoring: { scored: true, skillId: "restraint", weight: 1, reverse: true, habit: "Managing the urge to interrupt" },
    peer: { enabled: true, label: "When they hear something they disagree with, they interrupt me." },
  },
  {
    id: "q_res_silence",
    type: "rating5",
    label: "I can stay with silence in a conversation without feeling uncomfortable.",
    required: true,
    min: 1,
    max: 5,
    step: 1,
    ...scale("Never", "Always"),
    scoring: { scored: true, skillId: "restraint", weight: 1, reverse: false, habit: "Being comfortable with silence" },
    peer: { enabled: true, label: "They seem comfortable with silence in our conversations." },
  },
  {
    id: "q_habits_tick",
    type: "checkbox",
    label: "Which of these do you sometimes do while someone is still talking? (optional)",
    description: "Not scored — just a prompt for noticing.",
    required: false,
    choices: [
      { id: "check_phone", label: "Check my phone or messages" },
      { id: "plan_reply", label: "Plan what I'll say next" },
      { id: "finish_sentence", label: "Finish their sentences" },
      { id: "give_advice", label: "Start giving advice" },
      { id: "think_other", label: "Think about something else" },
    ],
    scoring: { scored: false, weight: 1, reverse: false },
  },
];

const REFLECTION_Q: Question[] = [
  {
    id: "q_ref_good",
    type: "long_text",
    label: "Think of a recent conversation where you listened well. What did you do?",
    required: false,
    maxLength: 1500,
  },
  {
    id: "q_ref_hard",
    type: "long_text",
    label: "Think of a conversation where you could have listened better. What got in the way?",
    required: false,
    maxLength: 1500,
  },
  {
    id: "q_ref_person",
    type: "short_text",
    label: "Who do you find hardest to listen to, and why?",
    required: false,
    maxLength: 400,
  },
];

const PEER_Q: Question[] = [
  {
    id: "q_peer_info",
    type: "info",
    label: "Optional: ask someone for their view",
    body: "People often experience our listening differently from how we see it. If you like, you can invite a colleague, friend or family member to answer a few short questions about you.\n\nYou'll get a private link on your results page to share. Their answers are anonymous and are only used to compare with yours.",
    required: false,
  },
  {
    id: "q_peer_invite",
    type: "peer_feedback",
    label: "Would you like to invite someone to share their view of your listening?",
    required: false,
  },
];

const INTENTION_Q: Question[] = [
  {
    id: "q_intention",
    type: "long_text",
    label: "Which listening habit would you most like to strengthen over the next 30 days?",
    required: false,
    maxLength: 800,
  },
];

const SECTIONS: Section[] = [
  {
    id: "sec_start",
    title: "Getting started",
    description: "Two quick questions so the rest of the assessment fits you.",
    questions: INTRO_Q,
  },
  { id: "sec_attention", title: "Attention", description: "How fully you are present when someone speaks.", questions: ratingsFor("attention") },
  { id: "sec_understanding", title: "Understanding", description: "How well you grasp what is meant, not only what is said.", questions: ratingsFor("understanding") },
  { id: "sec_restraint", title: "Restraint", description: "Holding back interruptions, advice and quick fixes.", questions: ratingsFor("restraint") },
  { id: "sec_curiosity", title: "Curiosity", description: "How much you want to understand the other person's view.", questions: ratingsFor("curiosity") },
  { id: "sec_patience", title: "Patience and pauses", description: "A few more questions about patience in the moment.", questions: PATIENCE_Q },
  { id: "sec_reflection", title: "In your own words", description: "Optional reflections — nothing here is scored.", questions: REFLECTION_Q },
  { id: "sec_peer", title: "Another point of view", questions: PEER_Q },
  { id: "sec_intention", title: "Your 30-day intention", questions: INTENTION_Q },
];

const CONTENT: ContentRule[] = [
  {
    id: "cr_patience_low",
    kind: "insight",
    title: "Patience insight",
    text: "Your restraint score suggests the urge to step in — to interrupt, finish a sentence or give advice — can arrive quickly. That urge is common and usually well-meant. Practising a silent breath before you reply gives the other person room to finish and often shows you what they actually needed.",
    when: [{ source: { type: "skill", id: "restraint" }, operator: "lt", value: 50 }],
  },
  {
    id: "cr_patience_high",
    kind: "insight",
    title: "Patience insight",
    text: "Your restraint score suggests you are generally comfortable letting people finish and letting pauses happen. Notice whether you also let people know you are engaged — a nod or a short reflection shows silence is attentive rather than distant.",
    when: [{ source: { type: "skill", id: "restraint" }, operator: "gte", value: 70 }],
  },
  {
    id: "cr_myth_wait",
    kind: "misconception",
    title: "Myth: \"Listening just means waiting for my turn.\"",
    text: "Being quiet is not the same as listening. Real listening means staying with what the person is saying — and checking you understood — rather than preparing your reply.",
    when: [],
  },
  {
    id: "cr_myth_fix",
    kind: "misconception",
    title: "Myth: \"A good listener solves the problem.\"",
    text: "Often people want to feel understood before — or instead of — being given a solution. Ask what would help before offering advice.",
    when: [],
  },
  {
    id: "cr_myth_multitask",
    kind: "misconception",
    title: "Myth: \"I can listen while I do something else.\"",
    text: "Most of us can hear while multitasking, but attention is limited. Even a glance at a screen tells the speaker they are second priority.",
    when: [],
  },
  {
    id: "cr_myth_agree",
    kind: "misconception",
    title: "Myth: \"Listening means agreeing.\"",
    text: "You can understand someone fully and still disagree. Listening first usually makes a respectful disagreement easier to have.",
    when: [],
  },
  {
    id: "cr_rec_low",
    kind: "recommendation",
    title: "Start small",
    text: "Pick one conversation a day to practise full attention: phone away, eyes on the speaker, and one reflecting sentence before you reply.",
    when: [{ source: { type: "overall" }, operator: "lt", value: 60 }],
  },
  {
    id: "cr_rec_high",
    kind: "recommendation",
    title: "Keep the habit visible",
    text: "Your answers describe strong listening habits. Consider asking someone you trust what it feels like to talk with you — the peer feedback link on this page makes that easy.",
    when: [{ source: { type: "overall" }, operator: "gte", value: 80 }],
  },
];

const WEEKS: PlanWeek[] = [
  {
    id: "wk_1",
    title: "Week 1 — Notice",
    days: "Days 1–7",
    goal: "Become aware of how you listen, without trying to change it yet.",
    practices: [
      { id: "pr_1_general", text: "At the end of each day, write down one conversation where you listened well and one where you drifted." },
      { id: "pr_1_attn", skillId: "attention", text: "Put your phone face-down or out of reach for the first minute of every conversation." },
      { id: "pr_1_und", skillId: "understanding", text: "Once a day, say \"So what you're saying is…\" and let them correct you." },
      { id: "pr_1_res", skillId: "restraint", text: "Notice each time you feel the urge to interrupt. Just count them — don't fight them yet." },
      { id: "pr_1_cur", skillId: "curiosity", text: "Ask one \"what\" or \"how\" question in a conversation each day." },
    ],
  },
  {
    id: "wk_2",
    title: "Week 2 — Slow down",
    days: "Days 8–14",
    goal: "Create a little more room in each conversation.",
    practices: [
      { id: "pr_2_general", text: "Take one slow breath before you reply in at least three conversations a day." },
      { id: "pr_2_attn", skillId: "attention", text: "When your mind wanders, silently note \"drifting\" and return to the speaker's words." },
      { id: "pr_2_und", skillId: "understanding", text: "Name the feeling you notice (\"That sounds frustrating\") and check if you're right." },
      { id: "pr_2_res", skillId: "restraint", text: "Wait for a full two-second pause after the other person stops speaking before you respond." },
      { id: "pr_2_cur", skillId: "curiosity", text: "Replace one closed question a day with an open one." },
    ],
  },
  {
    id: "wk_3",
    title: "Week 3 — Deepen",
    days: "Days 15–21",
    goal: "Practise on the conversations that are harder for you.",
    practices: [
      { id: "pr_3_general", text: "Choose one person you find hard to listen to and practise one full conversation with them." },
      { id: "pr_3_attn", skillId: "attention", text: "Hold eye contact or a steady, attentive posture for the whole of one conversation each day." },
      { id: "pr_3_und", skillId: "understanding", text: "Summarise what you heard before giving your own view in at least two conversations." },
      { id: "pr_3_res", skillId: "restraint", text: "Before offering advice, ask: \"Would advice be helpful right now?\"" },
      { id: "pr_3_cur", skillId: "curiosity", text: "When you disagree, ask \"What leads you to see it that way?\" before you respond." },
    ],
  },
  {
    id: "wk_4",
    title: "Week 4 — Make it yours",
    days: "Days 22–30",
    goal: "Keep what works and decide what to carry forward.",
    practices: [
      { id: "pr_4_general", text: "Ask someone you trust: \"What's it like to talk with me?\" — then listen without defending." },
      { id: "pr_4_attn", skillId: "attention", text: "Pick the attention habit that helped most and keep it as a daily default." },
      { id: "pr_4_und", skillId: "understanding", text: "Keep reflecting back in important conversations until it feels natural." },
      { id: "pr_4_res", skillId: "restraint", text: "Keep your pause habit, and notice how often the other person adds something after it." },
      { id: "pr_4_cur", skillId: "curiosity", text: "Choose one person's perspective you rarely explore and ask them about it." },
    ],
  },
];

export const LISTENING_META: AssessmentMeta = {
  title: "Listening Self-Reflection Assessment",
  slug: "listening-self-reflection",
  description:
    "A twelve-minute reflection on how you listen at work and at home across four skills — attention, understanding, restraint and curiosity — with a personal 30-day practice plan.",
  category: "listening-skills",
  icon: "ear",
  tier: "free",
  estimatedMinutes: 12,
};

export function listeningDefinition(): AssessmentDefinition {
  const base = defaultDefinition();
  return {
    ...base,
    intro: {
      ...base.intro,
      heading: "Listening Self-Reflection",
      subtitle: "Understanding how you listen — at work and at home",
      disclaimer: `${DEFAULT_INTRO_NOTICE} The questions and score ranges in this assessment are an editable starter version and have not been clinically validated.`,
      body: "This takes about 12 minutes. You'll rate how often you do certain things when someone is talking to you, then add a few optional reflections.\n\nThere are no right or wrong answers, and this is a starting point for reflection — the questions and scoring are an editable starter version, not a validated clinical test.",
    },
    sections: SECTIONS,
    scoring: {
      ...base.scoring,
      enabled: true,
      method: "skills",
      skills: SKILLS,
      contexts: [
        { id: "work", name: "Work" },
        { id: "home", name: "Home" },
      ],
      // Starter thresholds — editable in Scoring > Levels.
      levels: [
        {
          id: "lvl_waiting",
          label: "Waiting",
          min: 0,
          description: "Much of the time you may be waiting for your turn to speak. That's very common, and the habits that help — attention, checking understanding, pausing, asking — can be learned.",
        },
        {
          id: "lvl_hearing",
          label: "Hearing",
          min: 40,
          description: "You take in what people say, but pressure, distractions or the urge to respond can pull you away. Small, consistent habits can move you toward fuller listening.",
        },
        {
          id: "lvl_listening",
          label: "Listening",
          min: 60,
          description: "You usually give people your attention and try to understand them. A few habits could make your listening more consistent across situations.",
        },
        {
          id: "lvl_attentive",
          label: "Attentive",
          min: 80,
          description: "You listen with attention, patience and curiosity most of the time. The next step is staying aware of your habits so they hold up when you're tired or stressed.",
        },
      ],
      skillBands: [
        { label: "Emerging", min: 0 },
        { label: "Developing", min: 40 },
        { label: "Established", min: 60 },
        { label: "Strong", min: 80 },
      ],
      strengthsCount: 2,
      growthCount: 2,
      habitsCount: 3,
      contextGapThreshold: 10,
      selfPerception: {
        questionId: "q_self_rating",
        gapThreshold: 15,
        aligned: "How you see your listening is close to the pattern in your answers.",
        over: "You rated yourself higher as a listener than your detailed answers suggest. That's a very common gap — noticing it is useful, and the practice plan can help you close it.",
        under: "You rated yourself lower as a listener than your detailed answers suggest. You may be harder on yourself than your habits warrant.",
      },
      contentRules: CONTENT,
      practicePlan: {
        enabled: true,
        title: "Your 30-day practice plan",
        intro: "Each week has one general practice plus practices for the skills you may most want to grow. Pick what's realistic — a few minutes a day is enough.",
        focusCount: 2,
        weeks: WEEKS,
      },
    },
    results: {
      headline: "Your listening results",
      disclaimer: `${DEFAULT_DISCLAIMER} The questions and score ranges in this assessment are a starter version and have not been clinically validated.`,
      components: defaultResultComponents(),
      reportDownload: true,
    },
    email: {
      ...base.email,
      subject: "Your Listening Self-Reflection results",
      intro: "Thank you for completing the Listening Self-Reflection. Here is a summary of your results.",
    },
    peer: {
      ...base.peer,
      enabled: true,
      maxResponses: 3,
      intro: "Someone has asked how they come across when they listen. Please answer honestly based on your experience of talking with them. Your answers are anonymous and are only combined into an average they can see.",
    },
  };
}
