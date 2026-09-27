// NavaSetu SSB OLQ Readiness Module — Scoring Engine
//
// IMPORTANT — what this module is and isn't:
// The actual SSB (Services Selection Board) assesses candidates through five
// days of live observation by three independently-trained assessors (a
// psychologist, a Group Testing Officer, and an Interviewing Officer) who
// cross-verify projective test responses (WAT/SRT/SDT) against real
// behavior in group tasks and a personal interview. No published, validated
// model exists that maps self-report scores to a true pass/fail probability,
// and nothing here claims to replicate psychologist-grade projective test
// interpretation. This module instead produces an honest "OLQ Readiness
// Profile": where a candidate's self-reported traits and practice-exercise
// patterns sit relative to the 15 Officer-Like Qualities, plus a clearly
// disclaimed composite index — never a predicted outcome.
//
// The 15 OLQs (per the Officer-Like Qualities framework used in Services
// Selection Board assessments) are grouped into 4 factors:
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

// --- SDT — guided self-reflection (NOT scored) ---------------------------
// Offered as structured reflection, benchmarked against example answers,
// never auto-scored. (The TAT/picture-story exercise that used to live here
// has been removed from the SSB test altogether — both the full assessment
// and the free teaser — per product decision; only SDT remains as the
// guided-reflection exercise.)
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
    gto: pickRandomSubset(gtoScenarios.map((g) => g.id), 8)
  };
}

// --- Free "teaser" funnel test --------------------------------------------
// A deliberately small, ungated exercise (8 trait items + 4 SRT situations +
// 6 WAT words) shown to visitors who aren't ready to commit to the full
// assessment. It exists to give a curious visitor something in a few minutes
// and a nudge toward the paid plans — NOT a measurement instrument. Its
// scoring is intentionally separate from calculateOLQProfile/
// readinessGradeBand (different function names, different label set) so the
// two are never confused with each other or presented as equivalent. A fresh
// call to buildTeaserSelection draws a new random subset every time, so a
// repeat visitor always gets new questions. (The TAT/picture-story exercise
// that used to appear here has been removed altogether — see the SDT
// comment above — and replaced with more trait/SRT/WAT coverage instead.)
export function buildTeaserSelection() {
  return {
    traits: pickRandomSubset(traitItemBank, 8),
    srt: pickRandomSubset(srtSituations, 4),
    wat: pickRandomSubset(watWords, 6)
  };
}

function teaserWordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Crude engagement-depth heuristic — rewards a thought-out response over a
// one-word one. Not a content/quality judgment (nothing here reads for
// substance), purely a proxy for "did they actually engage with the prompt."
function teaserDepthScore(text) {
  const words = teaserWordCount(text);
  if (words >= 25) return 100;
  if (words >= 12) return 70;
  if (words >= 5) return 40;
  if (words >= 1) return 15;
  return 0;
}

// Deliberately different label set from readinessGradeBand's Grade I-V, so a
// teaser result is never mistaken for the real Readiness Index/grade band.
export function teaserGradeBand(score) {
  if (score >= 75) return { label: 'Strong Early Indicators' };
  if (score >= 55) return { label: 'Promising — Needs Sharpening' };
  if (score >= 35) return { label: 'Foundational Work Needed' };
  return { label: 'Just Getting Started' };
}

// Computes a quick 0-100 snapshot from the trait Likert answers (60% weight)
// plus word-count-based engagement depth averaged across every SRT/WAT
// free-text response supplied (40% weight). Explicitly NOT the OLQ
// Readiness Index — a much shorter, cruder read whose only job is to give a
// free-test taker *something* honest while making obvious that the real
// profile needs the full battery. `srtTexts`/`watTexts` are arrays (the
// teaser now shows more than one of each), so this also replaces the old
// single-srtText/single-tatText version of this function.
export function computeTeaserScore({ traitItems, traitResponses, srtTexts, watTexts }) {
  const traitValues = traitItems
    .map((item) => {
      let value = Number(traitResponses[item.id]);
      if (Number.isNaN(value)) return null;
      if (item.reverse) value = (item.options.length - 1) - value;
      return (value / (item.options.length - 1)) * 100;
    })
    .filter((v) => v !== null);
  const traitPct = traitValues.length ? traitValues.reduce((a, b) => a + b, 0) / traitValues.length : 50;

  const depthTexts = [...(srtTexts || []), ...(watTexts || [])];
  const depthScores = depthTexts.map(teaserDepthScore);
  const depthPct = depthScores.length ? depthScores.reduce((a, b) => a + b, 0) / depthScores.length : 0;

  const score = Math.round(0.6 * traitPct + 0.4 * depthPct);
  return { score: Math.max(0, Math.min(100, score)), gradeBand: teaserGradeBand(score) };
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
// real Services Selection Board grading: that comes from three independently-trained
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
    disclaimer: 'This Readiness Index and grade band are a self-assessment indicator based on your questionnaire and practice-exercise responses — a psychometric depiction, not an official Services Selection Board grading or prediction of your actual SSB outcome. The real Board evaluates live behavior over five days through three independently-trained assessors (a psychologist, a Group Testing Officer, and an Interviewing Officer), a far more intensive process than any self-report tool can replicate.'
  };
}

