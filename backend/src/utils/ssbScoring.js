// NavaSetu SSB OLQ Readiness Module — Scoring Engine
//
// IMPORTANT — what this module is and isn't:
// The actual SSB (Services Selection Board) assesses candidates through five
// days of live observation by three independently-trained assessors (a
// psychologist, a Group Testing Officer, and an Interviewing Officer) who
// cross-verify projective test responses (TAT/WAT/SRT/SDT) against real
// behavior in group tasks and a personal interview. No published, validated
// model exists that maps self-report scores to a true pass/fail probability,
// and nothing here claims to replicate psychologist-grade projective test
// interpretation. This module instead produces an honest "OLQ Readiness
// Profile": where a candidate's self-reported traits and practice-exercise
// patterns sit relative to the 15 Officer-Like Qualities, plus a clearly
// disclaimed composite index — never a predicted outcome.
//
// The 15 OLQs (per DIPR/DGR framework) are grouped into 4 factors:
//   1. Planning & Organizing  — effective intelligence, reasoning ability,
//      organizing ability, power of expression
//   2. Social Adjustment      — cooperation, sense of responsibility,
//      initiative, social adjustment
//   3. Social Effectiveness   — social effectiveness, ability to influence
//      the group, liveliness, group cohesiveness
//   4. Dynamic Factor         — determination, courage, stamina,
//      self-confidence
//
// Trait items below are ORIGINAL, written to measure well-established
// constructs (locus of control, achievement motivation, hardiness, social
// maturity) without reproducing any copyrighted psychometric instrument.
// The Big Five block reuses the existing Mini-IPIP items already licensed
// for use in this codebase (public-domain, Donnellan et al. 2006).
//
// LANGUAGE LEVEL: all original wording below (trait items, SRT, GTO, TAT,
// SDT) is deliberately written in short, plain sentences — aimed at a
// Class XII to graduate reader who may not be fluent in English, not at
// competitive-exam or literary English. Short words, short sentences, no
// idioms where avoidable.
//
// ROTATION: WAT/SRT/GTO/TAT are free-response/judgment exercises where a
// bigger bank + a random draw per attempt is realistic and useful (see
// pickRandomSubset + the selection built in routes/ssb.js at assessment
// creation). The Big Five + 4 trait scales are NOT rotated — a trait scale
// only scores validly if every candidate answers the same fixed item set,
// so rotating those would break the scoring, not just vary the experience.

import { questionBank as wellnessQuestionBank, personalityMapping, calculatePersonalityScores } from './scoring.js';

const LIKERT_5 = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

// The 20 Mini-IPIP Big Five items already licensed for this codebase
// (scoring.js), re-exported read-only for the SSB flow to render as part of
// its own trait battery. Nothing here modifies scoring.js or its exports —
// this is a pure filter/re-export.
export const bigFiveItems = wellnessQuestionBank.filter((q) => q.category === 'Personality');

// --- Trait scale item bank (original items, 4 constructs x 5 items) -----
// Simplified plain-English versions — short sentences, everyday words.
export const traitItemBank = [
  // Locus of Control (Internal) — belief that outcomes follow from one's own
  // effort and decisions rather than luck or external forces. Maps to
  // initiative/responsibility (Social Adjustment).
  { id: 'loc1', text: 'Most of what happens to me is because of what I do, not luck.', category: 'Locus of Control', options: LIKERT_5, reverse: false },
  { id: 'loc2', text: 'When something goes wrong for me, it is usually not my fault.', category: 'Locus of Control', options: LIKERT_5, reverse: true },
  { id: 'loc3', text: 'If I plan well and work hard, I can get the result I want.', category: 'Locus of Control', options: LIKERT_5, reverse: false },
  { id: 'loc4', text: 'Good results mostly depend on luck or being in the right place.', category: 'Locus of Control', options: LIKERT_5, reverse: true },
  { id: 'loc5', text: 'When I make a mistake, I accept that it is my fault.', category: 'Locus of Control', options: LIKERT_5, reverse: false },

  // Achievement Motivation — drive for excellence, goal persistence,
  // competitive orientation. Maps to determination (Dynamic Factor) and
  // organizing ability (Planning & Organizing).
  { id: 'ach1', text: 'I set clear goals for myself and check how I am doing.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach2', text: 'I stop trying once a task becomes hard.', category: 'Achievement Motivation', options: LIKERT_5, reverse: true },
  { id: 'ach3', text: 'I want to do better than I did last time, not just get by.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach4', text: 'I can keep working hard for months to reach a far-away goal.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach5', text: 'I lose interest in a goal once it is no longer new or exciting.', category: 'Achievement Motivation', options: LIKERT_5, reverse: true },

  // Hardiness / Stress Tolerance — commitment, sense of control, and viewing
  // difficulty as a challenge rather than a threat. Maps to stamina and
  // courage (Dynamic Factor).
  { id: 'hrd1', text: 'When there is pressure, I can still think clearly.', category: 'Hardiness', options: LIKERT_5, reverse: false },
  { id: 'hrd2', text: 'A sudden problem can upset me for a long time.', category: 'Hardiness', options: LIKERT_5, reverse: true },
  { id: 'hrd3', text: 'I see a hard situation as something to solve, not something to fear.', category: 'Hardiness', options: LIKERT_5, reverse: false },
  { id: 'hrd4', text: 'If I feel tired or uncomfortable, I want to quit quickly.', category: 'Hardiness', options: LIKERT_5, reverse: true },
  { id: 'hrd5', text: 'I can keep working even when I am tired or uncomfortable.', category: 'Hardiness', options: LIKERT_5, reverse: false },

  // Social Maturity / Cooperation — willingness to subordinate personal
  // preference to group welfare, non-egocentric group behavior. Maps to
  // cooperation and group cohesiveness (Social Adjustment + Effectiveness).
  { id: 'soc1', text: 'In a group task, I make sure quiet members also get a chance to speak.', category: 'Social Maturity', options: LIKERT_5, reverse: false },
  { id: 'soc2', text: 'It is hard for me to accept it when the group does not choose my idea.', category: 'Social Maturity', options: LIKERT_5, reverse: true },
  { id: 'soc3', text: 'I am happy to let someone else lead if they can do the job better.', category: 'Social Maturity', options: LIKERT_5, reverse: false },
  { id: 'soc4', text: 'When working in a group, I mostly care about getting credit for myself.', category: 'Social Maturity', options: LIKERT_5, reverse: true },
  { id: 'soc5', text: 'I change the way I talk depending on who I am talking to.', category: 'Social Maturity', options: LIKERT_5, reverse: false }
];

export const traitMapping = {
  'Locus of Control': ['loc1', 'loc2', 'loc3', 'loc4', 'loc5'],
  'Achievement Motivation': ['ach1', 'ach2', 'ach3', 'ach4', 'ach5'],
  'Hardiness': ['hrd1', 'hrd2', 'hrd3', 'hrd4', 'hrd5'],
  'Social Maturity': ['soc1', 'soc2', 'soc3', 'soc4', 'soc5']
};

