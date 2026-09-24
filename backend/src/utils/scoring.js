// Teacher Wellness Assessment Scoring Logic
// 53 questions mapped to 18 parameters across 5 dimensions

// Question reverse-scoring map
const reverseScoredQuestions = {
  q1: true, q3: true, q4: true, q7: true, q8: true,
  q17: true, q18: false, q19: true, q26: true, q27: true,
  q28: true, q31: true, q33: true, q34: true, q35: true,
  q36: true, q37: true, q38: true, q39: true, q40: true,
  q43: true, q44: true, q45: true, q46: true, q47: true,
  q48: true, q49: true, q50: true, q51: true, q52: true, q53: true
};

// Parameter mapping: which questions contribute to each parameter
const parameterMapping = {
  // Emotional Well-being (4 parameters)
  'Emotional Energy Levels': ['q1', 'q13', 'q14', 'q15'],
  'Mental Clarity & Focus': ['q1', 'q7', 'q9'],
  'Rest & Sleep Quality': ['q2', 'q14'],
  'Emotional Stability': ['q5', 'q9', 'q10', 'q12', 'q16', 'q23'],

  // Work Fulfillment (5 parameters)
  'Sense of Impact': ['q3', 'q17', 'q25'],
  'Teaching Effectiveness': ['q26', 'q43', 'q44'],
  'Connection with Students': ['q17', 'q18'],
  'Sense of Achievement': ['q19', 'q25'],
  'Burnout Indicators': ['q20', 'q21', 'q24'],

  // Inner Strength (5 parameters)
  'Problem-Solving Ability': ['q4', 'q8', 'q28'],
  'Ability to Bounce Back': ['q6', 'q33', 'q34', 'q35'],
  'Confidence in Handling Difficulties': ['q4', 'q27', 'q28'],
  'Outlook for the Future': ['q36', 'q37', 'q38'],
  'Hope & Goal Pathways': ['q29', 'q30', 'q31', 'q32'],
  'Resilience & Adaptability': ['q8', 'q31', 'q35'],

  // Work Environment & Support System (4 parameters)
  'Institutional Support': ['q3', 'q40'],
  'Clarity of Roles & Expectations': ['q39', 'q45', 'q46', 'q47'],
  'Adequacy of Resources': ['q40', 'q48', 'q49', 'q50'],
  'Manageable Workload': ['q22', 'q41', 'q42'],

  // Work-Life Balance (2 parameters)
  'Work-Life Boundary': ['q5', 'q51', 'q52', 'q53'],
  'Overall Balance Satisfaction': ['q5']
};

// Dimension groupings
const dimensionMapping = {
  'Emotional Well-being': [
    'Emotional Energy Levels',
    'Mental Clarity & Focus',
    'Rest & Sleep Quality',
    'Emotional Stability'
  ],
  'Work Fulfillment': [
    'Sense of Impact',
    'Teaching Effectiveness',
    'Connection with Students',
    'Sense of Achievement',
    'Burnout Indicators'
  ],
  'Inner Strength': [
    'Problem-Solving Ability',
    'Ability to Bounce Back',
    'Confidence in Handling Difficulties',
    'Outlook for the Future',
    'Hope & Goal Pathways',
    'Resilience & Adaptability'
  ],
  'Work Environment & Support System': [
    'Institutional Support',
    'Clarity of Roles & Expectations',
    'Adequacy of Resources',
    'Manageable Workload'
  ],
  'Work-Life Balance': [
    'Work-Life Boundary',
    'Overall Balance Satisfaction'
  ]
};

// Normalize score to 0-5 scale
function normalizeScore(value, isReverse = false) {
  // Assuming input is 0-4 or 0-5 range, normalize to 0-5
  // If reverse scored, invert the value
  let normalized = (value / 4) * 5; // Assuming 0-4 scale input

  if (isReverse) {
    normalized = 5 - normalized;
  }

  return Math.min(5, Math.max(0, normalized)); // Clamp to 0-5
}

// Calculate parameter score (average of contributing questions)
function calculateParameterScore(questionIds, responses) {
  const scores = questionIds
    .filter(qId => responses[qId] !== undefined)
    .map(qId => {
      const rawScore = parseFloat(responses[qId]);
      const isReverse = reverseScoredQuestions[qId] === true;
      return normalizeScore(rawScore, isReverse);
    });

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Calculate all scores
export function calculateWellnessScores(responses) {
  const parameters = {};
  const dimensions = {};

  // Calculate parameter scores
  for (const [paramName, questionIds] of Object.entries(parameterMapping)) {
    parameters[paramName] = calculateParameterScore(questionIds, responses);
  }

  // Calculate dimension scores
  for (const [dimName, paramNames] of Object.entries(dimensionMapping)) {
    const paramScores = paramNames
      .map(pName => parameters[pName])
      .filter(score => score !== undefined);

    dimensions[dimName] = paramScores.length > 0
      ? paramScores.reduce((a, b) => a + b, 0) / paramScores.length
      : 0;
  }

  // Calculate overall wellness score
  const allDimensionScores = Object.values(dimensions);
  const overallScore = allDimensionScores.reduce((a, b) => a + b, 0) / allDimensionScores.length;

  return {
    parameters: Object.entries(parameters).reduce((acc, [k, v]) => {
      acc[k] = parseFloat(v.toFixed(2));
      return acc;
    }, {}),
    dimensions: Object.entries(dimensions).reduce((acc, [k, v]) => {
      acc[k] = parseFloat(v.toFixed(2));
      return acc;
    }, {}),
    overallScore: parseFloat(overallScore.toFixed(2))
  };
}

export default { calculateWellnessScores };