// Short, honest interpretation of what a factor score practically indicates
// for SSB-style performance — shown alongside every factor bar, in every
// tier (including the Snapshot), so even the entry-level report is more than
// just a number and a bar. Keyed by traitScoreLabel's three bands.
const FACTOR_INTERPRETATION = {
  'Planning & Organizing': {
    Strength: 'You tend to think in structured, prioritized steps and express plans clearly — a real asset in Group Planning Exercises and structured interview questions.',
    Developing: 'You can usually put together a workable plan, but may skip prioritization or leave gaps under time pressure — worth deliberate practice before your SSB.',
    'Focus Area': 'Plans may currently come across unstructured or rushed. This is one of the most practice-responsive OLQ clusters — see the actions below.'
  },
  'Social Adjustment': {
    Strength: 'You read group dynamics well and adapt without losing your own position — valuable across GTO tasks and the personal interview.',
    Developing: 'You cooperate reasonably well but may hold back from taking ownership or initiative unless directly asked.',
    'Focus Area': 'Group settings may feel effortful right now, or you may default to over-asserting or staying quiet. Both are workable with consistent practice.'
  },
  'Social Effectiveness': {
    Strength: 'You communicate with energy and influence group direction constructively — assessors weigh this heavily in the Lecturette and group discussions.',
    Developing: 'You participate but may not consistently lead or land your points — a common, very fixable gap.',
    'Focus Area': 'You may currently find it hard to hold the floor or influence a group discussion. This responds well to repeated, low-stakes practice.'
  },
  'Dynamic Factor': {
    Strength: 'You show resilience, follow-through, and composure under pressure — exactly what the outdoor/physical tasks and the interview are designed to surface.',
    Developing: 'You generally push through setbacks but may need a more consistent stamina/confidence routine.',
    'Focus Area': 'Composure and follow-through under pressure look like an area to build deliberately, both physically and mentally, before your SSB.'
  }
};

