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

import { questionBank as wellnessQuestionBank, personalityMapping, calculatePersonalityScores } from './scoring.js';

const LIKERT_5 = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

// The 20 Mini-IPIP Big Five items already licensed for this codebase
// (scoring.js), re-exported read-only for the SSB flow to render as part of
// its own trait battery. Nothing here modifies scoring.js or its exports —
// this is a pure filter/re-export.
export const bigFiveItems = wellnessQuestionBank.filter((q) => q.category === 'Personality');

// --- Trait scale item bank (original items, 5 new constructs x 5 items) ---
export const traitItemBank = [
  // Locus of Control (Internal) — belief that outcomes follow from one's own
  // effort and decisions rather than luck or external forces. Maps to
  // initiative/responsibility (Social Adjustment).
  { id: 'loc1', text: 'What happens to me in the long run is mostly a result of my own actions.', category: 'Locus of Control', options: LIKERT_5, reverse: false },
  { id: 'loc2', text: 'When something goes wrong for me, it is usually because of factors outside my control.', category: 'Locus of Control', options: LIKERT_5, reverse: true },
  { id: 'loc3', text: 'If I plan carefully and work at it, I can usually make things turn out the way I want.', category: 'Locus of Control', options: LIKERT_5, reverse: false },
  { id: 'loc4', text: 'Getting a good outcome mostly depends on being at the right place at the right time.', category: 'Locus of Control', options: LIKERT_5, reverse: true },
  { id: 'loc5', text: 'I take responsibility for my mistakes rather than blaming circumstances.', category: 'Locus of Control', options: LIKERT_5, reverse: false },

  // Achievement Motivation — drive for excellence, goal persistence,
  // competitive orientation. Maps to determination (Dynamic Factor) and
  // organizing ability (Planning & Organizing).
  { id: 'ach1', text: 'I set myself clear, challenging goals and track my progress toward them.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach2', text: 'I tend to give up on a task once it stops being easy.', category: 'Achievement Motivation', options: LIKERT_5, reverse: true },
  { id: 'ach3', text: 'I feel genuinely driven to do better than I did last time, not just to get by.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach4', text: 'I am comfortable putting in sustained effort over months for a distant goal.', category: 'Achievement Motivation', options: LIKERT_5, reverse: false },
  { id: 'ach5', text: 'Once the novelty of a goal wears off, my interest in pursuing it fades quickly.', category: 'Achievement Motivation', options: LIKERT_5, reverse: true },

  // Hardiness / Stress Tolerance — commitment, sense of control, and viewing
  // difficulty as a challenge rather than a threat. Maps to stamina and
  // courage (Dynamic Factor).
  { id: 'hrd1', text: 'Under pressure, I can usually stay composed enough to think clearly.', category: 'Hardiness', options: LIKERT_5, reverse: false },
  { id: 'hrd2', text: 'Unexpected setbacks tend to rattle me for a long time before I can refocus.', category: 'Hardiness', options: LIKERT_5, reverse: true },
  { id: 'hrd3', text: 'I see a difficult, demanding situation more as a challenge to work through than a threat to avoid.', category: 'Hardiness', options: LIKERT_5, reverse: false },
  { id: 'hrd4', text: 'Physical discomfort or fatigue quickly makes me want to quit what I am doing.', category: 'Hardiness', options: LIKERT_5, reverse: true },
  { id: 'hrd5', text: 'I can keep going and stay functional even when I am tired, uncomfortable, or under scrutiny.', category: 'Hardiness', options: LIKERT_5, reverse: false },

  // Social Maturity / Cooperation — willingness to subordinate personal
  // preference to group welfare, non-egocentric group behavior. Maps to
  // cooperation and group cohesiveness (Social Adjustment + Effectiveness).
  { id: 'soc1', text: 'In a group task, I actively make room for quieter members to contribute.', category: 'Social Maturity', options: LIKERT_5, reverse: false },
  { id: 'soc2', text: 'I find it hard to accept a group decision once it goes against what I proposed.', category: 'Social Maturity', options: LIKERT_5, reverse: true },
  { id: 'soc3', text: 'I am comfortable letting someone else lead if they are better suited to the task at hand.', category: 'Social Maturity', options: LIKERT_5, reverse: false },
  { id: 'soc4', text: 'When working with others, I tend to focus mainly on getting credit for my own contribution.', category: 'Social Maturity', options: LIKERT_5, reverse: true },
  { id: 'soc5', text: 'I adjust my communication style depending on who I am working with.', category: 'Social Maturity', options: LIKERT_5, reverse: false }
];

