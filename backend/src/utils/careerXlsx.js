import ExcelJS from 'exceljs';
import { imageSize } from './careerImage.js';
import E from './careerEngine.js'; // same file the browser loads, so client and server scoring are identical
async function reportToXlsx(r, brand) {
  brand = brand || {};
  const wb = new ExcelJS.Workbook(); wb.creator = brand.orgName || 'NavaSetu Initiatives';
  const head = ws => { ws.getRow(1).font = { bold: true, color: { argb: 'FFE6B800' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0E27' } }; ws.columns.forEach(c => { c.width = c.width || 18; }); };
  const sup = v => (v == null ? 'fewer than ' + r.minGroup : v);

  let ws = wb.addWorksheet('Summary');
  ws.columns = [{ header: r.school.name + ' · Career Discovery report' + (brand.orgName ? ' · ' + brand.orgName : ''), key: 'a', width: 110 }];
  head(ws);
  if (brand.logo && brand.logo.mime !== 'image/webp') { // the logo goes in the top-right of the Summary sheet
    const buf = Buffer.from(brand.logo.b64, 'base64'), sz = imageSize(buf, brand.logo.mime), h = 44, w = Math.min(240, Math.round(h * sz.w / sz.h));
    const id = wb.addImage({ buffer: buf, extension: brand.logo.mime === 'image/png' ? 'png' : 'jpeg' });
    ws.getRow(1).height = 52; ws.addImage(id, { tl: { col: 1.05, row: 0.08 }, ext: { width: w, height: h } });
    ws.getColumn(2).width = Math.ceil(w / 7) + 2;
  }
  ws.addRow({ a: 'Generated: ' + new Date(r.generatedAt).toLocaleString('en-IN') + ' · Anonymous aggregate: no names or roll numbers; groups under ' + r.minGroup + ' are not shown.' });
  ws.addRow({ a: '' }); r.insights.forEach(t => ws.addRow({ a: '• ' + t }));

  ws = wb.addWorksheet('Participation');
  ws.columns = [{ header: 'Class', key: 'c' }, { header: 'Students', key: 'n' }, { header: 'Declared headcount', key: 'h' }, { header: 'Participation %', key: 'p' }];
  head(ws); r.classes.forEach(c => ws.addRow({ c: c.cls, n: c.n, h: c.headcount || '', p: c.participation == null ? '' : c.participation }));
  ws.addRow({ c: 'Total', n: r.totals.included }); ws.addRow({}); ws.addRow({ c: 'Review status', n: '' });
  ['approved', 'pending', 'held'].forEach(k => ws.addRow({ c: k, n: r.totals[k] || 0 }));

  ws = wb.addWorksheet('Interests (avg %)');
  const tk = Object.keys(E.THEMES);
  ws.columns = [{ header: 'Group', key: 'g' }].concat(tk.map(t => ({ header: E.THEMES[t].name, key: t })));
  head(ws);
  const addT = (g, o) => ws.addRow(Object.assign({ g }, o ? o : Object.fromEntries(tk.map(t => [t, 'n<' + r.minGroup]))));
  addT('All students', r.interests.overall); Object.entries(r.interests.byClass).forEach(([c, o]) => { if (r.classes.find(x => x.cls === c).n) addT('Class ' + c, o); });

  ws = wb.addWorksheet('Career areas');
  ws.columns = [{ header: 'Group', key: 'g' }, { header: 'Rank', key: 'k', width: 8 }, { header: 'Career area', key: 'a', width: 34 }, { header: 'Students', key: 'n' }, { header: '% of group', key: 'p' }];
  head(ws);
  const addA = (g, list) => (list ? list.forEach((a, i) => ws.addRow({ g, k: i + 1, a: a.name, n: a.n, p: a.pct })) : ws.addRow({ g, a: 'fewer than ' + r.minGroup + ' students' }));
  addA('All students', r.areas.overall); Object.entries(r.areas.byClass).forEach(([c, l]) => { if (r.classes.find(x => x.cls === c).n) addA('Class ' + c, l); });

  ws = wb.addWorksheet('Streams');
  ws.columns = [{ header: 'Group', key: 'g' }, { header: 'Stream', key: 's', width: 40 }, { header: 'Students', key: 'n' }, { header: '% of group', key: 'p' }];
  head(ws);
  const addS = (g, list) => (list ? list.forEach(x => ws.addRow({ g, s: x.label, n: x.n, p: x.pct })) : ws.addRow({ g, s: 'fewer than ' + r.minGroup + ' students' }));
  if (r.classes.slice(0, 3).some(c => c.n)) { addS('Classes VIII–X (leaning)', r.leaning.classes810); ['VIII', 'IX', 'X'].forEach(c => { if (r.classes.find(x => x.cls === c).n) addS('Class ' + c + ' (leaning)', r.leaning.byClass[c]); }); }
  if (r.classes.slice(3).some(c => c.n)) { addS('Classes XI–XII (current subjects)', r.subjects.classes1112); ['XI', 'XII'].forEach(c => { if (r.classes.find(x => x.cls === c).n) addS('Class ' + c, r.subjects.byClass[c]); }); }

  ws = wb.addWorksheet('Learning, motivators, strengths');
  ws.columns = [{ header: 'Measure', key: 'm', width: 34 }, { header: 'All', key: 'a' }, { header: 'Classes VIII–X', key: 'j' }, { header: 'Classes XI–XII', key: 's' }];
  head(ws);
  const g = (o, k) => (o ? o[k] : 'n<' + r.minGroup);
  const lp = (o, l) => (o ? o.find(x => x.label === l).pct : 'n<' + r.minGroup);
  ['Visual', 'Listening and talking', 'Reading and writing', 'Hands-on', 'A blend'].forEach(l => ws.addRow({ m: 'Learning: ' + l + ' (%)', a: lp(r.learning.overall, l), j: lp(r.learning.byBand['810'], l), s: lp(r.learning.byBand['1112'], l) }));
  E.MOTIV.forEach(([id]) => ws.addRow({ m: 'Motivator: ' + E.MOTIV_TXT[id][0] + ' (avg %)', a: g(r.motivators.overall, id), j: g(r.motivators.byBand['810'], id), s: g(r.motivators.byBand['1112'], id) }));
  E.STRENGTH.forEach(([id, nm]) => ws.addRow({ m: 'Self-rated: ' + nm + ' (avg %)', a: g(r.strengths.overall, id), j: g(r.strengths.byBand['810'], id), s: g(r.strengths.byBand['1112'], id) }));
  return wb.xlsx.writeBuffer();
}
export { reportToXlsx };