// --- Word Association Test (WAT) bank ------------------------------------
// 70 simple, single-word stimuli. A random 40 are drawn for each new
// attempt (see pickRandomSubset + routes/ssb.js), so no two attempts by the
// same person look identical.
export const watWords = [
  'Fear', 'Failure', 'Death', 'Leader', 'Duty', 'Discipline', 'Mistake', 'Weakness',
  'Courage', 'Team', 'Responsibility', 'Danger', 'Enemy', 'Competition', 'Rules',
  'Sacrifice', 'Betrayal', 'Crisis', 'Plan', 'Challenge', 'Confidence', 'Friend',
  'Family', 'Money', 'Power', 'Victory', 'Defeat', 'Risk', 'Cooperation', 'Honesty',
  'Pressure', 'Decision', 'Goal', 'Obstacle', 'Crowd', 'Injury', 'Time', 'Orders',
  'Unknown', 'Trust', 'Anger', 'Hope', 'Loss', 'Change', 'Speed', 'Silence',
  'Help', 'War', 'Peace', 'Justice', 'Truth', 'Lie', 'Escape', 'Strength',
  'Doubt', 'Reward', 'Punishment', 'Freedom', 'Control', 'Patience', 'Anxiety', 'Success',
  'Effort', 'Comfort', 'Sacrifice2', 'Delay', 'Rescue', 'Loyalty', 'Shame', 'Pride'
].filter((w, i, arr) => arr.indexOf(w) === i && w !== 'Sacrifice2'); // guard against accidental dup while keeping list easy to edit

// Simple lexicons for the rubric-based WAT/SRT heuristic scorer below. This
// is pattern-matching, not clinical interpretation — the UI must say so.
const NEGATIVE_ONLY_MARKERS = ['hate', 'never', 'cannot', "can't", 'impossible', 'useless', 'hopeless', 'give up', 'quit', 'afraid', 'scared', 'panic', 'run away', 'avoid'];
const CONSTRUCTIVE_MARKERS = ['plan', 'help', 'solve', 'organize', 'lead', 'support', 'protect', 'overcome', 'manage', 'calm', 'together', 'team', 'responsible', 'decide', 'act', 'prepare', 'trust', 'learn'];
const AGGRESSIVE_MARKERS = ['kill', 'destroy', 'attack', 'revenge', 'punish', 'hate', 'fight everyone'];

function scoreFreeTextItem(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return { spontaneity: 0, positivity: 0, constructiveness: 0, flags: ['blank'] };

  const words = t.split(/\s+/).filter(Boolean);
  const flags = [];

  // Spontaneity proxy: a WAT/SRT response that's just 1 word or clearly
  // copied the stimulus back isn't a real reaction.
  const spontaneity = words.length <= 1 ? 1 : words.length <= 3 ? 3 : 5;
  if (words.length <= 1) flags.push('too_short');

  const hasNegative = NEGATIVE_ONLY_MARKERS.some((m) => t.includes(m));
  const hasConstructive = CONSTRUCTIVE_MARKERS.some((m) => t.includes(m));
  const hasAggressive = AGGRESSIVE_MARKERS.some((m) => t.includes(m));

  let positivity = 3;
  if (hasConstructive && !hasNegative) positivity = 5;
  else if (hasNegative && !hasConstructive) positivity = 1;
  if (hasAggressive) { positivity = Math.min(positivity, 1); flags.push('aggressive_tone'); }

  const constructiveness = hasConstructive ? 5 : hasNegative ? 1 : 3;

  return { spontaneity, positivity, constructiveness, flags };
}

/**
 * Scores a WAT set (word -> sentence map). `words` is the specific subset
 * shown to this candidate this attempt (falls back to the full bank if not
 * given, e.g. for old attempts saved before rotation was added).
 */
export function scoreWAT(responses, words = watWords) {
  const items = words.map((word) => {
    const text = responses?.[word] || '';
    const scored = scoreFreeTextItem(text);
    return { word, text, ...scored };
  });
  const answered = items.filter((i) => i.text.trim());
  const avg = (key) => answered.length ? answered.reduce((s, i) => s + i[key], 0) / answered.length : 0;
  return {
    items,
    answeredCount: answered.length,
    totalCount: words.length,
    aggregate: Number((((avg('spontaneity') + avg('positivity') + avg('constructiveness')) / 3)).toFixed(2))
  };
}

// --- Situation Reaction Test (SRT) bank ----------------------------------
// 60 short, plain-English situations. A random subset is drawn per attempt.
export const srtSituations = [
  'You are travelling with three friends. Your vehicle breaks down at night, far from town.',
  'A junior colleague takes credit for work you both did, in front of your boss.',
  'A group project is falling behind because two members are not doing their share.',
  'You lead a team for the first time. One senior member does not like reporting to you.',
  'While hiking with a group, one member gets hurt. The nearest help is hours away.',
  'You realise, halfway through a test, that you read the instructions wrong.',
  'A close friend asks you to lie for them about something you do not agree with.',
  'You are the only one in your group who sees a safety risk that others are ignoring.',
  'Your team loses an important match because of a decision you made.',
  'You must lead a group of people who are older and more experienced than you.',
  'Money meant for a group activity goes missing. Suspicion falls on an innocent person.',
  'You must tell a team, who worked hard, some bad news about their goal.',
  'A stranger needs help in an emergency, but you are already late for something important.',
  'Two close friends have a serious fight. Both want you to take their side.',
  'You are blamed for a mistake that was really caused by unclear instructions.',
  'Your group is lost and running low on supplies on an outdoor trip.',
  'A younger person looks up to you, but is copying one of your bad habits.',
  'You find a factual error in a report, just minutes before it must be submitted.',
  'Someone senior to you asks you to do something that goes against your values.',
  'You are the newest member of a team that already has its own way of working.',
  'A group member keeps rejecting every idea, but never gives their own suggestion.',
  'You must lift the spirits of a team after a public failure.',
  'You see a road accident and are the first person to reach the spot.',
  'You are given a task with unclear goals and very little time.',
  'A close friend is spreading a false rumour about someone.',
  'You must work with someone you strongly dislike to finish an urgent task.',
  'Your plans for an important day are disrupted by a sudden family problem.',
  'The group makes a decision that you privately think is wrong.',
  'You are asked to settle a dispute between two friends who are both partly right.',
  'While speaking for your group in public, you are asked a question you cannot answer.',
  'You learn that a rival group is spreading false information about your team\'s work.',
  'Everyone in your group wants to give up on a hard task except you.',
  'You have limited supplies to share among a group that all need the same thing.',
  'A person you are guiding makes the same mistake you already warned them about.',
  'You are blamed for a decision that the whole group actually made together.',
  'Your team must choose between a safer, slower plan and a faster, riskier one.',
  'A person tells you a serious personal problem and asks you to keep it secret.',
  'You are asked to do an unpleasant task that nobody else wants to do.',
  'Partway through, you realise a plan you strongly supported will not work.',
  'You must give honest, critical feedback to someone who cares a lot about their work.',
  'You are travelling alone and miss the last bus/train home late at night.',
  'A close friend often borrows money and has not returned it for a long time.',
  'Your group\'s leader makes an unfair decision and everyone looks to you to react.',
  'You are asked to train a new member who is not interested in learning.',
  'A teacher/senior blames the whole class for what one student did.',
  'You promised to help a friend, but a more urgent family matter comes up at the same time.',
  'You notice a close friend cheating in an exam or competition.',
  'Your group\'s plan is going well, but one member wants to take a shortcut that feels wrong.',
  'You are given credit for work that was mostly done by someone else in your team.',
  'A younger sibling or junior copies your mistakes, thinking they are the right way to act.',
  'You must speak in front of a large group with almost no preparation time.',
  'Your close friend is being bullied and asks you to stay out of it.',
  'You discover your team\'s plan will fail unless you change it, but nobody will listen to you.',
  'A person you trust breaks a promise that affects your whole group.',
  'You are asked to choose one person from your team for an opportunity, and two are equally deserving.',
  'Your team wins, but you know you did not contribute much to it.',
  'A stranger accuses you of something you did not do, in front of others.',
  'You must complete an important task alone after your teammate suddenly leaves.',
  'You find out a friend has been talking badly about you behind your back.',
  'A group member refuses to follow the plan everyone else agreed to.'
];

