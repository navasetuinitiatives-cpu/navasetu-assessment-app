import { dimensionMapping } from './scoring.js';

const DIMENSIONS = Object.keys(dimensionMapping);

const CORRECTIVE_STRATEGIES = {
  'Emotional Well-being': 'Consider workload audits, protected non-teaching periods, and normalizing access to counselling support — emotional depletion here tends to be structural, not individual.',
  'Work Fulfillment & Impact': 'Create more visible channels for recognizing teacher impact (student outcome sharing, peer recognition, leadership pathways) rather than relying on test scores alone.',
  'Inner Strength & Resilience': 'Mentorship pairing and peer support circles build resilience faster than individual coping advice — consider structured peer-mentoring for newer or lower-scoring staff.',
  'Work Environment & Support System': 'Review role clarity, resource adequacy, and management communication — this dimension usually responds directly to institutional-level changes.',
  'Work-Life Balance': 'Examine after-hours communication norms and workload distribution; small policy changes (no-email-after-hours, realistic grading loads) often move this dimension quickly.'
};

// Dimensions most directly tied to burnout risk (GHQ-12/MBI-ES derived) —
// called out separately since "burnout" is a named concern in NavaSetu's
// brief, not just a generic wellness average.
const BURNOUT_DIMENSIONS = ['Emotional Well-being', 'Work Fulfillment & Impact'];

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
  const dimensionAtRiskPct = {};
  DIMENSIONS.forEach((dim) => {
    const vals = submittedScores.map((s) => s && s.dimensions && s.dimensions[dim]).filter((v) => typeof v === 'number');
    avgDimensionScores[dim] = average(vals);
    const belowThreshold = vals.filter((v) => v < 2.5).length;
    dimensionAtRiskPct[dim] = vals.length > 0 ? Math.round((belowThreshold / vals.length) * 100) : null;
  });

  // Per-parameter aggregate (all 18), grouped by dimension — gives NavaSetu a
  // specific, actionable diagnostic rather than only 5 broad category averages.
  const avgParameterScores = {};
  DIMENSIONS.forEach((dim) => {
    dimensionMapping[dim].forEach((param) => {
      const vals = submittedScores.map((s) => s && s.parameters && s.parameters[param]).filter((v) => typeof v === 'number');
      avgParameterScores[param] = average(vals);
    });
  });

  // "At risk" = at least one dimension below 2.5 for that teacher
  const atRiskCount = submittedScores.filter((s) => {
    if (!s || !s.dimensions) return false;
    return Object.values(s.dimensions).some((v) => typeof v === 'number' && v < 2.5);
  }).length;

  const burnoutAvg = average(
    BURNOUT_DIMENSIONS.map((d) => avgDimensionScores[d]).filter((v) => typeof v === 'number')
  );

  const responseRate = totalTeachers > 0 ? Math.round((completedAssessments / totalTeachers) * 100) : 0;

  const dimensionRows = DIMENSIONS.map((dim) => {
    const score = avgDimensionScores[dim];
    const pct = score !== null ? (score / 5) * 100 : 0;
    const strategy = score !== null && score < 3 ? CORRECTIVE_STRATEGIES[dim] : null;
    const atRiskPct = dimensionAtRiskPct[dim];

    const paramRows = dimensionMapping[dim].map((param) => {
      const pScore = avgParameterScores[param];
      const pPct = pScore !== null ? (pScore / 5) * 100 : 0;
      return `
        <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
          <div style="width:220px; font-size:0.82rem; color:#374151; flex-shrink:0;">${param}</div>
          <div style="flex:1; background:#F3F4F6; border-radius:5px; height:9px; overflow:hidden;">
            <div style="width:${pPct}%; background:${colorForScore(pScore)}; height:100%;"></div>
          </div>
          <div style="width:48px; text-align:right; font-size:0.8rem; font-weight:600; color:${colorForScore(pScore)};">${pScore !== null ? pScore.toFixed(1) : '—'}</div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom: 2rem; page-break-inside: avoid;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.4rem;">
          <strong style="font-size:1.02rem; color:#0a0e27;">${dim}</strong>
          <span style="font-weight:700; color:${colorForScore(score)};">${score !== null ? score.toFixed(2) : 'N/A'} / 5</span>
        </div>
        <div style="background:#E5E7EB; border-radius:6px; height:14px; overflow:hidden; margin-bottom:0.5rem;">
          <div style="width:${pct}%; background:${colorForScore(score)}; height:100%;"></div>
        </div>
        ${atRiskPct !== null ? `<p style="font-size:0.8rem; color:#6B7280; margin:0 0 0.75rem 0;">${atRiskPct}% of respondents scored below the at-risk threshold (2.5/5) on this dimension.</p>` : ''}
        <div style="background:#FAFAFA; border-radius:6px; padding:0.85rem 1rem; margin-bottom:0.5rem;">
          ${paramRows}
        </div>
        ${strategy ? `<p style="font-size:0.85rem; color:#6B7280; margin-top:0.5rem;"><strong>Suggested action:</strong> ${strategy}</p>` : ''}
      </div>`;
  }).join('');

  // Recommended next steps: synthesize the two weakest dimensions into a concrete
  // engagement suggestion for NavaSetu's own follow-up with the school.
  const rankedDimensions = DIMENSIONS
    .map((d) => ({ dim: d, score: avgDimensionScores[d] }))
    .filter((d) => d.score !== null)
    .sort((a, b) => a.score - b.score);
  const weakest = rankedDimensions.slice(0, 2);
  const nextStepsHtml = weakest.length > 0 ? `
    <div style="background:#FEF9E7; border-left:4px solid #D4A017; border-radius:6px; padding:1.25rem 1.5rem; margin-top:1rem;">
      <strong style="color:#0a0e27; display:block; margin-bottom:0.5rem;">Recommended Next Steps for NavaSetu</strong>
      <p style="font-size:0.9rem; color:#374151; margin:0 0 0.5rem 0;">
        ${school.name}'s lowest-scoring dimensions are <strong>${weakest.map((w) => w.dim).join(' and ')}</strong>.
        ${atRiskCount > 0 ? `${atRiskCount} of ${completedAssessments} respondents (${Math.round((atRiskCount / Math.max(completedAssessments, 1)) * 100)}%) show at-risk scores on at least one dimension and would benefit from a counselling session offer.` : 'No individual respondents crossed the at-risk threshold, though the school-level average still points to room for improvement.'}
      </p>
      <p style="font-size:0.9rem; color:#374151; margin:0;">Suggested follow-up: propose a short wellness workshop targeting these two dimensions, and offer counselling session slots to the flagged staff (identities known only to NavaSetu, per confidentiality policy).</p>
    </div>` : '';

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 800px; margin: 0 auto; color:#1F2937;">
      <div style="text-align:center; margin-bottom:2rem; border-bottom: 3px solid #D4A017; padding-bottom: 1.5rem;">
        <img src="/api/settings/logo" alt="NavaSetu" style="max-height:70px; margin-bottom:1rem;" onerror="this.style.display='none'">
        <h1 style="color:#0a0e27; font-family: 'Crimson Text', serif; margin: 0.25rem 0;">${school.name} — Wellness Project Report</h1>
        <p style="color:#6B7280; margin: 0.25rem 0;">Generated ${new Date().toLocaleDateString()} | Confidential — NavaSetu Admin Use Only</p>
      </div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:1rem; margin-bottom:2rem; text-align:center;">
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:#0a0e27;">${totalTeachers}</div>
          <div style="font-size:0.8rem; color:#6B7280;">Teachers on Roster</div>
        </div>
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:#0a0e27;">${completedAssessments} (${responseRate}%)</div>
          <div style="font-size:0.8rem; color:#6B7280;">Completed Assessments</div>
        </div>
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:${atRiskCount > 0 ? '#EF4444' : '#10B981'};">${atRiskCount}</div>
          <div style="font-size:0.8rem; color:#6B7280;">Teachers Flagged At-Risk</div>
        </div>
        <div style="background:#F9FAFB; padding:1rem; border-radius:8px;">
          <div style="font-size:1.5rem; font-weight:700; color:${colorForScore(burnoutAvg)};">${burnoutAvg !== null ? burnoutAvg.toFixed(2) : 'N/A'}</div>
          <div style="font-size:0.8rem; color:#6B7280;">Burnout-Linked Avg (of 5)</div>
        </div>
      </div>

      ${nextStepsHtml}

      <h2 style="color:#0a0e27; font-family:'Crimson Text', serif; border-bottom:2px solid #E5E7EB; padding-bottom:0.5rem; margin-top:2rem;">Wellness Dimensions — School Average, with Parameter Detail</h2>
      ${dimensionRows}

      <p style="font-size:0.8rem; color:#9CA3AF; margin-top:2rem; border-top:1px solid #E5E7EB; padding-top:1rem;">
        This report shows aggregate figures only. Individual teacher reports are never shared with the school —
        they are visible only to the teacher herself and to NavaSetu admins, per NavaSetu's confidentiality policy.
        Assessment items are adapted from validated instruments including GHQ-12, MBI-ES, PsyCap, TSES, and OSI;
        this is a self-reflection screening tool, not a clinical diagnostic instrument.
      </p>
      <p style="font-size:0.8rem; color:#9CA3AF; margin-top:0.5rem; text-align:center;">
        NavaSetu Initiatives &nbsp;·&nbsp; navasetuinitiatives@gmail.com &nbsp;·&nbsp; 8556840001 &nbsp;·&nbsp; www.navasetu.online
      </p>
    </div>`;

  return {
    html,
    analytics: {
      totalTeachers,
      completedAssessments,
      avgScores: avgDimensionScores,
      avgParameterScores,
      dimensionAtRiskPct,
      burnoutAvg,
      atRiskCount,
      responseRate
    }
  };
}
