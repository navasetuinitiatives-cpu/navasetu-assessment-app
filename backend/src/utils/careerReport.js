// School aggregate report. ANONYMOUS by design: no names, no roll numbers, and any class group smaller than K is suppressed.
import E from './careerEngine.js'; // same file the browser loads, so client and server scoring are identical
const K = 5;
const CLASS_ORDER = ['VIII', 'IX', 'X', 'XI', 'XII'];
const avg = (arr, f) => arr.length ? Math.round(arr.reduce((n, x) => n + f(x), 0) / arr.length) : null;
const share = (n, d) => d ? Math.round(n / d * 100) : 0;

function buildReport(school, subs) {
  const status = { pending: 0, approved: 0, held: 0 };
  subs.forEach(s => { status[s.status] = (status[s.status] || 0) + 1; });
  const inc = subs.filter(s => s.status !== 'held');
  const byClass = {}; CLASS_ORDER.forEach(c => { byClass[c] = inc.filter(s => s.class_label === c); });
  const head = school.headcount || {};

  const classes = CLASS_ORDER.map(c => ({
    cls: c, n: byClass[c].length, headcount: head[c] || null,
    participation: head[c] ? Math.min(100, share(byClass[c].length, head[c])) : null,
    suppressed: byClass[c].length > 0 && byClass[c].length < K
  }));

  const themeAvg = list => Object.fromEntries(Object.keys(E.THEMES).map(t => [t, avg(list, s => s.scores.theme[t])]));
  const motAvg = list => Object.fromEntries(E.MOTIV.map(([id]) => [id, avg(list, s => s.scores.mot[id])]));
  const strAvg = list => Object.fromEntries(E.STRENGTH.map(([id]) => [id, avg(list, s => s.scores.str[id])]));
  const areaCount = list => {
    const m = {}; list.forEach(s => s.top_areas.forEach(a => { m[a.id] = (m[a.id] || 0) + 1; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: E.AREA[id].name, n, pct: share(n, list.length) }));
  };
  const learnCount = list => {
    const m = { Visual: 0, 'Listening and talking': 0, 'Reading and writing': 0, 'Hands-on': 0, 'A blend': 0 };
    list.forEach(s => { const l = s.scores.lead; if (l.length > 1) m['A blend']++; else m[E.LEARN_TXT[l[0]][0]]++; });
    return Object.entries(m).map(([k, n]) => ({ label: k, n, pct: share(n, list.length) }));
  };
  const guard = (list, f) => list.length >= K ? f(list) : null;

  const jr = inc.filter(s => E.bandOf(s.class_label) === '810'), sr = inc.filter(s => E.bandOf(s.class_label) === '1112');
  const leanCount = list => {
    const m = {}; list.forEach(s => { const g = s.scores.leaning; if (g) m[g] = (m[g] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ label: E.STREAM810[g], n, pct: share(n, list.length) }));
  };
  const subjCount = list => {
    const m = {}; list.forEach(s => { m[s.stream] = (m[s.stream] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: E.STREAM_NAME[k] || k, n, pct: share(n, list.length) }));
  };

  const r = {
    school: { name: school.name, city: school.city, code: school.code },
    generatedAt: new Date().toISOString(), minGroup: K,
    totals: { submitted: subs.length, included: inc.length, ...status },
    classes,
    interests: { overall: guard(inc, themeAvg), byClass: Object.fromEntries(CLASS_ORDER.map(c => [c, guard(byClass[c], themeAvg)])) },
    areas: { overall: guard(inc, l => areaCount(l).slice(0, 8)), byClass: Object.fromEntries(CLASS_ORDER.map(c => [c, guard(byClass[c], l => areaCount(l).slice(0, 5))])) },
    leaning: { classes810: guard(jr, leanCount), byClass: Object.fromEntries(['VIII', 'IX', 'X'].map(c => [c, guard(byClass[c], leanCount)])) },
    subjects: { classes1112: guard(sr, subjCount), byClass: Object.fromEntries(['XI', 'XII'].map(c => [c, guard(byClass[c], subjCount)])) },
    learning: { overall: guard(inc, learnCount), byBand: { '810': guard(jr, learnCount), '1112': guard(sr, learnCount) } },
    motivators: { overall: guard(inc, motAvg), byBand: { '810': guard(jr, motAvg), '1112': guard(sr, motAvg) } },
    strengths: { overall: guard(inc, strAvg), byBand: { '810': guard(jr, strAvg), '1112': guard(sr, strAvg) } },
    quality: {
      flat: inc.filter(s => s.flags.includes('flat-profile')).length,
      uniformOrFast: inc.filter(s => s.flags.includes('same-answer') || s.flags.includes('too-fast')).length
    }
  };
  r.insights = insights(r, inc.length);
  return r;
}

function insights(r, n) {
  const out = [];
  if (n < K) return ['Too few responses so far to show patterns (at least ' + K + ' needed).'];
  const took = r.classes.filter(c => c.n).map(c => `${c.cls} (${c.n})`).join(', ');
  const heads = r.classes.reduce((a, c) => a + (c.headcount || 0), 0), joined = r.classes.reduce((a, c) => a + (c.headcount ? c.n : 0), 0);
  out.push(`${n} students took part: ${took}.` + (heads ? ` That is ${Math.min(100, share(joined, heads))}% of the declared headcount for the classes with a headcount entered.` : ''));
  const th = Object.entries(r.interests.overall).sort((a, b) => b[1] - a[1]);
  if (th[0][1] - th[5][1] < 8) out.push('Interest types are spread fairly evenly across students, with no single type clearly dominant.');
  else out.push(`The most common interest types are ${E.THEMES[th[0][0]].name} (${th[0][1]}% average) and ${E.THEMES[th[1][0]].name} (${th[1][1]}%), while ${E.THEMES[th[5][0]].name} is the lowest (${th[5][1]}%).`);
  if (r.areas.overall) out.push(`The career areas that appear most often in students' top three are ${r.areas.overall.slice(0, 3).map(a => `${a.name} (${a.pct}% of students)`).join(', ')}.`);
  if (r.leaning.classes810) { const t = r.leaning.classes810[0]; out.push(`Among Class VIII–X students, the largest group (${t.pct}%) leans toward ${t.label}.`); }
  if (r.subjects.classes1112) { const t = r.subjects.classes1112[0]; out.push(`In Classes XI–XII, ${t.pct}% of participants study ${t.label}.`); }
  if (r.learning.overall) { const t = [...r.learning.overall].filter(x => x.label !== 'A blend').sort((a, b) => b.n - a.n)[0]; out.push(`${t.label} is the most common single learning preference (${t.pct}%); ${r.learning.overall.find(x => x.label === 'A blend').pct}% use a blend of styles.`); }
  if (r.quality.flat) out.push(`${r.quality.flat} ${r.quality.flat === 1 ? 'student' : 'students'} (${share(r.quality.flat, n)}%) showed few strong preferences. Guided exploration activities would help ${r.quality.flat === 1 ? 'them' : 'them'} most.`);
  if (r.quality.uniformOrFast) out.push(`${r.quality.uniformOrFast} ${r.quality.uniformOrFast === 1 ? 'response was' : 'responses were'} completed very quickly or with near-identical answers; individual results for these may be less reliable.`);
  return out;
}
export { buildReport, K, CLASS_ORDER };