export const traitMapping = {
  'Locus of Control': ['loc1', 'loc2', 'loc3', 'loc4', 'loc5'],
  'Achievement Motivation': ['ach1', 'ach2', 'ach3', 'ach4', 'ach5'],
  'Hardiness': ['hrd1', 'hrd2', 'hrd3', 'hrd4', 'hrd5'],
  'Social Maturity': ['soc1', 'soc2', 'soc3', 'soc4', 'soc5']
};

// --- Word Association Test (WAT) practice set --------------------------
// 40 stimulus words spanning common SSB WAT themes. A candidate writes the
// first sentence a word brings to mind, in a few seconds, without deliberating.
export const watWords = [
  'Fear', 'Failure', 'Death', 'Leader', 'Duty', 'Discipline', 'Mistake', 'Weakness',
  'Courage', 'Team', 'Responsibility', 'Danger', 'Enemy', 'Competition', 'Rules',
  'Sacrifice', 'Betrayal', 'Crisis', 'Plan', 'Challenge', 'Confidence', 'Friend',
  'Family', 'Money', 'Power', 'Victory', 'Defeat', 'Risk', 'Cooperation', 'Honesty',
  'Pressure', 'Decision', 'Goal', 'Obstacle', 'Crowd', 'Injury', 'Time', 'Orders',
  'Unknown', 'Trust'
];

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
 * Scores a full WAT set (word -> sentence map). Returns per-word feedback
 * plus an aggregate 0-5 score, clearly heuristic (word/theme matching), not
 * a substitute for a trained assessor's read of projective content.
 */
export function scoreWAT(responses) {
  const items = watWords.map((word) => {
    const text = responses?.[word] || '';
    const scored = scoreFreeTextItem(text);
    return { word, text, ...scored };
  });
  const answered = items.filter((i) => i.text.trim());
  const avg = (key) => answered.length ? answered.reduce((s, i) => s + i[key], 0) / answered.length : 0;
  return {
    items,
    answeredCount: answered.length,
    totalCount: watWords.length,
    aggregate: Number((((avg('spontaneity') + avg('positivity') + avg('constructiveness')) / 3)).toFixed(2))
  };
}

// --- Situation Reaction Test (SRT) practice set -------------------------
// 40 original everyday/mild-stress situations across common SRT themes:
// leadership, group welfare, resourcefulness, ethics, and crisis response.
export const srtSituations = [
  'You are travelling with three friends when your vehicle breaks down in a remote area at night.',
  'You notice a junior colleague taking credit for work you both did together, in front of your manager.',
  'A group project is falling behind schedule because two members are not pulling their weight.',
  'You are put in charge of a team for the first time and one senior member resents reporting to you.',
  'While hiking with a group, one member gets injured and the nearest help is several hours away.',
  'You realize halfway through a test that you misread the instructions and have wasted valuable time.',
  'A close friend asks you to cover for them about something you do not agree with.',
  'You are the only one in your group who notices a safety hazard others are ignoring.',
  'Your team loses an important match/competition due to a decision you made.',
  'You are asked to lead a group of people much older and more experienced than you.',
  'Money meant for a group activity goes missing and suspicion falls on an innocent member.',
  'You must deliver bad news to a team that has been working hard toward a goal.',
  'A stranger asks for help in an emergency while you are already late for something important.',
  'Two of your close friends have a serious disagreement and both want you to take their side.',
  'You are blamed for a mistake that was actually caused by unclear instructions from above.',
  'Your group is lost and running low on supplies during an outdoor expedition.',
  'A younger sibling or junior looks up to you but is copying a bad habit of yours.',
  'You discover a factual error in a report just minutes before it is due to be submitted.',
  'Someone in authority asks you to do something that conflicts with your personal values.',
  'You are the newest member of a team that already has its own way of doing things.',
  'A group member keeps dismissing every idea in a discussion without offering alternatives.',
  'You must motivate a demoralized team after a public setback.',
  'You witness an accident on the road and are the first person at the scene.',
  'You are given a task with unclear objectives and a tight deadline.',
  'A close friend is spreading a rumor about someone that you know is false.',
  'You have to work with someone you strongly dislike to complete an urgent task.',
  'Your plans for an important day are disrupted by an unexpected family emergency.',
  'A group decision is made that you privately think is a mistake.',
  'You are asked to mediate a dispute between two friends who are both partly right.',
  'While representing your group in public, you are asked a question you don\'t know the answer to.',
  'You find out a competitor is spreading misinformation about your team\'s work.',
  'Everyone in your group wants to quit a difficult task except you.',
  'You have limited resources to help everyone in a group that all need the same thing.',
  'A person you are mentoring makes the same mistake you warned them about.',
  'You are held responsible for a decision that was actually made by the whole group.',
  'Your team must choose between a safer, slower plan and a riskier, faster one.',
  'A person confides a serious personal problem to you and swears you to secrecy.',
  'You are asked to volunteer for an unpleasant task nobody else wants.',
  'You realize a plan you strongly supported is not going to work partway through execution.',
  'You have to give honest, critical feedback to someone who is emotionally invested in their work.'
];

