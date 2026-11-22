// Career Discovery: free Class VIII-XII student activity + staff back-office.
// Mounted at /api/career. Built as a factory so it can be tested against an in-memory Postgres.
import express from 'express';
import crypto from 'crypto';
import E from '../utils/careerEngine.js'; // same file the browser loads, so client and server scoring are identical
import { requireAuth, requireAdmin, requireStaff } from '../middleware/auth.js';
import { buildReport } from '../utils/careerReport.js';
import { reportToXlsx } from '../utils/careerXlsx.js';


const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L: children copy these by hand
const newCode = n => Array.from(crypto.randomBytes(n), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const s = (v, n) => String(v == null ? '' : v).slice(0, n);
const csvCell = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const toCsv = (head, rows) => '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
const isUnique = e => e && (e.code === '23505' || /unique|duplicate/i.test(String(e.message)));
const MOBILE = /^[6-9]\d{9}$/, EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LEAD_STATUS = ['new', 'contacted', 'interested', 'converted', 'not-interested'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createCareerRouter(pool) {
  const router = express.Router();

  // Per-IP guards. A whole school shares one public IP, so student limits are generous.
  const buckets = new Map();
  const hit = (key, max, windowMs) => { const now = Date.now(), a = (buckets.get(key) || []).filter(t => now - t < windowMs); a.push(now); buckets.set(key, a); return a.length > max; };
  const wrap = f => (req, res) => Promise.resolve(f(req, res)).catch(e => { console.error('career:', e.message); res.status(500).json({ error: 'Server error' }); });
  const getSchool = async code => (await pool.query('SELECT * FROM cd_schools WHERE code = $1', [s(code, 20).toUpperCase()])).rows[0];
  const fail = (res, code, error) => res.status(code).json({ error });

  /* ---------- PUBLIC: school link, submit, result ---------- */
  router.get('/school/:code', wrap(async (req, res) => {
    const sc = await getSchool(req.params.code);
    if (!sc) return fail(res, 404, 'We could not find this school link.');
    if (!sc.is_open) return fail(res, 403, 'This activity is not open right now.');
    res.json({ name: sc.name });
  }));

  router.post('/submit', wrap(async (req, res) => {
    if (hit('sub:' + req.ip, 3000, 3600e3)) return fail(res, 429, 'Too many requests. Please try again shortly.');
    const b = req.body || {}, sc = await getSchool(b.schoolCode);
    if (!sc || !sc.is_open || !sc.consent_at) return fail(res, 403, 'This activity is not open right now.');
    const name = s(b.name, 60).trim(), cls = s(b.classLabel, 5), section = s(b.section, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const roll = s(b.roll, 10).trim().toUpperCase().replace(/[^A-Z0-9\-/]/g, '');
    if (name.length < 2 || !E.CLASSES.includes(cls) || !section || !roll) return fail(res, 400, 'Please check your name, class, section and roll number.');
    const band = E.bandOf(cls), stream = band === '1112' ? s(b.stream, 6) : '';
    if (band === '1112' && !E.STREAM_NAME[stream]) return fail(res, 400, 'Please choose your subject combination.');
    if (!E.validAnswers(b.answers, band, stream)) return fail(res, 400, 'Some answers are missing. Please go back and complete every question.');
    const dur = Number.isFinite(b.startedAt) && Number.isFinite(b.submittedAt) ? Math.max(0, Math.round((b.submittedAt - b.startedAt) / 1000)) : null;
    const sum = E.summarize(b.answers, cls, stream, dur);
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newCode(6);
      try {
        await pool.query(`INSERT INTO cd_submissions (school_id,name,class_label,section,roll_no,stream,result_code,answers,scores,top_areas,flags,duration_sec)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [sc.id, name, cls, section, roll, stream, code, JSON.stringify(b.answers), JSON.stringify(sum.scores), JSON.stringify(sum.topAreas), JSON.stringify(sum.flags), dur]);
        return res.json({ resultCode: code });
      } catch (e) {
        if (isUnique(e)) {
          if (/result_code/i.test(e.constraint || '') || /Key \(school_id,\s*result_code\)/i.test((e.detail || '') + String(e.message))) continue; // code collision: try another
          return fail(res, 409, 'An entry already exists for this class, section and roll number. Use "Check my result" instead.');
        }
        throw e;
      }
    }
    fail(res, 500, 'Please try again.');
  }));

  const findSubmission = async (sc, rollIn, codeIn) => {
    const roll = s(rollIn, 10).trim().toUpperCase().replace(/[^A-Z0-9\-/]/g, ''), code = s(codeIn, 8).trim().toUpperCase();
    if (!sc || !roll || !code) return null;
    return (await pool.query('SELECT id,name,class_label,section,stream,status,answers,top_areas FROM cd_submissions WHERE school_id=$1 AND roll_no=$2 AND result_code=$3', [sc.id, roll, code])).rows[0] || null;
  };
  router.post('/result', wrap(async (req, res) => {
    if (hit('res:' + req.ip, 3000, 600e3)) return fail(res, 429, 'Too many requests. Please try again shortly.');
    const b = req.body || {}, sc = await getSchool(b.schoolCode);
    if (!sc || !b.roll || !b.resultCode) return fail(res, 400, 'Please enter your roll number and result code.');
    const r = await findSubmission(sc, b.roll, b.resultCode);
    if (!r) return fail(res, 404, 'No match. Please check your roll number and result code.');
    if (r.status !== 'approved') return res.json({ status: 'pending' });
    res.json({ status: 'approved', name: r.name, classLabel: r.class_label, stream: r.stream, answers: r.answers });
  }));

  /* ---------- PUBLIC: lead capture (name, mobile, email) ---------- */
  const insertLead = l => pool.query(`INSERT INTO cd_leads (source,school_id,contact_name,mobile,email,student_name,class_label,stream,top_areas,consent_at,assigned_to,answers)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [l.source, l.schoolId || null, l.contactName, l.mobile, l.email || null, l.studentName || null, l.classLabel || null, l.stream || null, JSON.stringify(l.topAreas || []), l.consentAt || null, l.assignedTo || null, l.answers ? JSON.stringify(l.answers) : null]);

  const demoAnswers = b => { // keep the demo student's answers so staff can open their report; only if they are a complete, valid set
    try { const cls = s(b.classLabel, 5), st = E.bandOf(cls) === '1112' ? s(b.stream, 6) : ''; return E.CLASSES.includes(cls) && E.validAnswers(b.answers, E.bandOf(cls), st) ? b.answers : null; } catch (e) { return null; }
  };
  router.post('/lead', wrap(async (req, res) => { // public demo: parent details up front, with consent
    if (hit('lead:' + req.ip, 200, 3600e3)) return fail(res, 429, 'Too many requests.');
    const b = req.body || {};
    if (!b.consentAt || !MOBILE.test(s(b.parentPhone, 10)) || s(b.parentName, 80).trim().length < 2 || s(b.studentName, 80).trim().length < 2) return fail(res, 400, 'consent, the student name, a parent name and a valid mobile are required');
    const email = s(b.parentEmail, 120).trim();
    await insertLead({ source: 'demo', contactName: s(b.parentName, 80).trim(), mobile: s(b.parentPhone, 10), email: EMAIL.test(email) ? email : '', studentName: s(b.studentName, 80), classLabel: s(b.classLabel, 20),
      stream: s(b.stream, 40), topAreas: (Array.isArray(b.topAreas) ? b.topAreas : []).slice(0, 3).map(a => ({ name: s(a.area || a.name, 60), score: Number(a.score) || 0 })), consentAt: new Date(b.consentAt), answers: demoAnswers(b) });
    res.json({ ok: true });
  }));

  // school activity: optional "call us" contact left by the family, proved by roll number + result code. The school never sees this.
  router.post('/school-lead', wrap(async (req, res) => {
    if (hit('slead:' + req.ip, 600, 3600e3)) return fail(res, 429, 'Too many requests. Please try again shortly.');
    const b = req.body || {}, sc = await getSchool(b.schoolCode), sub = await findSubmission(sc, b.roll, b.resultCode);
    if (!sub) return fail(res, 404, 'We could not match your roll number and result code.');
    const name = s(b.contactName, 80).trim(), mobile = s(b.mobile, 10), email = s(b.email, 120).trim();
    if (name.length < 2) return fail(res, 400, "Please enter the parent or guardian's name.");
    if (!MOBILE.test(mobile)) return fail(res, 400, 'Please enter a valid 10-digit mobile number.');
    if (email && !EMAIL.test(email)) return fail(res, 400, 'That email address does not look right.');
    if (!b.consent) return fail(res, 400, 'A parent or guardian needs to agree before we can contact them.');
    const label = sub.class_label + '-' + sub.section;
    const dup = (await pool.query('SELECT id FROM cd_leads WHERE source=$1 AND school_id=$2 AND student_name=$3 AND class_label=$4 AND mobile=$5', ['school', sc.id, sub.name, label, mobile])).rows[0];
    if (dup) { await pool.query('UPDATE cd_leads SET contact_name=$1, email=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3', [name, email || null, dup.id]); return res.json({ ok: true }); }
    await insertLead({ source: 'school', schoolId: sc.id, contactName: name, mobile, email, studentName: sub.name, classLabel: label, stream: sub.stream, topAreas: sub.top_areas, consentAt: new Date(), answers: sub.answers });
    res.json({ ok: true });
  }));

  /* ---------- STAFF (admins and counsellors) ---------- */
  const staff = [requireAuth, requireStaff], adminOnly = [requireAuth, requireAdmin];

  const schoolOut = r => ({ id: r.id, code: r.code, name: r.name, city: r.city, headcount: r.headcount || {}, isOpen: r.is_open, consentBy: r.consent_by, consentAt: r.consent_at, consentNote: r.consent_note, createdAt: r.created_at, counts: r.counts });
  router.get('/admin/schools', staff, wrap(async (req, res) => {
    const rows = (await pool.query('SELECT * FROM cd_schools ORDER BY id DESC')).rows;
    const cnt = (await pool.query('SELECT school_id, status, COUNT(*) AS n FROM cd_submissions GROUP BY school_id, status')).rows;
    rows.forEach(r => { r.counts = { pending: 0, approved: 0, held: 0 }; cnt.filter(c => c.school_id === r.id).forEach(c => { r.counts[c.status] = Number(c.n); }); });
    res.json({ schools: rows.map(schoolOut) });
  }));
  const cleanHead = h => Object.fromEntries(E.CLASSES.filter(c => h && Number(h[c]) > 0).map(c => [c, Math.min(5000, Math.round(Number(h[c])))]));
  router.post('/admin/schools', adminOnly, wrap(async (req, res) => {
    const b = req.body || {}, name = s(b.name, 100).trim();
    if (name.length < 3) return fail(res, 400, 'School name is required.');
    const code = s(b.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || newCode(5);
    try {
      const r = await pool.query('INSERT INTO cd_schools (code,name,city,headcount) VALUES ($1,$2,$3,$4) RETURNING *', [code, name, s(b.city, 60), JSON.stringify(cleanHead(b.headcount))]);
      res.json({ school: schoolOut(r.rows[0]) });
    } catch (e) { if (isUnique(e)) return fail(res, 409, 'That school code is already used.'); throw e; }
  }));
  router.patch('/admin/schools/:id', adminOnly, wrap(async (req, res) => {
    const id = Number(req.params.id), b = req.body || {};
    const cur = (await pool.query('SELECT * FROM cd_schools WHERE id=$1', [id])).rows[0];
    if (!cur) return fail(res, 404, 'Not found');
    let consentAt = cur.consent_at, consentBy = cur.consent_by, consentNote = cur.consent_note;
    if (b.consent) { consentBy = s(b.consent.by, 100).trim(); consentNote = s(b.consent.note, 300); consentAt = consentBy ? new Date(b.consent.date || Date.now()) : null; }
    const isOpen = b.isOpen === undefined ? cur.is_open : !!b.isOpen;
    if (isOpen && !consentAt) return fail(res, 400, "Record the school's parental-consent confirmation before opening the activity.");
    const r = await pool.query('UPDATE cd_schools SET name=$1, city=$2, headcount=$3, is_open=$4, consent_by=$5, consent_at=$6, consent_note=$7 WHERE id=$8 RETURNING *',
      [b.name ? s(b.name, 100) : cur.name, b.city === undefined ? cur.city : s(b.city, 60), JSON.stringify(b.headcount ? cleanHead(b.headcount) : cur.headcount), isOpen, consentBy, consentAt, consentNote, id]);
    res.json({ school: schoolOut(r.rows[0]) });
  }));
  router.delete('/admin/schools/:id', adminOnly, wrap(async (req, res) => {
    if (req.query.confirm !== 'DELETE') return fail(res, 400, 'Add ?confirm=DELETE to remove a school and ALL its student data.');
    const id = Number(req.params.id);
    await pool.query('UPDATE cd_leads SET school_id = NULL WHERE school_id = $1', [id]);
    await pool.query('DELETE FROM cd_schools WHERE id=$1', [id]); res.json({ ok: true });
  }));

  const subOut = r => ({ id: String(r.id), schoolId: r.school_id, name: r.name, cls: r.class_label, section: r.section, roll: r.roll_no, stream: r.stream, status: r.status,
    resultCode: r.result_code, flags: r.flags, topAreas: r.top_areas, durationSec: r.duration_sec, createdAt: r.created_at, releasedAt: r.released_at });
  router.get('/admin/submissions', staff, wrap(async (req, res) => {
    const q = req.query, args = [], w = [];
    if (q.schoolId) { args.push(Number(q.schoolId)); w.push('school_id=$' + args.length); }
    if (q.cls) { args.push(s(q.cls, 5)); w.push('class_label=$' + args.length); }
    if (q.status) { args.push(s(q.status, 10)); w.push('status=$' + args.length); }
    let rows = (await pool.query(`SELECT id,school_id,name,class_label,section,roll_no,result_code,stream,status,flags,top_areas,duration_sec,created_at,released_at FROM cd_submissions ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY class_label, section, roll_no`, args)).rows;
    if (q.flagged === '1') rows = rows.filter(r => r.flags.some(f => f !== 'flat-profile'));
    res.json({ total: rows.length, submissions: rows.slice(0, 5000).map(subOut) });
  }));
  const setStatus = async (ids, status) => {
    let n = 0;
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400).map(Number).filter(Number.isInteger); if (!chunk.length) continue;
      const ph = chunk.map((_, k) => '$' + (k + 3)).join(',');
      const r = await pool.query(`UPDATE cd_submissions SET status=$1, released_at=${status === 'approved' ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE status<>$2 AND id IN (${ph})`, [status, status, ...chunk]);
      n += r.rowCount;
    }
    return n;
  };
  router.post('/admin/approve', staff, wrap(async (req, res) => {
    const b = req.body || {}; let ids = Array.isArray(b.ids) ? b.ids : [];
    if (b.schoolId && b.clean) { // every pending submission without a quality flag (flat-profile is informational only)
      const rows = (await pool.query("SELECT id, flags FROM cd_submissions WHERE school_id=$1 AND status='pending'", [Number(b.schoolId)])).rows;
      ids = rows.filter(r => !r.flags.some(f => f !== 'flat-profile')).map(r => r.id);
    }
    res.json({ updated: await setStatus(ids, 'approved') });
  }));
  router.post('/admin/hold', staff, wrap(async (req, res) => res.json({ updated: await setStatus(Array.isArray((req.body || {}).ids) ? req.body.ids : [], 'held') })));
  router.get('/admin/submissions/:id', staff, wrap(async (req, res) => {
    const r = (await pool.query('SELECT * FROM cd_submissions WHERE id=$1', [Number(req.params.id)])).rows[0];
    if (!r) return fail(res, 404, 'Not found');
    res.json({ submission: { ...subOut(r), resultCode: r.result_code, scores: r.scores, answers: r.answers } });
  }));
  router.delete('/admin/submissions/:id', adminOnly, wrap(async (req, res) => { // erase one child's data on request
    const r = await pool.query('DELETE FROM cd_submissions WHERE id=$1', [Number(req.params.id)]); res.json({ deleted: r.rowCount });
  }));
  router.get('/admin/codes.csv', staff, wrap(async (req, res) => {
    const rows = (await pool.query("SELECT class_label,section,roll_no,name,result_code FROM cd_submissions WHERE school_id=$1 AND status='approved' ORDER BY class_label,section,roll_no", [Number(req.query.schoolId)])).rows;
    res.type('text/csv').attachment('result-codes.csv').send(toCsv(['Class', 'Section', 'Roll no', 'Name', 'Result code'], rows.map(r => [r.class_label, r.section, r.roll_no, r.name, r.result_code])));
  }));
  router.get('/admin/followup.csv', staff, wrap(async (req, res) => {
    const rows = (await pool.query('SELECT class_label,section,roll_no,name,status,flags,top_areas FROM cd_submissions WHERE school_id=$1 ORDER BY class_label,section,roll_no', [Number(req.query.schoolId)])).rows.filter(r => r.flags.length);
    res.type('text/csv').attachment('followup.csv').send(toCsv(['Class', 'Section', 'Roll no', 'Name', 'Status', 'Flags', 'Top areas'], rows.map(r => [r.class_label, r.section, r.roll_no, r.name, r.status, r.flags.join('; '), r.top_areas.map(a => a.name).join('; ')])));
  }));

  /* ----- Report: anonymous aggregate for the school ----- */
  const loadReport = async id => {
    const sc = (await pool.query('SELECT * FROM cd_schools WHERE id=$1', [Number(id)])).rows[0]; if (!sc) return null;
    const subs = (await pool.query('SELECT class_label,stream,status,scores,top_areas,flags FROM cd_submissions WHERE school_id=$1', [sc.id])).rows;
    return buildReport(sc, subs);
  };
  router.get('/admin/report/:id', staff, wrap(async (req, res) => { const r = await loadReport(req.params.id); r ? res.json({ report: r }) : fail(res, 404, 'Not found'); }));
  router.get('/admin/report/:id/xlsx', staff, wrap(async (req, res) => {
    const r = await loadReport(req.params.id); if (!r) return fail(res, 404, 'Not found');
    const ps = (await pool.query('SELECT org_name, logo_data, logo_mime FROM platform_settings WHERE id = 1')).rows[0] || {};
    const logo = ps.logo_data && /^image\/(png|jpeg)$/.test(ps.logo_mime) ? { mime: ps.logo_mime, b64: ps.logo_data } : null;
    const buf = await reportToXlsx(r, { orgName: ps.org_name || 'NavaSetu Initiatives', logo });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${r.school.code}-career-discovery-report.xlsx`).send(Buffer.from(buf));
  }));

  /* ----- Leads: admins see all; counsellors see only leads assigned to them (same rule as the main CRM) ----- */
  const isCouns = req => req.user.role === 'counsellor';
  const leadOut = r => ({ id: String(r.id), createdAt: r.created_at, source: r.source, schoolId: r.school_id, schoolName: r.school_name || null, contactName: r.contact_name, mobile: r.mobile, email: r.email || '',
    studentName: r.student_name || '', classLabel: r.class_label || '', stream: r.stream || '', topAreas: r.top_areas || [], status: r.status, note: r.note || '', assignedTo: r.assigned_to, assignedName: r.assigned_name || null, hasAnswers: !!r.answers });
  const leadRows = async (q, req) => {
    const args = [], w = [];
    if (isCouns(req)) { args.push(req.user.userId); w.push('l.assigned_to=$' + args.length); }
    if (q.source) { args.push(s(q.source, 10)); w.push('l.source=$' + args.length); }
    if (q.status) { args.push(s(q.status, 20)); w.push('l.status=$' + args.length); }
    if (q.schoolId) { args.push(Number(q.schoolId)); w.push('l.school_id=$' + args.length); }
    let rows = (await pool.query(`SELECT l.*, sc.name AS school_name, u.full_name AS assigned_name FROM cd_leads l LEFT JOIN cd_schools sc ON sc.id = l.school_id LEFT JOIN users u ON u.id = l.assigned_to ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY l.id DESC LIMIT 5000`, args)).rows;
    const t = s(q.q, 60).toLowerCase().trim();
    if (t) rows = rows.filter(r => [r.contact_name, r.mobile, r.email, r.student_name].some(x => String(x || '').toLowerCase().includes(t)));
    return rows;
  };
  router.get('/admin/leads', staff, wrap(async (req, res) => { const rows = await leadRows(req.query, req); res.json({ total: rows.length, leads: rows.map(leadOut) }); }));
  router.get('/admin/leads/:id', staff, wrap(async (req, res) => { // one lead with the answers, so staff can open the student's report
    const r = (await pool.query('SELECT * FROM cd_leads WHERE id=$1', [Number(req.params.id)])).rows[0];
    if (!r || (isCouns(req) && r.assigned_to !== req.user.userId)) return fail(res, 404, 'Not found');
    res.json({ lead: { id: String(r.id), studentName: r.student_name || '', classLabel: r.class_label || '', stream: r.stream || '', answers: r.answers || null } });
  }));
  router.get('/admin/leads.csv', staff, wrap(async (req, res) => {
    const rows = await leadRows(req.query, req);
    res.type('text/csv').attachment('career-leads.csv').send(toCsv(['Date', 'Source', 'School', 'Contact name', 'Mobile', 'Email', 'Student', 'Class', 'Stream', 'Status', 'Assigned to', 'Note', 'Top areas'],
      rows.map(r => [new Date(r.created_at).toISOString().slice(0, 10), r.source, r.school_name || '', r.contact_name, r.mobile, r.email || '', r.student_name || '', r.class_label || '', r.stream || '', r.status, r.assigned_name || '', r.note || '', (r.top_areas || []).map(a => a.name).join('; ')])));
  }));
  router.post('/admin/leads', staff, wrap(async (req, res) => { // staff add a lead from a call, event or walk-in
    const b = req.body || {}, name = s(b.contactName, 80).trim(), mobile = s(b.mobile, 10).replace(/\D/g, ''), email = s(b.email, 120).trim();
    if (name.length < 2) return fail(res, 400, 'Name is required.');
    if (s(b.studentName, 80).trim().length < 2) return fail(res, 400, "The student's name is required.");
    if (!MOBILE.test(mobile)) return fail(res, 400, 'Enter a valid 10-digit mobile number.');
    if (email && !EMAIL.test(email)) return fail(res, 400, 'That email address does not look right.');
    const r = await insertLead({ source: 'manual', schoolId: b.schoolId ? Number(b.schoolId) : null, contactName: name, mobile, email, studentName: s(b.studentName, 80), classLabel: s(b.classLabel, 20), assignedTo: isCouns(req) ? req.user.userId : null });
    if (b.note) await pool.query('UPDATE cd_leads SET note=$1 WHERE id=$2', [s(b.note, 500), r.rows[0].id]);
    res.json({ id: String(r.rows[0].id) });
  }));
  router.patch('/admin/leads/:id', staff, wrap(async (req, res) => {
    const id = Number(req.params.id), b = req.body || {}, cur = (await pool.query('SELECT * FROM cd_leads WHERE id=$1', [id])).rows[0];
    if (!cur || (isCouns(req) && cur.assigned_to !== req.user.userId)) return fail(res, 404, 'Not found');
    const status = b.status === undefined ? cur.status : s(b.status, 20); if (!LEAD_STATUS.includes(status)) return fail(res, 400, 'Unknown status.');
    let assigned = cur.assigned_to;
    if (b.assignedTo !== undefined) {
      if (isCouns(req)) return fail(res, 403, 'Only an admin can assign leads.');
      assigned = b.assignedTo || null;
      if (assigned && (!UUID.test(assigned) || !(await pool.query("SELECT id FROM users WHERE id=$1 AND role='counsellor' AND status='active'", [assigned])).rows[0])) return fail(res, 400, 'That counsellor is not available.');
    }
    await pool.query('UPDATE cd_leads SET status=$1, note=$2, assigned_to=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4', [status, b.note === undefined ? cur.note : s(b.note, 500), assigned, id]);
    res.json({ ok: true });
  }));
  router.delete('/admin/leads/:id', adminOnly, wrap(async (req, res) => { await pool.query('DELETE FROM cd_leads WHERE id=$1', [Number(req.params.id)]); res.json({ ok: true }); }));

  return router;
}
