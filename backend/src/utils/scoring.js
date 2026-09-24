// NavaSetu Teacher Wellness Assessment — Scoring Engine
// AUTO-GENERATED to stay byte-identical with navasetu_report_reference_v2_FIXED.html
// Do not hand-edit questionBank/parameterMapping here without also updating
// the reference HTML (and vice versa) — they must always match exactly,
// since the reference file is the source of truth for question wording,
// answer-option ordering, and the reverse-scoring flags.
//
// Scoring rule (must match report.html's calculateScores() exactly):
//   value = reverse ? (options.length - 1 - rawIndex) : rawIndex
//   normalized = (value / (options.length - 1)) * 5
// A fully "healthy" answer set scores 5.00 on every parameter; a fully
// "unhealthy" answer set scores 0.00 on every parameter. Verified via
// simulation on 2026-09-24 after fixing the reverse-flag polarity bug
// (46 of 53 questions had it backwards).

export const questionBank = [
                // GHQ-12 SECTION (12 items)
                { id: 'q1', text: 'How often have you been able to concentrate on what you\'re doing?', category: 'Emotional Well-being', options: ['Better than usual', 'Same as usual', 'Less than usual', 'Much less than usual'], reverse: true },
                { id: 'q2', text: 'How often have you lost much sleep over worry?', category: 'Emotional Well-being', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q3', text: 'Have you felt that you are playing a useful part in things?', category: 'Work Fulfillment', options: ['More so than usual', 'Same as usual', 'Less useful than usual', 'Much less useful'], reverse: true },
                { id: 'q4', text: 'Have you felt capable of making decisions about things?', category: 'Inner Strength', options: ['More capable', 'As capable as usual', 'Less capable', 'Much less capable'], reverse: true },
                { id: 'q5', text: 'How often do you feel constantly under strain or overwhelmed?', category: 'Emotional Well-being', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q6', text: 'Have you felt that you couldn\'t overcome your difficulties?', category: 'Inner Strength', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q7', text: 'Have you been able to enjoy your day-to-day activities?', category: 'Emotional Well-being', options: ['More than usual', 'Same as usual', 'Less than usual', 'Much less than usual'], reverse: true },
                { id: 'q8', text: 'How well do you manage to cope with difficulties in your work?', category: 'Inner Strength', options: ['Much better', 'Better than usual', 'About as usual', 'Worse than usual'], reverse: true },
                { id: 'q9', text: 'Have you felt anxious or worried for no good reason?', category: 'Emotional Well-being', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q10', text: 'Have you felt unhappy or depressed?', category: 'Emotional Well-being', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q11', text: 'Have you lost confidence in yourself?', category: 'Inner Strength', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },
                { id: 'q12', text: 'Have you thought of yourself as a worthless person?', category: 'Emotional Well-being', options: ['Not at all', 'No more than usual', 'Rather more than usual', 'Much more than usual'], reverse: true },

                // MBI-ES & Additional (32 more items for 44 total)
                { id: 'q13', text: 'How often do you feel emotionally drained by your work?', category: 'Emotional Well-being', options: ['Never', 'A few times a year', 'Monthly', 'Weekly', 'Daily'], reverse: true },
                { id: 'q14', text: 'How often do you feel fatigued at the end of a working day?', category: 'Emotional Well-being', options: ['Never', 'A few times a year', 'Monthly', 'Weekly', 'Daily'], reverse: true },
                { id: 'q15', text: 'Working with people all day is really a strain for me.', category: 'Emotional Well-being', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: true },
                { id: 'q16', text: 'How frustrated or angry do you feel about your work?', category: 'Emotional Well-being', options: ['Not at all', 'Slightly', 'Moderately', 'Quite a bit', 'Extremely'], reverse: true },
                { id: 'q17', text: 'How much do you care about your students as individuals?', category: 'Work Fulfillment', options: ['Extremely', 'Quite a bit', 'Moderately', 'Slightly', 'Not at all'], reverse: true },
                { id: 'q18', text: 'Do you feel you treat some students as if they were impersonal objects?', category: 'Work Fulfillment', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], reverse: true },
                { id: 'q19', text: 'How much have you accomplished in your teaching role?', category: 'Work Fulfillment', options: ['Extremely', 'Quite a bit', 'Moderately', 'Slightly', 'Not at all'], reverse: true },
                { id: 'q20', text: 'How concerned are you about whether you\'re suited for teaching?', category: 'Work Fulfillment', options: ['Not at all', 'Slightly', 'Moderately', 'Quite a bit', 'Extremely'], reverse: true },
                { id: 'q21', text: 'Do you feel burned out from your work?', category: 'Work Fulfillment', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], reverse: true },
                { id: 'q22', text: 'I feel like I\'m working too hard in my job.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: true },
                { id: 'q23', text: 'I\'ve become more irritable because of my work.', category: 'Emotional Well-being', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], reverse: true },
                { id: 'q24', text: 'I feel I\'m at the end of my rope with my teaching work.', category: 'Work Fulfillment', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], reverse: true },
                { id: 'q25', text: 'I wonder if my work is making a positive difference.', category: 'Work Fulfillment', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], reverse: true },
                { id: 'q26', text: 'How effectively can you manage student behavioral issues?', category: 'Work Environment', options: ['Not effectively', 'Somewhat', 'Moderately', 'Effectively', 'Very effectively'], reverse: false },
                { id: 'q27', text: 'I am confident in my ability to manage difficult classroom situations.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q28', text: 'I feel capable of handling most challenges in teaching.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q29', text: 'I can successfully overcome obstacles in my teaching career.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q30', text: 'I can think of multiple ways to achieve my teaching goals.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q31', text: 'There are many ways I can succeed as a teacher.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q32', text: 'I am energized to pursue my professional goals in teaching.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q33', text: 'I bounce back quickly from setbacks in my teaching.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q34', text: 'I can recover quickly when faced with difficulties at work.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q35', text: 'I learn from setbacks and move forward.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q36', text: 'I am optimistic about my future as a teacher.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q37', text: 'Good things will continue to happen in my teaching career.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q38', text: 'I see my future in teaching as positive and promising.', category: 'Inner Strength', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q39', text: 'How clear are your roles and responsibilities?', category: 'Work Environment', options: ['Very unclear', 'Unclear', 'Neutral', 'Clear', 'Very clear'], reverse: false },
                { id: 'q40', text: 'How adequately resourced is your school for effective teaching?', category: 'Work Environment', options: ['Very inadequate', 'Inadequate', 'Moderate', 'Adequate', 'Very adequate'], reverse: false },
                { id: 'q41', text: 'How manageable are your class sizes and student ratios?', category: 'Work Environment', options: ['Very unmanageable', 'Unmanageable', 'Neutral', 'Manageable', 'Very manageable'], reverse: false },
                { id: 'q42', text: 'To what extent do administrative tasks burden you beyond teaching?', category: 'Work Environment', options: ['Not at all', 'Slightly', 'Moderately', 'Quite a bit', 'Extremely'], reverse: true },
                { id: 'q43', text: 'How well can you implement different teaching strategies in your classroom?', category: 'Work Fulfillment', options: ['Not well', 'Somewhat', 'Moderately well', 'Well', 'Very well'], reverse: false },
                { id: 'q44', text: 'How effectively can you explain concepts and lessons clearly?', category: 'Work Fulfillment', options: ['Not effectively', 'Somewhat', 'Moderately', 'Effectively', 'Very effectively'], reverse: false },

                // ENHANCED: Additional items for single-parameter dimensions (9 new questions for improved reliability)
                // Clarity of Roles & Expectations - Additional Items (q45, q46, q47)
                { id: 'q45', text: 'I understand what my administrator expects from me as a teacher.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q46', text: 'I am clear about the boundaries between my teaching responsibilities and other roles.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q47', text: 'Success in my role is clearly defined, and I know what I need to achieve.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },

                // Adequacy of Resources - Additional Items (q48, q49, q50)
                { id: 'q48', text: 'I have access to professional development opportunities that support my growth.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q49', text: 'Support services and resources for students with special needs are adequately available.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q50', text: 'Technology and teaching aids available in my school support effective instruction.', category: 'Work Environment', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },

                // Work-Life Boundary - Additional Items (q51, q52, q53)
                { id: 'q51', text: 'I can effectively "switch off" from work thoughts and concerns after school hours.', category: 'Work-Life Balance', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q52', text: 'Work responsibilities do not regularly intrude into my weekends and holidays.', category: 'Work-Life Balance', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false },
                { id: 'q53', text: 'I am able to take time off without guilt or worry about work piling up.', category: 'Work-Life Balance', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'], reverse: false }
];

export const parameterMapping = {
            'Emotional Energy Levels': ['q1', 'q13', 'q14', 'q15'],
            'Mental Clarity & Focus': ['q1', 'q7', 'q9'],
            'Rest & Sleep Quality': ['q2', 'q14'],
            'Sense of Impact': ['q3', 'q17', 'q25'],
            'Teaching Effectiveness': ['q43', 'q44', 'q26'],
            'Connection with Students': ['q17', 'q18'],
            'Sense of Achievement': ['q19', 'q25'],
            'Problem-Solving Ability': ['q4', 'q8', 'q28'],
            'Ability to Bounce Back from Setbacks': ['q6', 'q33', 'q34', 'q35'],
            'Confidence in Handling Difficulties': ['q4', 'q27', 'q28'],
            'Adaptability to Change': ['q8', 'q31', 'q35'],
            'Outlook for the Future': ['q36', 'q37', 'q38'],
            'Institutional Support': ['q3', 'q40'],
            'Clarity of Roles & Expectations': ['q39', 'q45', 'q46', 'q47'],  // ENHANCED: 4 items (was 1)
            'Adequacy of Resources': ['q40', 'q48', 'q49', 'q50'],  // ENHANCED: 4 items (was 1)
            'Manageable Workload': ['q22', 'q41', 'q42'],
            'Work-Life Boundary': ['q5', 'q51', 'q52', 'q53'],  // ENHANCED: 4 items (was 1)
            'Overall Balance Satisfaction': ['q5']
};

export const dimensionMapping = {
  'Emotional Well-being': ['Emotional Energy Levels', 'Mental Clarity & Focus', 'Rest & Sleep Quality'],
  'Work Fulfillment & Impact': ['Sense of Impact', 'Teaching Effectiveness', 'Connection with Students', 'Sense of Achievement'],
  'Inner Strength & Resilience': ['Problem-Solving Ability', 'Ability to Bounce Back from Setbacks', 'Confidence in Handling Difficulties', 'Adaptability to Change', 'Outlook for the Future'],
  'Work Environment & Support System': ['Institutional Support', 'Clarity of Roles & Expectations', 'Adequacy of Resources', 'Manageable Workload'],
  'Work-Life Balance': ['Work-Life Boundary', 'Overall Balance Satisfaction']
};

/**
 * Compute per-parameter scores (0-5 scale) from a responses map of question id to answer index.
 * Any question missing a response is simply skipped for that parameter's average;
 * if a parameter ends up with zero answered items it defaults to 3.0 (neutral).
 */
export function calculateScores(responses) {
  const scores = {};

  Object.keys(parameterMapping).forEach((param) => {
    const values = [];
    parameterMapping[param].forEach((qId) => {
      const question = questionBank.find((q) => q.id === qId);
      if (question && responses[qId] !== undefined && responses[qId] !== null) {
        let value = Number(responses[qId]);
        if (question.reverse) {
          const maxOptions = question.options.length - 1;
          value = maxOptions - value;
        }
        const normalized = (value / (question.options.length - 1)) * 5;
        values.push(normalized);
      }
    });
    scores[param] = values.length > 0
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
      : 3.0;
  });

  return scores;
}

/** Average a set of parameter scores into their parent dimension scores. */
export function calculateDimensionScores(parameterScores) {
  const dimensionScores = {};
  Object.keys(dimensionMapping).forEach((dim) => {
    const params = dimensionMapping[dim].map((p) => parameterScores[p]).filter((v) => v !== undefined);
    dimensionScores[dim] = params.length > 0
      ? Number((params.reduce((a, b) => a + b, 0) / params.length).toFixed(2))
      : 3.0;
  });
  return dimensionScores;
}

/** True once every question in the bank has an answer in the responses map. */
export function isComplete(responses) {
  return questionBank.every((q) => responses[q.id] !== undefined && responses[q.id] !== null);
}

export function unansweredQuestionIds(responses) {
  return questionBank.filter((q) => responses[q.id] === undefined || responses[q.id] === null).map((q) => q.id);
}
