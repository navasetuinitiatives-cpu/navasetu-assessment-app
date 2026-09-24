import { dimensionMapping } from './scoring.js';

const DIMENSIONS = Object.keys(dimensionMapping);

const CORRECTIVE_STRATEGIES = {
  'Emotional Well-being': 'Consider workload audits, protected non-teaching periods, and normalizing access to counselling support — emotional depletion here tends to be structural, not individual.',
  'Work Fulfillment & Impact': 'Create more visible channels for recognizing teacher impact (student outcome sharing, peer recognition, leadership pathways) rather than relying on test scores alone.',
  'Inner Strength & Resilience': 'Mentorship pairing and peer support circles build resilience faster than individual coping advice — consider structured peer-mentoring for newer or lower-scoring staff.',
  'Work Environment & Support System': 'Review role clarity, resource adequacy, and management communication — this dimension usually responds directly to institutional-level changes.',
  'Work-Life Balance': 'Examine after-hours communication norms and workload distribution; small policy changes (no-email-after-hours, realistic grading loads) often move this dimension quickly.'
};

function average(nums) {
  if (nums.length === 0) return null;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

function colorForScore(score) {
  if (score === null) return '#9CA3AF';
  if (score >= 4) return '#10B981';
  if (score >= 3) return '#3B82F6';
  if (score >= 2) return '#F59E0B';
  return '#EF4444';
}

/**
 * submittedScores: array of { parameters: {...}, dimensions: {...} } — one
 * per teacher who has submitted, as stored in assessments.scores.
 * Individual teacher identities are intentionally never included here —
 * schools only ever see aggregate figures, never per-teacher reports.
 */
export function generateSchoolReportHtml({ school, totalTeachers, submittedScores }) {
  const completedAssessments = submittedScores.length;

  const avgDimensionScores = {};
  DIMENSIONS.forEach((dim) => {
    const vals = submittedScores.map((s) => s && s.dimensions && s.dimensions[dim]).filter((v) => typeof v === 'number');
    avgDimensionScores[dim] = average(vals);
  });

  // "At risk" = at least one dimension below 2.5 for that teacher
  const atRiskCount = submittedScores.filter((s) => {
    if (!s || !s.dimensions) return false;
    return Object.values(s.dimensions).some((v) => typeof v === 'number' && v < 2.5);
  }).length;

  const responseRate = totalTeachers > 0 ? Math.round((completedAssessments / totalTeachers) * 100) : 0;

  const dimensionRows = DIMENSIONS.map((dim) => {
    const score = avgDimensionScores[dim];
    const pct = score !== null ? (score / 5) * 100 : 0;
    const strategy = score !== null && score < 3 ? CORRECTIVE_STRATEGIES[dim] : null;
    return `
      <div style="margin-bottom: 1.5rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <strong>${dim}</strong>
          <span style="font-weight:700; color:${colorForScore(score)};">${score !== null ? score.toFixed(2) : 'N/A'} / 5</span>
        </div>
        <div style="background:#E5E7EB; border-radius:6px; height:14px; overflow:hidden;">
          <div style="width:${pct}%; background:${colorForScore(score)}; height:100%;"></div>
        </div>
        ${strategy ? `<p style="font-size:0.85rem; color:#6B7280; margin-top:0.5rem;"><strong>Suggested action:</strong> ${strategy}</p>` : ''}
      </div>`;
  }).join('');

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="text-align:center; margin-bottom:2rem;">
        <img src="/api/settings/logo" alt="NavaSetu" style="max-height:60px; margin-bottom:1rem;" onerror="this.style.display='none'">
        <h1 style="color:#0a0e27; font-family: 'Crimson Text', serif;">${school.name} — Wellness Project Report</h1>
        <p style="color:#6B7280;">Generated ${new Date().toLocaleDateString()} | Confidential — NavaSetu Admin Use Only</p>
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; margin-bottom:2rem; text-align:center;">
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:#0a0e27;">${totalTeachers}</div>
          <div style="font-size:0.85rem; color:#6B7280;">Teachers on Roster</div>
        </div>
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:#0a0e27;">${completedAssessments} (${responseRate}%)</div>
          <div style="font-size:0.85rem; color:#6B7280;">Completed Assessments</div>
        </div>
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:${atRiskCount > 0 ? '#EF4444' : '#10B981'};">${atRiskCount}</div>
          <div style="font-size:0.85rem; color:#6B7280;">Teachers Flagged At-Risk</div>
        </div>
      </div>

      <h2 style="color:#0a0e27; font-family:'Crimson Text', serif; border-bottom:2px solid #E5E7EB; padding-bottom:0.5rem;">Wellness Dimensions — School Average</h2>
      ${dimensionRows}

      <p style="font-size:0.8rem; color:#9CA3AF; margin-top:2rem; border-top:1px solid #E5E7EB; padding-top:1rem;">
        This report shows aggregate figures only. Individual teacher reports are never shared with the school —
        they are visible only to the teacher herself and to NavaSetu admins, per NavaSetu's confidentiality policy.
      </p>
    </div>`;

  return {
    html,
    analytics: {
      totalTeachers,
      completedAssessments,
      avgScores: avgDimensionScores,
      atRiskCount,
      responseRate
    }
  };
}