// --- GTO-style situational judgment scenarios ----------------------------
// Written analogs of Group Discussion / Group Planning / Command Task
// dynamics, in plain English. Each option is tagged with the OLQ factor(s)
// it reflects and a quality weight (best/adequate/weak) used by the scorer.
export const gtoScenarios = [
  {
    id: 'gto1',
    prompt: 'Your group of eight has 10 minutes to cross a "river" using two planks and a rope. Two members are scared and slowing the group down. What do you do?',
    options: [
      { text: 'Give each person a clear, simple job based on their strengths, calm the scared members, and keep the group moving on a plan.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Take charge and give firm orders. Tell the scared members to just follow and not slow things down.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Let the group figure it out on its own since everyone has an equal say.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Focus on getting yourself across fast. Help others only if you have time left.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto2',
    prompt: 'In a group discussion, one person keeps interrupting and rejecting every point. The discussion is going in circles.',
    options: [
      { text: 'Calmly note the person\'s point, then sum up what has been said and ask a quiet member for their view.', weight: 'best', factors: ['Social Effectiveness', 'Planning & Organizing'] },
      { text: 'Argue back firmly against every point they reject, so the discussion does not stop.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Stay quiet and let that person control the discussion, to avoid conflict.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Stop taking part in the discussion until it settles down on its own.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto3',
    prompt: 'Your group has a budget and materials for a task. Halfway through, you see the plan will not work in the time left.',
    options: [
      { text: 'Quickly gather the group, explain the problem, and suggest a simpler plan that still meets the main goal.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Push the group to work faster on the same plan, since changing plans midway looks weak.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Wait for someone else to notice the problem and raise it first.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Give up on the task since it will clearly not succeed as planned.', weight: 'weak', factors: ['Dynamic Factor'] }
    ]
  },
  {
    id: 'gto4',
    prompt: 'You must lead two teammates through an obstacle you have already finished. One of them is struggling and holding up the whole team.',
    options: [
      { text: 'Break the obstacle into small steps, show them briefly, and encourage them while watching the time.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Tell them firmly to hurry up, since the team\'s score depends on speed.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Do the task for them so the team is not held up.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Move ahead with the rest of the team and leave them to catch up.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto5',
    prompt: 'Your group\'s final presentation is due. The person meant to present suddenly cannot, minutes before you go up.',
    options: [
      { text: 'Quickly agree, as a group, on who knows the material best, and give that person a fast briefing.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Volunteer to present yourself right away, without checking if someone else is better prepared.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Ask the evaluators for more time to sort things out.', weight: 'weak', factors: ['Planning & Organizing'] },
      { text: 'Present the material poorly rather than risk the delay of reorganising.', weight: 'weak', factors: ['Dynamic Factor'] }
    ]
  },
  {
    id: 'gto6',
    prompt: 'Your group is midway through an outdoor task when it starts raining heavily. There is no shelter nearby.',
    options: [
      { text: 'Quickly decide whether to continue, pause, or change the task, and tell the group your decision clearly.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Push the group to finish fast, no matter the weather.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Wait quietly for the evaluators to tell you what to do.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Focus only on keeping yourself dry and comfortable.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto7',
    prompt: 'In a group planning exercise, the group rejects your idea for a plan you think is weaker.',
    options: [
      { text: 'Share your concern once, with a clear reason, then fully commit to making the group\'s plan work well.', weight: 'best', factors: ['Social Adjustment', 'Planning & Organizing'] },
      { text: 'Keep pushing your own idea even after the group has already decided against it.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Go along with the plan, but put in very little effort since it was not your idea.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Openly criticise the chosen plan to other members while the group is doing it.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto8',
    prompt: 'You are the last one to finish an obstacle course, and the whole group is waiting for you.',
    options: [
      { text: 'Keep going at a steady, safe pace, focusing on finishing well rather than worrying about being watched.', weight: 'best', factors: ['Dynamic Factor'] },
      { text: 'Rush without care to catch up, even if it risks injury or mistakes.', weight: 'weak', factors: ['Dynamic Factor'] },
      { text: 'Skip the harder parts to save time.', weight: 'weak', factors: ['Dynamic Factor'] },
      { text: 'Ask the group to wait longer than they really need to.', weight: 'adequate', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto9',
    prompt: 'A new member joins your group midway through a task and does not know the plan.',
    options: [
      { text: 'Quickly explain the plan and give them a small, clear task to join in right away.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Tell them to just watch for now and join in once they understand.', weight: 'adequate', factors: ['Social Adjustment'] },
      { text: 'Ignore them and continue, since stopping to explain will slow the group down.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Let another group member decide what to do with the new person.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto10',
    prompt: 'Two members of your group start arguing loudly during a task, and it is affecting everyone\'s focus.',
    options: [
      { text: 'Calmly step in, ask both to pause the argument, and refocus the group on finishing the task.', weight: 'best', factors: ['Social Effectiveness', 'Planning & Organizing'] },
      { text: 'Raise your voice to get their attention and tell them to stop immediately.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Move away from the argument and keep working on your own part.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Wait for them to finish arguing before doing anything.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto11',
    prompt: 'Your group has completed a task early, and everyone is unsure what to do with the extra time.',
    options: [
      { text: 'Suggest the group double-check their work or help another group that is still struggling.', weight: 'best', factors: ['Planning & Organizing', 'Social Adjustment'] },
      { text: 'Suggest the group rest, since the task is already done.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Wait for someone else to suggest what to do next.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Use the time for yourself, separate from the group.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto12',
    prompt: 'During a task, you realise you misunderstood the instructions and have been doing it wrong.',
    options: [
      { text: 'Tell the group right away, admit the mistake, and quickly help fix what needs to change.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Quietly try to fix it yourself without telling anyone.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Hope nobody notices and continue as before.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Blame the instructions for being unclear instead of fixing the mistake.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto13',
    prompt: 'Your group must choose a leader for the next task, and two people (including you) want the role.',
    options: [
      { text: 'Suggest the group choose based on who is best suited for this specific task, even if it is not you.', weight: 'best', factors: ['Social Adjustment', 'Planning & Organizing'] },
      { text: 'Argue that you should lead because you have led before.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Stay silent and let the group decide without your input.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Refuse to work well if you are not chosen as leader.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto14',
    prompt: 'A teammate makes a joke at your expense in front of the group during a task.',
    options: [
      { text: 'Laugh it off calmly and keep the group focused on the task at hand.', weight: 'best', factors: ['Social Effectiveness', 'Dynamic Factor'] },
      { text: 'Make a sharp comment back to even the score.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Go quiet and stop contributing for the rest of the task.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Complain to the evaluators about the teammate.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto15',
    prompt: 'Your group is given very few resources for a task that clearly needs more.',
    options: [
      { text: 'Work with the group to plan how to use the limited resources as well as possible.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Push ahead with the task without changing the plan for the limited resources.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Complain about the lack of resources instead of starting the task.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Do only the part of the task the resources can easily cover, and ignore the rest.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto16',
    prompt: 'One group member keeps taking over every task, not letting others contribute.',
    options: [
      { text: 'Politely point out that others also have good ideas, and invite a quieter member to try a part of the task.', weight: 'best', factors: ['Social Effectiveness', 'Social Adjustment'] },
      { text: 'Compete with them to take over parts of the task yourself.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Let them continue, since arguing might slow the group down.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Complain about them to the rest of the group, without saying anything to them directly.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  }
];

// --- TAT / SDT — guided self-reflection (NOT scored) --------------------
// These are offered as structured reflection, benchmarked against example
// answers, never auto-scored — genuine TAT interpretation needs a trained
// psychologist reading it alongside live behavior. Each prompt has a simple
// abstract image (inline SVG, drawn to look like an ambiguous scene, in the
// spirit of a real TAT card) and a short plain-English guidance note.
export const tatPrompts = [
  {
    id: 'tat1',
    description: 'A person stands where a path splits into two: one way goes uphill into fog, the other goes downhill and is clear. Their bag looks heavy.',
    guidance: 'A good story usually has a main character, a reason for what they do, an action they take, and how it ends — not just a description of the picture.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#EFEBE3"/><path d="M150 200 L120 90 L60 20" stroke="#8B8378" stroke-width="4" fill="none"/><path d="M150 200 L150 90 L230 30" stroke="#8B8378" stroke-width="4" fill="none"/><circle cx="150" cy="72" r="18" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="140" y="88" width="20" height="45" fill="#3A3A3A"/><ellipse cx="128" cy="120" rx="10" ry="16" fill="#3A3A3A"/><ellipse cx="60" cy="30" rx="45" ry="18" fill="#D9D3C7" opacity="0.7"/><ellipse cx="90" cy="45" rx="55" ry="20" fill="#D9D3C7" opacity="0.6"/></svg>'
  },
  {
    id: 'tat2',
    description: 'A group of people stand around a car that has stopped working, on an empty road as the sky gets dark.',
    guidance: 'Notice if your story shows the character taking action and solving the problem, or just waiting for someone else to help.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#E4DED1"/><rect x="0" y="150" width="300" height="50" fill="#B8AF9C"/><rect x="90" y="120" width="90" height="35" rx="6" fill="#4A4A4A"/><circle cx="110" cy="158" r="10" fill="#2A2A2A"/><circle cx="160" cy="158" r="10" fill="#2A2A2A"/><circle cx="60" cy="110" r="10" fill="#3A3A3A"/><rect x="52" y="122" width="16" height="30" fill="#3A3A3A"/><circle cx="210" cy="112" r="10" fill="#3A3A3A"/><rect x="202" y="124" width="16" height="30" fill="#3A3A3A"/><rect x="0" y="0" width="300" height="70" fill="#5B5B76" opacity="0.5"/></svg>'
  },
  {
    id: 'tat3',
    description: 'A person sits alone at a desk covered in papers, looking at a clock on the wall.',
    guidance: 'Think about whether your story shows planning and follow-through, or shows the character stuck and unsure what to do.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#EDE7DA"/><rect x="40" y="120" width="120" height="10" fill="#7A6E5C"/><rect x="50" y="130" width="8" height="50" fill="#7A6E5C"/><rect x="142" y="130" width="8" height="50" fill="#7A6E5C"/><rect x="60" y="105" width="80" height="20" fill="#C9BFA8"/><circle cx="90" cy="90" r="14" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="82" y="104" width="16" height="35" fill="#3A3A3A"/><circle cx="230" cy="55" r="26" fill="none" stroke="#4A4A4A" stroke-width="4"/><line x1="230" y1="55" x2="230" y2="38" stroke="#4A4A4A" stroke-width="3"/><line x1="230" y1="55" x2="242" y2="60" stroke="#4A4A4A" stroke-width="3"/></svg>'
  },
  {
    id: 'tat4',
    description: 'Two people stand on opposite sides of a table. One is pointing at a document. The other has arms crossed.',
    guidance: 'Notice if the ending you write is worked out together, or if one side simply wins over the other.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#EFE9DC"/><rect x="70" y="130" width="160" height="10" fill="#7A6E5C"/><rect x="80" y="140" width="8" height="40" fill="#7A6E5C"/><rect x="212" y="140" width="8" height="40" fill="#7A6E5C"/><rect x="120" y="118" width="60" height="14" fill="#C9BFA8"/><circle cx="95" cy="95" r="14" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="87" y="109" width="16" height="30" fill="#3A3A3A"/><line x1="103" y1="115" x2="140" y2="122" stroke="#3A3A3A" stroke-width="4"/><circle cx="210" cy="95" r="14" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="196" y="109" width="28" height="30" fill="#3A3A3A"/></svg>'
  },
  {
    id: 'tat5',
    description: 'A person stands on a hill, looking down at a small village far below.',
    guidance: 'A useful story shows what the character wants and what they decide to do next, not just how the view looks.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#E7E0CF"/><path d="M0 130 L100 70 L180 130 Z" fill="#B7AD8E"/><circle cx="100" cy="60" r="13" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="92" y="72" width="16" height="30" fill="#3A3A3A"/><rect x="190" y="150" width="20" height="16" fill="#8C8368"/><rect x="220" y="155" width="18" height="14" fill="#8C8368"/><rect x="250" y="148" width="22" height="18" fill="#8C8368"/><line x1="0" y1="180" x2="300" y2="180" stroke="#A79B7C" stroke-width="2"/></svg>'
  },
  {
    id: 'tat6',
    description: 'A person stands in front of a closed door, while a small crowd waits behind them.',
    guidance: 'Think about whether the character in your story acts, waits, or asks for help — and why.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#EDE7DA"/><rect x="120" y="50" width="60" height="110" fill="#8B8378"/><circle cx="165" cy="105" r="4" fill="#3A3A3A"/><circle cx="145" cy="150" r="12" fill="none" stroke="#3A3A3A" stroke-width="4"/><rect x="139" y="162" width="12" height="25" fill="#3A3A3A"/><circle cx="55" cy="160" r="9" fill="#5A5A5A"/><rect x="49" y="169" width="12" height="18" fill="#5A5A5A"/><circle cx="80" cy="165" r="9" fill="#5A5A5A"/><rect x="74" y="174" width="12" height="16" fill="#5A5A5A"/></svg>'
  },
  {
    id: 'tat7',
    description: 'Two children play near a river, while an adult watches from a distance.',
    guidance: 'Consider what the adult and children in your story are each thinking, and what happens next.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#E6EEE9"/><rect x="0" y="140" width="300" height="60" fill="#8FB6C7"/><circle cx="100" cy="120" r="9" fill="#3A3A3A"/><rect x="94" y="129" width="12" height="20" fill="#3A3A3A"/><circle cx="130" cy="122" r="9" fill="#3A3A3A"/><rect x="124" y="131" width="12" height="20" fill="#3A3A3A"/><circle cx="240" cy="100" r="11" fill="#5A5A5A"/><rect x="233" y="111" width="14" height="30" fill="#5A5A5A"/></svg>'
  },
  {
    id: 'tat8',
    description: 'A person walks alone, away from a group, carrying a heavy bag.',
    guidance: 'A strong story explains why the character is leaving and what they plan to do.',
    svg: '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#EFEBE3"/><circle cx="80" cy="110" r="12" fill="#3A3A3A"/><rect x="72" y="122" width="16" height="35" fill="#3A3A3A"/><rect x="60" y="130" width="14" height="20" fill="#6B5B45"/><circle cx="210" cy="120" r="9" fill="#5A5A5A"/><rect x="204" y="129" width="12" height="24" fill="#5A5A5A"/><circle cx="235" cy="118" r="9" fill="#5A5A5A"/><rect x="229" y="127" width="12" height="24" fill="#5A5A5A"/><circle cx="260" cy="122" r="9" fill="#5A5A5A"/><rect x="254" y="131" width="12" height="24" fill="#5A5A5A"/></svg>'
  }
];

export const sdtPrompts = [
  { id: 'sdt_self', label: 'How would you describe yourself?', hint: 'Write 4-6 honest sentences. Include your strengths and real weak points, not just good things.' },
  { id: 'sdt_friend', label: 'How would your closest friend describe you?', hint: 'Write it the way they would actually say it, not the way you wish they would say it.' },
  { id: 'sdt_family', label: 'How would your parents or family describe you?', hint: 'Include at least one thing they think you should improve.' },
  { id: 'sdt_teacher', label: 'How would a teacher, coach, or manager describe you?', hint: 'Think of someone who has really seen your work or performance.' },
  { id: 'sdt_improve', label: 'What do you most need to improve, and what have you done about it so far?', hint: 'Being specific and honest is better than being vague and safe.' }
];

// --- Random subset helper (for per-attempt rotation) ---------------------
export function pickRandomSubset(array, count) {
  const pool = [...array];
  const picked = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// Builds one attempt's random item selection. Called once, at assessment
// creation, and stored on the assessment row so the same attempt always
// shows the same items (only a brand-new attempt gets a fresh draw).
export function buildItemSelection() {
  return {
    wat: pickRandomSubset(watWords, 40),
    srt: pickRandomSubset(srtSituations, 30),
    gto: pickRandomSubset(gtoScenarios.map((g) => g.id), 8),
    tat: pickRandomSubset(tatPrompts.map((t) => t.id), 4)
  };
}

// --- OLQ factor mapping ---------------------------------------------------
// Combines Big Five trait scores (reused from the wellness module),
// the 4 new trait scales above, and the WAT/GTO exercise scores into
// the 4 OLQ factors. Weights are deliberately simple/transparent (equal
// weighting within each factor) rather than a fitted model, since no public
// validated weighting exists for self-report-to-OLQ mapping.
const OLQ_FACTORS = {
  'Planning & Organizing': { personality: ['Conscientiousness', 'Openness'], traits: ['Achievement Motivation'], exercises: ['gto'] },
  'Social Adjustment': { personality: ['Agreeableness'], traits: ['Locus of Control', 'Social Maturity'], exercises: [] },
  'Social Effectiveness': { personality: ['Extraversion'], traits: ['Social Maturity'], exercises: ['wat', 'gto'] },
  'Dynamic Factor': { personality: ['Emotional Stability'], traits: ['Hardiness', 'Achievement Motivation'], exercises: ['gto'] }
};

const OLQ_LIST_BY_FACTOR = {
  'Planning & Organizing': ['Effective Intelligence', 'Reasoning Ability', 'Organizing Ability', 'Power of Expression'],
  'Social Adjustment': ['Cooperation', 'Sense of Responsibility', 'Initiative', 'Social Adjustment'],
  'Social Effectiveness': ['Social Effectiveness', 'Ability to Influence the Group', 'Liveliness', 'Group Cohesiveness'],
  'Dynamic Factor': ['Determination', 'Courage', 'Stamina', 'Self-Confidence']
};

export function traitScoreLabel(scoreOn5) {
  if (scoreOn5 >= 4) return 'Strength';
  if (scoreOn5 >= 3) return 'Developing';
  return 'Focus Area';
}

// Descriptive grade band (Grade I-V) — the same broad language SSB aspirants
// already use informally to talk about candidate quality. This is NOT the
// real DIPR/Board grading: that comes from three independently-trained
// assessors (psychologist, GTO, IO) cross-verifying live behavior across
// five days, which nothing self-reported can reproduce. This banding exists
// only to give the readiness index a familiar, honest label — it is
// re-stated as descriptive, not a real assessment, everywhere it's shown.
export function readinessGradeBand(readinessIndex) {
  if (readinessIndex >= 80) return { grade: 'Grade I', label: 'Very High Readiness' };
  if (readinessIndex >= 65) return { grade: 'Grade II', label: 'High Readiness' };
  if (readinessIndex >= 50) return { grade: 'Grade III', label: 'Above Average Readiness' };
  if (readinessIndex >= 35) return { grade: 'Grade IV', label: 'Average Readiness' };
  return { grade: 'Grade V', label: 'Needs Significant Development' };
}

/** Score the 20-item trait scale (0-5 per construct), same normalization as the wellness engine. */
export function calculateTraitScores(responses) {
  const scores = {};
  Object.keys(traitMapping).forEach((trait) => {
    const values = [];
    traitMapping[trait].forEach((qId) => {
      const item = traitItemBank.find((q) => q.id === qId);
      if (item && responses[qId] !== undefined && responses[qId] !== null) {
        let value = Number(responses[qId]);
        if (item.reverse) value = item.options.length - 1 - value;
        values.push((value / (item.options.length - 1)) * 5);
      }
    });
    scores[trait] = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 2.5;
  });
  return scores;
}

/** Scores GTO scenario choices (0-5 average, best=5, adequate=3, weak=1). `scenarioIds` is this attempt's drawn subset. */
export function scoreGTO(responses, scenarioIds = gtoScenarios.map((g) => g.id)) {
  const weightScore = { best: 5, adequate: 3, weak: 1 };
  const scenarios = scenarioIds.map((id) => gtoScenarios.find((g) => g.id === id)).filter(Boolean);
  const items = scenarios.map((scenario) => {
    const chosenIndex = responses?.[scenario.id];
    const chosen = typeof chosenIndex === 'number' ? scenario.options[chosenIndex] : null;
    return { id: scenario.id, chosen, score: chosen ? weightScore[chosen.weight] : null };
  });
  const answered = items.filter((i) => i.score !== null);
  return {
    items,
    answeredCount: answered.length,
    totalCount: scenarios.length,
    aggregate: answered.length ? Number((answered.reduce((s, i) => s + i.score, 0) / answered.length).toFixed(2)) : 0
  };
}

/**
 * Builds the full OLQ Readiness Profile from every input the candidate
 * provided: Big Five (reused wellness personality items), the 4 new trait
 * scales, WAT, and GTO. `itemSelection` is this attempt's drawn subset
 * (needed to score WAT/GTO correctly against only the items actually shown).
 * SRT/TAT/SDT are preserved for review but never auto-scored (see the module
 * header for why). Returns per-factor scores (0-5), per-OLQ labels, and one
 * disclaimer-bound composite readiness index (0-100) — a self-assessment
 * indicator, never a predicted outcome.
 */
export function calculateOLQProfile({ wellnessResponses, traitResponses, watResponses, gtoResponses, itemSelection }) {
  const personalityScores = calculatePersonalityScores(wellnessResponses || {}); // 0-5 per Big Five trait
  const traitScores = calculateTraitScores(traitResponses || {});                // 0-5 per new trait
  const watResult = scoreWAT(watResponses || {}, itemSelection?.wat || watWords);
  const gtoResult = scoreGTO(gtoResponses || {}, itemSelection?.gto || gtoScenarios.map((g) => g.id));

  const exerciseScores = { wat: watResult.aggregate, gto: gtoResult.aggregate };

  const factorScores = {};
  const factorDetail = {};
  Object.entries(OLQ_FACTORS).forEach(([factor, sources]) => {
    const values = [];
    sources.personality.forEach((p) => { if (personalityScores[p] !== undefined) values.push(personalityScores[p]); });
    sources.traits.forEach((t) => { if (traitScores[t] !== undefined) values.push(traitScores[t]); });
    sources.exercises.forEach((e) => { if (exerciseScores[e] > 0) values.push(exerciseScores[e]); });
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 2.5;
    factorScores[factor] = Number(avg.toFixed(2));
    factorDetail[factor] = {
      score: factorScores[factor],
      label: traitScoreLabel(factorScores[factor]),
      olqs: OLQ_LIST_BY_FACTOR[factor],
      contributingSources: { personality: sources.personality, traits: sources.traits, exercises: sources.exercises }
    };
  });

  const readinessIndex = Number((
    (Object.values(factorScores).reduce((a, b) => a + b, 0) / Object.values(factorScores).length) / 5 * 100
  ).toFixed(1));

  const weakestFactor = Object.entries(factorScores).sort((a, b) => a[1] - b[1])[0][0];
  const strongestFactor = Object.entries(factorScores).sort((a, b) => b[1] - a[1])[0][0];
  const gradeBand = readinessGradeBand(readinessIndex);

  return {
    personalityScores,
    traitScores,
    watResult,
    gtoResult,
    factorScores,
    factorDetail,
    readinessIndex,
    gradeBand,
    weakestFactor,
    strongestFactor,
    disclaimer: 'This Readiness Index and grade band are a self-assessment indicator based on your questionnaire and practice-exercise responses — a descriptive label, not an official DIPR or SSB Board grading. It is not a prediction of your actual SSB outcome: the real board evaluates live behavior over five days through three independently-trained assessors (psychologist, GTO, IO), which no self-report tool can replicate.'
  };
}

// --- Improvement plan generator -------------------------------------------
const IMPROVEMENT_LIBRARY = {
  'Planning & Organizing': [
    'Practice the GPE (Group Planning Exercise) format solo: read a scenario, write a plan with a clear priority order and time allocation, in under 10 minutes.',
    'Before answering an SRT situation, force yourself to write one sentence naming the actual problem before jumping to a solution.',
    'Read one short case study a day and summarize it in 3 bullet points — trains concise, organized expression.'
  ],
  'Social Adjustment': [
    'In your next group activity (college, work, sport), deliberately let someone else lead and note how you adapt.',
    'Practice giving one piece of constructive feedback a week to a peer, focusing on their interest, not just being right.',
    'Volunteer for a task nobody wants once this month, and reflect afterward on how you approached it.'
  ],
  'Social Effectiveness': [
    'Practice a 2-minute impromptu Lecturette on a random topic daily — builds comfort speaking to a group without notes.',
    'In group settings, practice summarizing what others said before adding your own point — builds influence through clarity, not volume.',
    'Join or start a small group activity (debate club, sport, discussion group) if you are not already in one — social effectiveness is trained through repeated group exposure, not solo reading.'
  ],
  'Dynamic Factor': [
    'Build a simple physical stamina routine (even 20-30 minutes daily) — SSB\'s outdoor tasks are physically demanding and composure under fatigue is part of what\'s assessed.',
    'Practice one small, deliberately uncomfortable thing daily (cold shower, public speaking, a hard conversation) to build tolerance for pressure.',
    'When a plan fails in practice, write down what you\'d do differently instead of dwelling on the failure — trains quick recovery.'
  ]
};

export function buildImprovementPlan(factorDetail) {
  return Object.entries(factorDetail)
    .sort((a, b) => a[1].score - b[1].score)
    .map(([factor, detail]) => ({
      factor,
      score: detail.score,
      label: detail.label,
      olqs: detail.olqs,
      actions: IMPROVEMENT_LIBRARY[factor] || []
    }));
}

// Builds a flat list of {id, text, answerText, answered} items across every
// SSB section, in the same shape admin.js's existing raw-response viewer
// already uses for wellness assessments — lets that one route branch by
// track without duplicating its rendering logic. `itemSelection` (if given)
// restricts WAT/SRT/GTO/TAT to the subset actually shown this attempt.
export function buildSsbResponseItems(responses = {}, itemSelection = null) {
  const items = [];
  const watList = itemSelection?.wat || watWords;
  const srtList = itemSelection?.srt || srtSituations;
  const gtoList = itemSelection?.gto ? itemSelection.gto.map((id) => gtoScenarios.find((g) => g.id === id)).filter(Boolean) : gtoScenarios;
  const tatList = itemSelection?.tat ? itemSelection.tat.map((id) => tatPrompts.find((t) => t.id === id)).filter(Boolean) : tatPrompts;

  bigFiveItems.forEach((q) => {
    const idx = responses.bigFive?.[q.id];
    items.push({ id: q.id, text: `[Trait Scale] ${q.text}`, answerText: idx !== undefined && idx !== null ? q.options[idx] : null, answered: idx !== undefined && idx !== null });
  });
  traitItemBank.forEach((q) => {
    const idx = responses.traits?.[q.id];
    items.push({ id: q.id, text: `[Trait Scale] ${q.text}`, answerText: idx !== undefined && idx !== null ? q.options[idx] : null, answered: idx !== undefined && idx !== null });
  });
  watList.forEach((word) => {
    const text = responses.wat?.[word];
    items.push({ id: `wat_${word}`, text: `[WAT] ${word}`, answerText: text || null, answered: !!text });
  });
  srtList.forEach((situation, i) => {
    const text = responses.srt?.[situation] ?? responses.srt?.[i];
    items.push({ id: `srt_${i}`, text: `[SRT] ${situation}`, answerText: text || null, answered: !!text });
  });
  gtoList.forEach((scenario) => {
    const chosenIndex = responses.gto?.[scenario.id];
    const chosen = typeof chosenIndex === 'number' ? scenario.options[chosenIndex] : null;
    items.push({ id: scenario.id, text: `[GTO] ${scenario.prompt}`, answerText: chosen ? chosen.text : null, answered: !!chosen });
  });
  tatList.forEach((p) => {
    const text = responses.tat?.[p.id];
    items.push({ id: p.id, text: `[TAT - reflection, not scored] ${p.description}`, answerText: text || null, answered: !!text });
  });
  sdtPrompts.forEach((p) => {
    const text = responses.sdt?.[p.id];
    items.push({ id: p.id, text: `[SDT - reflection, not scored] ${p.label}`, answerText: text || null, answered: !!text });
  });

  return items;
}

// --- SSB report packages (paid tiers) -------------------------------------
// Mirrors the wellness module's Discover/Explore/Navigate pattern (pick a
// package, then generate) — same PILOT_FREE_ACCESS pilot behavior applies in
// routes/ssb.js (auto-releases immediately while real payment collection
// isn't wired up), same idea of report depth scaling with the paid tier.
export const SSB_PLANS = {
  ssb_basic: {
    label: 'Readiness Snapshot',
    price: 2499,
    priceLabel: '₹2,499',
    desc: 'Your OLQ Readiness Index and a 4-factor breakdown — a quick, honest snapshot of where you stand today.',
    features: ['Readiness Index score', '4 OLQ factor scores', 'Strength & focus areas', 'Instant report'],
    counsellingSessions: 0
  },
  ssb_detailed: {
    label: 'Detailed Readiness Report',
    price: 4499,
    priceLabel: '₹4,499',
    desc: 'Everything in the Snapshot, plus a full improvement plan for every OLQ factor and one counselling session with a NavaSetu counsellor.',
    features: ['Everything in Readiness Snapshot', 'Full improvement plan (all 4 factors)', 'Specific practice actions', '1 counselling session'],
    counsellingSessions: 1
  },
  ssb_comprehensive: {
    label: 'Comprehensive Readiness + Coaching',
    price: 7999,
    priceLabel: '₹7,999',
    desc: 'The complete picture — everything in Detailed, plus extended, OLQ-by-OLQ suggestions and two counselling sessions to work through your plan.',
    features: ['Everything in Detailed Report', 'Extended, OLQ-by-OLQ suggestions', 'Priority scheduling', '2 counselling sessions'],
    counsellingSessions: 2
  }
};

// Deeper, OLQ-specific suggestions shown only in the Comprehensive tier —
// one level more specific than the IMPROVEMENT_LIBRARY actions above.
const EXTENDED_SUGGESTIONS = {
  'Planning & Organizing': [
    'Effective Intelligence: practice explaining a complex topic (from your field of study) to a 12-year-old in under 2 minutes — forces clarity of thought.',
    'Reasoning Ability: solve one logic/puzzle problem daily (train timetables, seating arrangements, data sufficiency) — builds structured thinking under time pressure.',
    'Organizing Ability: the next time you plan any event (even a small one), write the plan down first with time slots, before acting on it.',
    'Power of Expression: record yourself speaking for 2 minutes on a random topic, then listen back — most people are harsher critics of their own speech than they need to be, but it reveals filler words and unclear sentences fast.'
  ],
  'Social Adjustment': [
    'Cooperation: in your next group task, count how many times you ask others for their opinion versus stating your own — aim for at least equal.',
    'Sense of Responsibility: pick one recurring task (at home, college, or work) that nobody officially owns, and own it without being asked, for a month.',
    'Initiative: the next time you notice a small problem nobody is addressing, be the first to raise it AND propose a fix in the same breath.',
    'Social Adjustment: spend time with a group very different from your usual circle (different age, background, or interests) and notice how you adjust your communication style.'
  ],
  'Social Effectiveness': [
    'Ability to Influence the Group: practice making one point in a group discussion using a concrete example or number, rather than a general statement — specifics persuade more than opinions.',
    'Liveliness: notice your energy level in group settings this week — if you tend to hang back, practice speaking in the first two minutes of any group conversation.',
    'Group Cohesiveness: after your next group activity, ask one quieter member for their honest opinion privately — often reveals what the group missed.',
    'Social Effectiveness: read the room before speaking in a new group — spend the first few minutes observing who\'s already leading, then find where you can add value rather than compete for airtime.'
  ],
  'Dynamic Factor': [
    'Determination: pick one goal you have abandoned before and restart it this month, tracking progress daily, even in small increments.',
    'Courage: do one thing this week that you have been avoiding purely out of social discomfort (a difficult conversation, an ask, a correction).',
    'Stamina: build toward being able to do 30-45 minutes of continuous physical activity without needing to stop — SSB\'s outdoor tasks reward physical endurance directly.',
    'Self-Confidence: keep a small written log of things you did well each day, however minor — most self-confidence gaps come from selectively remembering only the failures.'
  ]
};

// --- Server-side report HTML (single source of truth) --------------------
// Builds the exact HTML the candidate sees, the HTML stored in `reports`,
// and the HTML an admin/counsellor opens in the HR Panel — all three are
// now guaranteed identical because they all come from this one function,
// called once at submit time. Nothing about the report is trusted from the
// client, closing the earlier gap where a candidate's own browser built the
// HTML that got stored as their official report.
const FACTOR_COLORS = {
  'Planning & Organizing': '#2563EB',
  'Social Adjustment': '#059669',
  'Social Effectiveness': '#D97706',
  'Dynamic Factor': '#DC2626'
};

export function buildSsbReportHtml(profile, improvementPlan, candidateName, planType = 'ssb_comprehensive') {
  const plan = SSB_PLANS[planType] || SSB_PLANS.ssb_comprehensive;
  const includesImprovementPlan = planType !== 'ssb_basic';
  const includesExtendedSuggestions = planType === 'ssb_comprehensive';

  const factorBars = Object.entries(profile.factorScores).map(([factor, score]) => `
    <div style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:0.3rem;">
        <span>${factor}</span><span>${score.toFixed(1)} / 5 — ${profile.factorDetail[factor].label}</span>
      </div>
      <div style="height:14px; background:#F3F4F6; border-radius:999px; overflow:hidden;">
        <div style="height:100%; border-radius:999px; width:${(score / 5) * 100}%; background:${FACTOR_COLORS[factor]};"></div>
      </div>
      <div style="color:#6B7280; font-size:0.85rem; margin-top:0.3rem;">OLQs: ${profile.factorDetail[factor].olqs.join(', ')}</div>
    </div>`).join('');

  const planHtml = improvementPlan.map((p) => `
    <div style="border-left:3px solid #5B21B6; padding:0.6rem 0 0.6rem 0.9rem; margin-bottom:0.9rem;">
      <h4 style="margin:0 0 0.3rem; font-size:0.98rem;">${p.factor} — ${p.label} (${p.score.toFixed(1)} / 5)</h4>
      <ul style="margin:0.4rem 0 0; padding-left:1.1rem; font-size:0.88rem; color:#374151;">${p.actions.map((a) => `<li>${a}</li>`).join('')}</ul>
    </div>`).join('');

  const extendedHtml = improvementPlan.map((p) => `
    <div style="border-left:3px solid #059669; padding:0.6rem 0 0.6rem 0.9rem; margin-bottom:0.9rem;">
      <h4 style="margin:0 0 0.3rem; font-size:0.98rem;">${p.factor}</h4>
      <ul style="margin:0.4rem 0 0; padding-left:1.1rem; font-size:0.88rem; color:#374151;">${(EXTENDED_SUGGESTIONS[p.factor] || []).map((a) => `<li>${a}</li>`).join('')}</ul>
    </div>`).join('');

  const counsellingHtml = plan.counsellingSessions > 0 ? `
    <div style="background:#F5F3FF; border:1px solid #DDD6FE; border-radius:8px; padding:1rem; font-size:0.88rem; color:#5B21B6; margin-top:1.25rem;">
      📞 Your ${plan.label} package includes ${plan.counsellingSessions} counselling session${plan.counsellingSessions > 1 ? 's' : ''} with a NavaSetu counsellor. They'll reach out to schedule ${plan.counsellingSessions > 1 ? 'these' : 'this'} directly.
    </div>` : '';

  const upsellHtml = planType !== 'ssb_comprehensive' ? `
    <div style="background:#fff; border:1px solid #E5E7EB; border-radius:10px; padding:1.75rem; margin-top:1.25rem;">
      <h2 style="margin-top:0;">Get More From Your Assessment</h2>
      ${planType === 'ssb_basic' ? `
        <p style="color:#6B7280; font-size:0.9rem;">This Readiness Snapshot shows you where you stand. The <strong>Detailed Readiness Report (₹4,499)</strong> adds a full improvement plan for every OLQ factor plus a counselling session to work through it with a NavaSetu counsellor.</p>` : ''}
      <p style="color:#6B7280; font-size:0.9rem;">The <strong>Comprehensive Readiness + Coaching package (₹7,999)</strong> adds extended, OLQ-by-OLQ suggestions and 2 counselling sessions — contact NavaSetu to upgrade.</p>
    </div>` : '';

  return `<div style="font-family:Inter,Arial,sans-serif; color:#1F2937;">
    <div style="background:#fff; border:1px solid #E5E7EB; border-radius:10px; padding:1.75rem; margin-bottom:1.25rem;">
      <h2 style="margin-top:0;">OLQ Readiness Profile${candidateName ? ` — ${candidateName}` : ''}</h2>
      <div style="display:inline-block; background:#F5F3FF; color:#5B21B6; font-size:0.78rem; font-weight:600; padding:0.25rem 0.7rem; border-radius:999px; margin-bottom:0.5rem;">${plan.label} (${plan.priceLabel})</div>
      <p style="font-size:2.2rem; font-weight:700; color:${FACTOR_COLORS[profile.strongestFactor]}; margin:0.25rem 0;">${profile.readinessIndex} / 100</p>
      <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem;">
        <span style="background:#EEF2FF; color:#4338CA; font-weight:700; font-size:0.95rem; padding:0.3rem 0.8rem; border-radius:8px;">${profile.gradeBand.grade}</span>
        <span style="color:#374151; font-size:0.92rem;">${profile.gradeBand.label}</span>
      </div>
      <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:1rem; font-size:0.85rem; color:#92400E; margin:1rem 0;">${profile.disclaimer}</div>
      ${factorBars}
      ${counsellingHtml}
    </div>
    ${includesImprovementPlan ? `
    <div style="background:#fff; border:1px solid #E5E7EB; border-radius:10px; padding:1.75rem; margin-bottom:1.25rem;">
      <h2 style="margin-top:0;">Improvement Plan</h2>
      <p style="color:#6B7280; font-size:0.88rem;">Ordered from your most to least developed area — start with the top one.</p>
      ${planHtml}
    </div>` : ''}
    ${includesExtendedSuggestions ? `
    <div style="background:#fff; border:1px solid #E5E7EB; border-radius:10px; padding:1.75rem; margin-bottom:1.25rem;">
      <h2 style="margin-top:0;">Extended Suggestions — OLQ by OLQ</h2>
      <p style="color:#6B7280; font-size:0.88rem;">Deeper, more specific practice ideas for each factor, on top of your improvement plan above.</p>
      ${extendedHtml}
    </div>` : ''}
    ${upsellHtml}
  </div>`;
}