// --- Improvement plan generator -------------------------------------------
const IMPROVEMENT_LIBRARY = {
  'Planning & Organizing': [
    'Practice the GPE (Group Planning Exercise) format solo: read a scenario, write a plan with a clear priority order and time allocation, in under 10 minutes.',
    'Before answering an SRT situation, force yourself to write one sentence naming the actual problem before jumping to a solution.',
    'Read one short case study a day and summarize it in 3 bullet points — trains concise, organized expression.',
    'Once a week, take a real decision you made (even a small one) and write out the 2-3 options you actually had — trains the habit of seeing alternatives before committing.',
    'Time yourself solving a short logical/planning puzzle in under 5 minutes — builds the speed-with-structure combination SSB planning tasks reward.'
  ],
  'Social Adjustment': [
    'In your next group activity (college, work, sport), deliberately let someone else lead and note how you adapt.',
    'Practice giving one piece of constructive feedback a week to a peer, focusing on their interest, not just being right.',
    'Volunteer for a task nobody wants once this month, and reflect afterward on how you approached it.',
    'When you disagree with a group decision, practice voicing the disagreement calmly and once, then supporting the team\'s final call — shows adjustment without losing conviction.',
    'Keep a short weekly note of one moment you adapted your behavior for a group\'s benefit, and one moment you did not but could have.'
  ],
  'Social Effectiveness': [
    'Practice a 2-minute impromptu Lecturette on a random topic daily — builds comfort speaking to a group without notes.',
    'In group settings, practice summarizing what others said before adding your own point — builds influence through clarity, not volume.',
    'Join or start a small group activity (debate club, sport, discussion group) if you are not already in one — social effectiveness is trained through repeated group exposure, not solo reading.',
    'After a group conversation, ask yourself honestly: did people build on what I said, or talk past it? Adjust how you phrase your next point accordingly.',
    'Practice disagreeing with an idea (not a person) out loud in a low-stakes setting — most people under-practice this and either avoid it or make it personal.'
  ],
  'Dynamic Factor': [
    'Build a simple physical stamina routine (even 20-30 minutes daily) — SSB\'s outdoor tasks are physically demanding and composure under fatigue is part of what\'s assessed.',
    'Practice one small, deliberately uncomfortable thing daily (cold shower, public speaking, a hard conversation) to build tolerance for pressure.',
    'When a plan fails in practice, write down what you\'d do differently instead of dwelling on the failure — trains quick recovery.',
    'Set one genuinely difficult personal goal this month with a visible tracker — determination is assessed by what you actually finish, not what you intend.',
    'Practice staying outwardly calm for 60 seconds the next time something frustrates you before responding — a small, repeatable composure drill.'
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
// restricts WAT/SRT/GTO to the subset actually shown this attempt.
export function buildSsbResponseItems(responses = {}, itemSelection = null) {
  const items = [];
  const watList = itemSelection?.wat || watWords;
  const srtList = itemSelection?.srt || srtSituations;
  const gtoList = itemSelection?.gto ? itemSelection.gto.map((id) => gtoScenarios.find((g) => g.id === id)).filter(Boolean) : gtoScenarios;

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
    desc: 'Your OLQ Readiness Index and a 4-factor breakdown, with a plain-English interpretation of what each factor score means for you — a quick, honest snapshot of where you stand today.',
    features: ['Readiness Index score', '4 OLQ factor scores + interpretation', 'Strength & focus areas', 'Instant report'],
    counsellingSessions: 0
  },
  ssb_detailed: {
    label: 'Detailed Readiness Report',
    price: 4499,
    priceLabel: '₹4,499',
    desc: 'Everything in the Snapshot, plus a full, expanded improvement plan (5 practice actions per factor) for every OLQ factor and one counselling session with a NavaSetu counsellor.',
    features: ['Everything in Readiness Snapshot', 'Expanded improvement plan (5 actions per factor)', 'Specific practice actions', '1 counselling session'],
    counsellingSessions: 1
  },
  ssb_comprehensive: {
    label: 'Comprehensive Readiness + Coaching',
    price: 7999,
    priceLabel: '₹7,999',
    desc: 'The complete picture — everything in Detailed, plus a full breakdown of all 16 individual OLQs (not just the 4 factors) with 2 specific practice actions for each one, and two counselling sessions to work through your plan.',
    features: ['Everything in Detailed Report', 'All 16 OLQs broken down individually', '2 practice actions per OLQ', 'Priority scheduling', '2 counselling sessions'],
    counsellingSessions: 2
  }
};

// Deeper, per-OLQ suggestions shown only in the Comprehensive (top) tier —
// two concrete actions per individual OLQ (not just per factor), one level
// more specific than the IMPROVEMENT_LIBRARY factor-level actions above.
// Keyed by the exact OLQ label used in OLQ_LIST_BY_FACTOR, so the report can
// render every one of the OLQs individually with its own heading, under its
// parent factor.
const OLQ_ACTIONS = {
  'Effective Intelligence': [
    'Practice explaining a complex topic (from your field of study) to a 12-year-old in under 2 minutes — forces clarity of thought.',
    'When you read a news article, pause and summarize the core issue and the two strongest opposing views in three sentences — trains fast, structured comprehension.'
  ],
  'Reasoning Ability': [
    'Solve one logic/puzzle problem daily (train timetables, seating arrangements, data sufficiency) — builds structured thinking under time pressure.',
    'Before accepting a claim (in the news, from a friend, anywhere), ask yourself what evidence would prove it wrong — trains the habit of testing conclusions, not just reaching them.'
  ],
  'Organizing Ability': [
    'The next time you plan any event (even a small one), write the plan down first with time slots, before acting on it.',
    'Practice breaking a vague goal ("get fit", "clear this topic") into 3 concrete, dated sub-steps before starting on it.'
  ],
  'Power of Expression': [
    'Record yourself speaking for 2 minutes on a random topic, then listen back — most people are harsher critics of their own speech than they need to be, but it reveals filler words and unclear sentences fast.',
    'Practice saying the same point in one sentence, then in three — trains you to scale your explanation to the time you actually have.'
  ],
  'Cooperation': [
    'In your next group task, count how many times you ask others for their opinion versus stating your own — aim for at least equal.',
    'Practice building explicitly on someone else\'s idea in a discussion ("adding to what X said...") instead of only presenting your own separately.'
  ],
  'Sense of Responsibility': [
    'Pick one recurring task (at home, college, or work) that nobody officially owns, and own it without being asked, for a month.',
    'When something under your watch goes wrong, practice stating what you will do differently before explaining why it happened — order signals ownership.'
  ],
  'Initiative': [
    'The next time you notice a small problem nobody is addressing, be the first to raise it AND propose a fix in the same breath.',
    'Set yourself a rule: if you think of a good idea in a meeting or group chat, say it within the next two minutes rather than waiting to be sure it\'s "worth it."'
  ],
  'Social Adjustment': [
    'Spend time with a group very different from your usual circle (different age, background, or interests) and notice how you adjust your communication style.',
    'Practice adjusting your tone (not your substance) when moving between a formal setting and a casual one in the same day, and notice how deliberate it feels.'
  ],
  'Social Effectiveness': [
    'Read the room before speaking in a new group — spend the first few minutes observing who\'s already leading, then find where you can add value rather than compete for airtime.',
    'After a group interaction, note one thing that landed well and one that didn\'t — treat social effectiveness as a trainable skill with feedback, not a fixed trait.'
  ],
  'Ability to Influence the Group': [
    'Practice making one point in a group discussion using a concrete example or number, rather than a general statement — specifics persuade more than opinions.',
    'Notice which group members people tend to agree with, and study what they do differently in how they phrase and time their points.'
  ],
  'Liveliness': [
    'Notice your energy level in group settings this week — if you tend to hang back, practice speaking in the first two minutes of any group conversation.',
    'Practice reacting visibly (not performatively) to what others say — a nod, a follow-up question — low energy often reads as disengagement even when you\'re listening closely.'
  ],
  'Group Cohesiveness': [
    'After your next group activity, ask one quieter member for their honest opinion privately — often reveals what the group missed.',
    'Practice naming and crediting a specific contribution someone else made in a group task — small, consistent recognition strengthens group cohesion more than any single grand gesture.'
  ],
  'Determination': [
    'Pick one goal you have abandoned before and restart it this month, tracking progress daily, even in small increments.',
    'When motivation dips midway through something, commit in advance to a fixed minimum ("at least 10 minutes") rather than deciding in the moment whether to continue.'
  ],
  'Courage': [
    'Do one thing this week that you have been avoiding purely out of social discomfort (a difficult conversation, an ask, a correction).',
    'Practice stating an unpopular but honest opinion in a low-stakes group setting, calmly and without over-explaining or apologizing for it.'
  ],
  'Stamina': [
    'Build toward being able to do 30-45 minutes of continuous physical activity without needing to stop — SSB\'s outdoor tasks reward physical endurance directly.',
    'Practice finishing tasks you find tedious in one sitting rather than breaking them up — builds mental stamina alongside the physical kind.'
  ],
  'Self-Confidence': [
    'Keep a small written log of things you did well each day, however minor — most self-confidence gaps come from selectively remembering only the failures.',
    'Before a task you\'re nervous about, prepare one sentence on why you\'re reasonably qualified to attempt it — a small, honest confidence anchor beats generic positive thinking.'
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

export function buildSsbReportHtml(profile, improvementPlan, candidateName, planType = 'ssb_comprehensive', isTest = false) {
  // TEST REPORT banner — shown top and bottom for the pilot "Fill Sample"
  // flow only. Purely additive: it never overlaps or replaces any report
  // content, so nothing becomes illegible.
  const testBanner = isTest ? `
    <div style="background:#DC2626; color:#fff; text-align:center; font-weight:700; font-size:0.92rem; padding:0.75rem 1rem; border-radius:8px; margin-bottom:1.25rem; letter-spacing:0.2px;">
      🧪 TEST REPORT — Sample data generated for pilot review. This is not a real candidate assessment.
    </div>` : '';
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
      <div style="color:#374151; font-size:0.85rem; margin-top:0.45rem; line-height:1.5;">${(FACTOR_INTERPRETATION[factor] && FACTOR_INTERPRETATION[factor][profile.factorDetail[factor].label]) || ''}</div>
    </div>`).join('');

  const planHtml = improvementPlan.map((p) => `
    <div style="border-left:3px solid #5B21B6; padding:0.6rem 0 0.6rem 0.9rem; margin-bottom:0.9rem;">
      <h4 style="margin:0 0 0.3rem; font-size:0.98rem;">${p.factor} — ${p.label} (${p.score.toFixed(1)} / 5)</h4>
      <ul style="margin:0.4rem 0 0; padding-left:1.1rem; font-size:0.88rem; color:#374151;">${p.actions.map((a) => `<li>${a}</li>`).join('')}</ul>
    </div>`).join('');

  // Comprehensive tier only: every one of the OLQs under this factor gets
  // its own heading + 2 concrete actions from OLQ_ACTIONS (not just a
  // factor-level list) — this is the "all OLQs, individually" breakdown.
  const extendedHtml = improvementPlan.map((p) => `
    <div style="border-left:3px solid #059669; padding:0.6rem 0 0.6rem 0.9rem; margin-bottom:1.1rem;">
      <h4 style="margin:0 0 0.5rem; font-size:0.98rem;">${p.factor}</h4>
      ${(p.olqs || []).map((olq) => `
        <div style="margin-bottom:0.7rem;">
          <div style="font-weight:600; font-size:0.88rem; color:#065F46;">${olq}</div>
          <ul style="margin:0.25rem 0 0; padding-left:1.1rem; font-size:0.86rem; color:#374151;">${(OLQ_ACTIONS[olq] || []).map((a) => `<li>${a}</li>`).join('')}</ul>
        </div>`).join('')}
    </div>`).join('');

  const counsellingHtml = plan.counsellingSessions > 0 ? `
    <div style="background:#F5F3FF; border:1px solid #DDD6FE; border-radius:8px; padding:1rem; font-size:0.88rem; color:#5B21B6; margin-top:1.25rem;">
      📞 Your ${plan.label} package includes ${plan.counsellingSessions} counselling session${plan.counsellingSessions > 1 ? 's' : ''} with a NavaSetu counsellor. They'll reach out to schedule ${plan.counsellingSessions > 1 ? 'these' : 'this'} directly.
    </div>` : '';

  // "Unlock More Insights" — same visual/functional pattern as the wellness
  // Explore/Navigate upgrade cards in index.html: a white card per tier still
  // above the candidate's current one, a bullet feature list, the price, and
  // a button that calls the client-side upgradeSsbPlan(planKey) — which shows
  // a differential-price confirmation (matching wellness's app.upgradePlan)
  // and then calls POST /ssb/assessments/:id/upgrade-report to regenerate the
  // report at the new tier immediately (same PILOT_FREE_ACCESS pilot logic).
  const TIER_ORDER = ['ssb_basic', 'ssb_detailed', 'ssb_comprehensive'];
  const currentTierIndex = TIER_ORDER.indexOf(planType);
  const higherTiers = currentTierIndex >= 0 ? TIER_ORDER.slice(currentTierIndex + 1) : [];
  const TIER_BORDER_COLOR = { ssb_detailed: '#5B21B6', ssb_comprehensive: '#059669' };

  const upsellHtml = higherTiers.length ? `
    <div style="background:#FEF9E7; border-top:3px solid #5B21B6; margin-top:1.25rem; padding-top:1.75rem;">
      <h2 style="margin-top:0; margin-bottom:1.25rem;">Unlock More Insights</h2>
      ${higherTiers.map((tierKey) => {
        const tier = SSB_PLANS[tierKey];
        return `
        <div style="background:#fff; padding:1.5rem; border-radius:8px; border:2px solid ${TIER_BORDER_COLOR[tierKey] || '#5B21B6'}; margin-bottom:1.5rem;">
          <h3 style="margin-top:0; color:#1F2937;">Upgrade to ${tier.label}</h3>
          <p style="color:#6B7280; margin-bottom:1rem; font-size:0.9rem;">${tier.desc}</p>
          <ul style="margin:0 0 1rem 1.25rem; padding:0; color:#374151; font-size:0.88rem; line-height:1.8;">
            ${tier.features.map((f) => `<li>${f}</li>`).join('')}
          </ul>
          <div style="display:flex; gap:1rem; align-items:center; margin-bottom:0.5rem;">
            <span style="font-size:1.2rem; font-weight:700; color:#5B21B6;">${tier.priceLabel}</span>
          </div>
          <button onclick="upgradeSsbPlan('${tierKey}')" style="background:#5B21B6; color:#fff; border:none; padding:0.7rem 1.4rem; border-radius:8px; cursor:pointer; font-size:0.92rem; font-weight:600; margin-top:0.5rem;">💳 Upgrade to ${tier.label}</button>
        </div>`;
      }).join('')}
    </div>` : '';

  return `<div style="font-family:Inter,Arial,sans-serif; color:#1F2937;">
    ${testBanner}
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
      <h2 style="margin-top:0;">Every Officer-Like Quality, Individually</h2>
      <p style="color:#6B7280; font-size:0.88rem;">All 16 OLQs broken out one by one (not just the 4 factors above), each with two concrete practice actions — on top of your improvement plan above.</p>
      ${extendedHtml}
    </div>` : ''}
    ${upsellHtml}
    ${testBanner}
  </div>`;
}