// --- GTO-style situational judgment scenarios ----------------------------
// Written analogs of Group Discussion / Group Planning / Command Task
// dynamics. Each option is tagged with the OLQ factor(s) it reflects and a
// quality weight (best/adequate/weak) used by the scorer below.
export const gtoScenarios = [
  {
    id: 'gto1',
    prompt: 'Your group of eight has 10 minutes to cross a "river" using two planks and a rope, and two members are visibly hesitant and slowing the group down. What do you do?',
    options: [
      { text: 'Quickly assign roles based on people\'s strengths, reassure the hesitant members with a clear simple task, and keep the group moving on a plan.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Take charge and give firm orders, telling the hesitant members to just follow along and not slow things down.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Let the group figure it out on its own since everyone has an equal say and you don\'t want to overstep.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Focus on getting yourself across efficiently and help others only if you have time left.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto2',
    prompt: 'During a group discussion, one member keeps interrupting and dismissing every point others make, and the discussion is going in circles.',
    options: [
      { text: 'Calmly acknowledge the member\'s point, then redirect by summarizing what\'s been said and asking a quieter member for their view.', weight: 'best', factors: ['Social Effectiveness', 'Planning & Organizing'] },
      { text: 'Argue back firmly to counter every dismissive comment so the discussion doesn\'t stall.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Stay quiet and let the dominant member run the discussion since pushing back might cause conflict.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Disengage from the discussion until it naturally settles down.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto3',
    prompt: 'You are given a group task with a budget and materials, but halfway through you realize the original plan won\'t work in the time left.',
    options: [
      { text: 'Quickly gather the group, explain what\'s not working, and propose a revised, simpler plan that still meets the core objective.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Push the group to work faster on the original plan since changing plans midway looks indecisive.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Wait for someone else to notice and raise the issue first.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Abandon the task since it\'s clearly not going to succeed as planned.', weight: 'weak', factors: ['Dynamic Factor'] }
    ]
  },
  {
    id: 'gto4',
    prompt: 'In a command task, you must lead two subordinates through an obstacle you have already completed yourself, but one of them is struggling and holding up the whole team.',
    options: [
      { text: 'Break the obstacle into smaller steps, demonstrate briefly, and give specific encouragement while keeping an eye on the time.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Tell them firmly to hurry up since the team\'s score depends on speed.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Do the task for them so the team isn\'t held up.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Move ahead with the rest of the team and leave the struggling member to catch up.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto5',
    prompt: 'Your group\'s final presentation is due and the person meant to present is suddenly unable to, minutes before you go up.',
    options: [
      { text: 'Quickly agree as a group on who should step in based on who knows the material best, and give them a fast briefing.', weight: 'best', factors: ['Planning & Organizing', 'Social Effectiveness'] },
      { text: 'Volunteer to present yourself immediately without checking who else might be better prepared.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Ask the evaluators for more time to sort it out.', weight: 'weak', factors: ['Planning & Organizing'] },
      { text: 'Present the material poorly rather than risk the delay of reorganizing.', weight: 'weak', factors: ['Dynamic Factor'] }
    ]
  },
  {
    id: 'gto6',
    prompt: 'While your group is midway through an outdoor task, it starts raining heavily and there is no shelter nearby.',
    options: [
      { text: 'Quickly assess whether to continue, pause, or adapt the task, and communicate a clear decision to the group.', weight: 'best', factors: ['Planning & Organizing', 'Dynamic Factor'] },
      { text: 'Push the group to finish as fast as possible regardless of conditions.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Wait passively for instructions from the evaluators before doing anything.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Focus only on keeping yourself dry and comfortable.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto7',
    prompt: 'In a group planning exercise, your idea is rejected in favor of a plan you think is weaker.',
    options: [
      { text: 'Voice your concern once with a clear reason, then commit fully to executing the group\'s chosen plan well.', weight: 'best', factors: ['Social Adjustment', 'Planning & Organizing'] },
      { text: 'Keep pushing your own idea even after the group has decided against it.', weight: 'adequate', factors: ['Dynamic Factor'] },
      { text: 'Go along with the group plan but put in minimal effort since it wasn\'t your idea.', weight: 'weak', factors: ['Social Adjustment'] },
      { text: 'Openly criticize the chosen plan to other group members during execution.', weight: 'weak', factors: ['Social Adjustment'] }
    ]
  },
  {
    id: 'gto8',
    prompt: 'You are the last one to finish an individual obstacle course and the whole group is waiting on you.',
    options: [
      { text: 'Keep going at a controlled, steady pace, focusing on finishing safely rather than panicking about being watched.', weight: 'best', factors: ['Dynamic Factor'] },
      { text: 'Rush recklessly to catch up, risking injury or mistakes.', weight: 'weak', factors: ['Dynamic Factor'] },
      { text: 'Give up on the harder obstacles to save time.', weight: 'weak', factors: ['Dynamic Factor'] },
      { text: 'Ask the group to slow down and wait longer than necessary.', weight: 'adequate', factors: ['Social Adjustment'] }
    ]
  }
];

// --- TAT / SDT — guided self-reflection (NOT scored) --------------------
// These are offered as structured reflection, benchmarked against example
// answers, never auto-scored — genuine TAT/SDT interpretation needs a
// trained psychologist reading it alongside live behavior.
export const tatPrompts = [
  { id: 'tat1', description: 'A young person stands at a fork in a path, one way leading uphill through fog, the other downhill and clear. Their bag looks heavy.', guidance: 'A strong response usually names a hero, a clear motive, a decisive action, and a resolved outcome — not just a description of the scene.' },
  { id: 'tat2', description: 'A group of people stand around a broken-down vehicle on an empty road as the sky darkens.', guidance: 'Notice whether your story shows initiative and problem-solving, or leaves the outcome to chance/rescue by someone else.' },
  { id: 'tat3', description: 'A person sits alone at a desk covered in papers, looking at a clock on the wall.', guidance: 'Consider whether your story reflects planning and follow-through, or drift and indecision.' },
  { id: 'tat4', description: 'Two figures stand on opposite sides of a table, one pointing at a document, the other with arms crossed.', guidance: 'Notice whether the resolution you write is collaborative and constructive, or purely one-sided.' }
];

export const sdtPrompts = [
  { id: 'sdt_self', label: 'How would you describe yourself?', hint: 'Aim for 4-6 honest sentences — strengths and real limitations, not just a highlight reel.' },
  { id: 'sdt_friend', label: 'How would your closest friend describe you?', hint: 'Write it as they would say it, in their words, not how you wish they\'d say it.' },
  { id: 'sdt_family', label: 'How would your parents/family describe you?', hint: 'Include at least one thing they\'d say you should work on.' },
  { id: 'sdt_teacher', label: 'How would a teacher, coach, or manager describe you?', hint: 'Think of someone who has actually evaluated your work or performance.' },
  { id: 'sdt_improve', label: 'What do you think you most need to improve, and what have you done about it so far?', hint: 'Specific and honest beats vague and safe.' }
];

// --- OLQ factor mapping ---------------------------------------------------
// Combines Big Five trait scores (reused from the wellness module),
// the 4 new trait scales above, and the WAT/SRT/GTO exercise scores into
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

/** Scores GTO scenario choices (0-5 average, best=5, adequate=3, weak=1). */
export function scoreGTO(responses) {
  const weightScore = { best: 5, adequate: 3, weak: 1 };
  const items = gtoScenarios.map((scenario) => {
    const chosenIndex = responses?.[scenario.id];
    const chosen = typeof chosenIndex === 'number' ? scenario.options[chosenIndex] : null;
    return { id: scenario.id, chosen, score: chosen ? weightScore[chosen.weight] : null };
  });
  const answered = items.filter((i) => i.score !== null);
  return {
    items,
    answeredCount: answered.length,
    totalCount: gtoScenarios.length,
    aggregate: answered.length ? Number((answered.reduce((s, i) => s + i.score, 0) / answered.length).toFixed(2)) : 0
  };
}

/**
 * Builds the full OLQ Readiness Profile from every input the candidate
 * provided: Big Five (reused wellness personality items), the 4 new trait
 * scales, WAT, SRT (SRT itself isn't separately scored — it's practice
 * feedback only, see scoreWAT's heuristic reused for consistency), and GTO.
 * Returns per-factor scores (0-5), per-OLQ labels, and one disclaimer-bound
 * composite readiness index (0-100). This index is explicitly a self-
 * assessment indicator, not a predicted outcome — the report and UI must
 * always show it with that framing.
 */
export function calculateOLQProfile({ wellnessResponses, traitResponses, watResponses, gtoResponses }) {
  const personalityScores = calculatePersonalityScores(wellnessResponses || {}); // 0-5 per Big Five trait
  const traitScores = calculateTraitScores(traitResponses || {});                // 0-5 per new trait
  const watResult = scoreWAT(watResponses || {});                                 // 0-5 aggregate
  const gtoResult = scoreGTO(gtoResponses || {});                                 // 0-5 aggregate

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

  return {
    personalityScores,
    traitScores,
    watResult,
    gtoResult,
    factorScores,
    factorDetail,
    readinessIndex,
    weakestFactor,
    strongestFactor,
    disclaimer: 'This Readiness Index is a self-assessment indicator based on your questionnaire and practice-exercise responses. It is not a prediction of your actual SSB outcome — the real board evaluates live behavior over five days through trained assessors, which no self-report tool can replicate.'
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

// Builds a flat list of {id, text, answerText, answered} items across every
// SSB section, in the same shape admin.js's existing raw-response viewer
// already uses for wellness assessments — lets that one route branch by
// track without duplicating its rendering logic.
export function buildSsbResponseItems(responses = {}) {
  const items = [];

  bigFiveItems.forEach((q) => {
    const idx = responses.bigFive?.[q.id];
    items.push({ id: q.id, text: `[Trait Scale] ${q.text}`, answerText: idx !== undefined && idx !== null ? q.options[idx] : null, answered: idx !== undefined && idx !== null });
  });
  traitItemBank.forEach((q) => {
    const idx = responses.traits?.[q.id];
    items.push({ id: q.id, text: `[Trait Scale] ${q.text}`, answerText: idx !== undefined && idx !== null ? q.options[idx] : null, answered: idx !== undefined && idx !== null });
  });
  watWords.forEach((word) => {
    const text = responses.wat?.[word];
    items.push({ id: `wat_${word}`, text: `[WAT] ${word}`, answerText: text || null, answered: !!text });
  });
  srtSituations.forEach((situation, i) => {
    const text = responses.srt?.[i];
    items.push({ id: `srt_${i}`, text: `[SRT] ${situation}`, answerText: text || null, answered: !!text });
  });
  gtoScenarios.forEach((scenario) => {
    const chosenIndex = responses.gto?.[scenario.id];
    const chosen = typeof chosenIndex === 'number' ? scenario.options[chosenIndex] : null;
    items.push({ id: scenario.id, text: `[GTO] ${scenario.prompt}`, answerText: chosen ? chosen.text : null, answered: !!chosen });
  });
  tatPrompts.forEach((p) => {
    const text = responses.tat?.[p.id];
    items.push({ id: p.id, text: `[TAT - reflection, not scored] ${p.description}`, answerText: text || null, answered: !!text });
  });
  sdtPrompts.forEach((p) => {
    const text = responses.sdt?.[p.id];
    items.push({ id: p.id, text: `[SDT - reflection, not scored] ${p.label}`, answerText: text || null, answered: !!text });
  });

  return items;
}

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
