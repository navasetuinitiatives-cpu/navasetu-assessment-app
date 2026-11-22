// End-to-end test of the Career Discovery module on an in-memory Postgres, using the real routers + real JWT auth.
process.env.JWT_SECRET = 'test-secret'; process.env.NODE_ENV = 'test';
import express from 'express';
import assert from 'assert';
import fs from 'fs';
import zlib from 'zlib';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { newDb } from 'pg-mem';
import ExcelJS from 'exceljs';
import E from '../src/utils/careerEngine.js';
const { createCareerRouter } = await import('../src/routes/career.js');
const { pool: realPool } = await import('../src/config/database.js');
const settingsRouter = (await import('../src/routes/settings.js')).default;

const db = newDb(); const { Pool } = db.adapters.createPg(); const pool = new Pool();
const sql = fs.readFileSync(new URL('../src/migrations/schema.sql', import.meta.url), 'utf8');
await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, email text, full_name text, role text, status text DEFAULT 'active', password_hash text, client_type text, lead_number serial, lead_status text, assigned_to uuid, deleted_at timestamp, delete_reason text, has_registered boolean, phone_number text, created_at timestamp, updated_at timestamp, last_login timestamp)`);
await pool.query(`CREATE TABLE platform_settings (id int PRIMARY KEY, org_name text, logo_data text, logo_mime text, updated_by uuid, updated_at timestamp)`);
for (const tb of ['user_demographics', 'schools', 'school_teachers', 'assessments', 'reports', 'orders', 'consultation_requests', 'lead_activity']) await pool.query(`CREATE TABLE ${tb} (id uuid, user_id uuid, school_id uuid)`); // stubs of the app's existing tables (backup/restore touch them)
await pool.query(`INSERT INTO platform_settings (id, org_name) VALUES (1,'NavaSetu Initiatives')`);
for (const st of sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS cd_schools')).split(';').filter(x => x.trim())) await pool.query(st);
for (const q of ['cd_schools_id_seq', 'cd_submissions_id_seq', 'cd_leads_id_seq', 'users_lead_number_seq']) await pool.query(`CREATE SEQUENCE ${q}`); // pg-mem doesn't name serial sequences like Postgres does
const uid = () => crypto.randomUUID();
const admin = { id: uid() }, c1 = { id: uid() }, c2 = { id: uid() };
for (const [u, role, n] of [[admin, 'platform_admin', 'Boss'], [c1, 'counsellor', 'Asha'], [c2, 'counsellor', 'Ravi']]) await pool.query('INSERT INTO users (id,email,full_name,role) VALUES ($1,$2,$3,$4)', [u.id, n + '@x.in', n, role]);
const tok = (u, role) => 'Bearer ' + jwt.sign({ userId: u.id, email: 'x', role }, 'test-secret');
const TA = { 'Content-Type': 'application/json', Authorization: tok(admin, 'platform_admin') }, TC = { 'Content-Type': 'application/json', Authorization: tok(c1, 'counsellor') }, TC2 = { 'Content-Type': 'application/json', Authorization: tok(c2, 'counsellor') }, H = { 'Content-Type': 'application/json' };

// the real settings router (backup/restore) pointed at the same in-memory DB
realPool.query = pool.query.bind(pool); realPool.connect = () => pool.connect();
const app = express(); app.use(express.json({ limit: '10mb' })); app.use('/api/career', createCareerRouter(pool)); app.use('/api/settings', settingsRouter);
const srv = app.listen(0); const base = 'http://127.0.0.1:' + srv.address().port + '/api';
const call = async (m, p, b, h = H) => { const r = await fetch(base + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.clone().json().catch(() => ({})), r }; };
const ok = (c, m) => { assert(c, m); console.log('  ✓', m); };

// access control
ok((await call('GET', '/career/admin/schools')).s === 401, 'staff routes reject anonymous');
// school + consent gate
let r = await call('POST', '/career/admin/schools', { name: 'Test Public School', city: 'Wellington', code: 'tps1', headcount: { VIII: 300, IX: 300, X: 300, XI: 250, XII: 250 } }, TA);
let sid = r.j.school.id; ok(r.s === 200 && r.j.school.code === 'TPS1', 'school created, code upper-cased');
ok((await call('POST', '/career/admin/schools', { name: 'Nope School' }, TC)).s === 403, 'counsellor cannot create schools');
ok((await call('PATCH', '/career/admin/schools/' + sid, { isOpen: true }, TA)).s === 400, 'cannot open school without recorded consent');
ok((await call('GET', '/career/school/TPS1')).s === 403, 'student link closed before opening');
ok((await call('PATCH', '/career/admin/schools/' + sid, { consent: { by: 'Principal', note: 'circular 12' } }, TA)).s === 200, 'consent recorded');
ok((await call('PATCH', '/career/admin/schools/' + sid, { isOpen: true }, TA)).s === 200, 'school opened');
ok((await call('GET', '/career/school/tps1')).j.name === 'Test Public School', 'student link resolves (case-insensitive)');

// 2000 students
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (cls, stream, mode) => { const b = E.bandOf(cls), a = {}; E.expectedIds(b, stream).forEach(id => { a[id] = id.startsWith('l_') ? 'VARK'[Math.floor(rnd() * 4)] : (mode === 'same' ? 2 : Math.floor(rnd() * 4)); }); return a; };
const classes = ['VIII', 'IX', 'X', 'XI', 'XII'], streams = ['PCM', 'PCB', 'PCMB', 'COMM', 'COM', 'ARTS'];
const jobs = []; for (let i = 0; i < 2000; i++) { const cls = classes[i % 5], sec = 'ABCD'[Math.floor(i / 5) % 4], roll = String(Math.floor(i / 20) + 1); jobs.push({ cls, sec, roll, name: 'Student ' + i, stream: ['XI', 'XII'].includes(cls) ? streams[i % 6] : '', mode: i % 97 === 0 ? 'same' : 'rnd' }); }
const t0 = Date.now(); const codes = []; let idx = 0, bad = 0;
await Promise.all(Array.from({ length: 25 }, async () => { while (idx < jobs.length) { const j = jobs[idx++], now = Date.now();
  const x = await call('POST', '/career/submit', { schoolCode: 'TPS1', name: j.name, classLabel: j.cls, section: j.sec, roll: j.roll, stream: j.stream, answers: mk(j.cls, j.stream, j.mode), startedAt: now - (j.mode === 'same' ? 60e3 : 700e3), submittedAt: now });
  if (x.s !== 200) { bad++; if (bad < 4) console.log('FAIL', x.s, x.j); } else codes.push({ ...j, code: x.j.resultCode }); } }));
console.log(`  submitted ${codes.length}/2000 in ${Date.now() - t0} ms`);
ok(bad === 0 && codes.length === 2000 && new Set(codes.map(c => c.code)).size === 2000, '2000 students accepted with unique result codes');
const j0 = codes[0];
ok((await call('POST', '/career/submit', { schoolCode: 'TPS1', name: 'Dup', classLabel: j0.cls, section: j0.sec, roll: j0.roll, stream: j0.stream, answers: mk(j0.cls, j0.stream) })).s === 409, 'duplicate class/section/roll rejected');
ok((await call('POST', '/career/submit', { schoolCode: 'TPS1', name: 'Bad', classLabel: 'X', section: 'Z', roll: '99', answers: { i_R1: 3 } })).s === 400, 'incomplete answers rejected');
ok((await call('POST', '/career/submit', { schoolCode: 'NOPE', name: 'Bad', classLabel: 'X', section: 'Z', roll: '99', answers: {} })).s === 403, 'unknown school rejected');
const c = codes[5];
r = await call('POST', '/career/result', { schoolCode: 'TPS1', roll: c.roll, resultCode: c.code }); ok(r.j.status === 'pending' && !r.j.answers, 'pending student gets no result');
ok((await call('POST', '/career/result', { schoolCode: 'TPS1', roll: c.roll, resultCode: 'ZZZZZZ' })).s === 404, 'wrong code rejected');

// review (counsellor allowed)
ok((await call('GET', '/career/admin/submissions?schoolId=' + sid, null, TC)).j.total === 2000, 'counsellor can list submissions');
const flagged = (await call('GET', '/career/admin/submissions?schoolId=' + sid + '&flagged=1', null, TA)).j.total; ok(flagged >= 20, 'quality flags raised (' + flagged + ')');
r = await call('POST', '/career/admin/approve', { schoolId: sid, clean: true }, TC); ok(r.j.updated === 2000 - flagged, 'approve-all-clean skips flagged');
const list = (await call('GET', '/career/admin/submissions?schoolId=' + sid + '&status=approved', null, TA)).j.submissions; const one = list[0];
const cOne = codes.find(x => x.cls === one.cls && x.sec === one.section && x.roll === one.roll);
r = await call('POST', '/career/result', { schoolCode: 'TPS1', roll: cOne.roll, resultCode: cOne.code }); ok(r.j.status === 'approved' && Object.keys(r.j.answers).length === 41, 'approved student gets answers back');
const stored = (await call('GET', '/career/admin/submissions/' + one.id, null, TA)).j.submission; ok(JSON.stringify(E.compute(r.j.answers, E.bandOf(r.j.classLabel), r.j.stream).theme) === JSON.stringify(stored.scores.theme), 'server scores match client engine');
const pend = (await call('GET', '/career/admin/submissions?schoolId=' + sid + '&status=pending', null, TA)).j.submissions;
ok((await call('POST', '/career/admin/hold', { ids: [pend[0].id] }, TC)).j.updated === 1, 'hold works'); ok((await call('POST', '/career/admin/approve', { ids: [pend[1].id] }, TC)).j.updated === 1, 'approve selected works');
ok((await call('DELETE', '/career/admin/submissions/' + pend[2].id, null, TC)).s === 403, 'counsellor cannot erase a student');

// report
const rep = (await call('GET', '/career/admin/report/' + sid, null, TC)).j.report; ok(rep.totals.submitted === 2000 && rep.totals.held === 1, 'report totals');
ok(!JSON.stringify(rep).includes('Student 1') && !JSON.stringify(rep).includes(codes[3].code), 'report has no names or codes');
const tiny = await call('POST', '/career/admin/schools', { name: 'Tiny School' }, TA); const tid = tiny.j.school.id;
await call('PATCH', '/career/admin/schools/' + tid, { consent: { by: 'P' }, isOpen: true }, TA);
for (let i = 0; i < 3; i++) await call('POST', '/career/submit', { schoolCode: tiny.j.school.code, name: 'T' + i, classLabel: 'IX', section: 'A', roll: String(i + 1), answers: mk('IX', ''), startedAt: Date.now() - 600e3, submittedAt: Date.now() });
const trep = (await call('GET', '/career/admin/report/' + tid, null, TA)).j.report; ok(trep.interests.overall === null && trep.classes.find(x => x.cls === 'IX').suppressed, 'groups under 5 are suppressed');
// logo into the Excel report via the app's existing platform_settings logo
const png = (w, h) => { const ch = (ty, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(ty, 4); d.copy(b, 8); b.writeUInt32BE(zlib.crc32(b.slice(4, 8 + d.length)) >>> 0, 8 + d.length); return b; }; const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h, 120); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]); };
await pool.query('UPDATE platform_settings SET logo_data=$1, logo_mime=$2 WHERE id=1', [png(120, 60).toString('base64'), 'image/png']);
let xr = await call('GET', '/career/admin/report/' + sid + '/xlsx', null, TC); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await xr.r.arrayBuffer()));
ok(xr.s === 200 && wb.worksheets[0].getImages().length === 1, 'Excel report downloads with the app logo on it');
const csv = await (await call('GET', '/career/admin/codes.csv?schoolId=' + sid, null, TC)).r.text(); ok(csv.split('\r\n').length > 1000, 'result codes CSV');

// leads + counsellor scoping
r = await call('POST', '/career/lead', { studentName: 'Asha Rao', classLabel: 'IX', parentName: 'Parent One', parentPhone: '9876543210', consentAt: new Date().toISOString(), topAreas: [{ area: 'A', score: 80 }], answers: mk('IX', '', 'rand') }); ok(r.j.ok, 'public demo lead stored');
ok((await call('POST', '/career/lead', { classLabel: 'IX', parentName: 'Parent One', parentPhone: '9876543210', consentAt: new Date().toISOString() })).s === 400, 'demo lead without the student name rejected');
ok((await call('POST', '/career/lead', { studentName: 'X', parentPhone: '123' })).s === 400, 'lead without consent/valid phone rejected');
const sl = { schoolCode: 'TPS1', roll: cOne.roll, resultCode: cOne.code, contactName: 'Mr Sharma', mobile: '9811122233', email: 'p@x.in', consent: true };
ok((await call('POST', '/career/school-lead', sl)).j.ok && (await call('POST', '/career/school-lead', sl)).j.ok, 'school parent contact saved (twice, no duplicate)');
ok((await call('POST', '/career/school-lead', { ...sl, resultCode: 'ZZZZZZ' })).s === 404 && (await call('POST', '/career/school-lead', { ...sl, mobile: '12345' })).s === 400 && (await call('POST', '/career/school-lead', { ...sl, consent: false })).s === 400, 'school lead needs valid roll+code, mobile and consent');
let all = (await call('GET', '/career/admin/leads', null, TA)).j; ok(all.total === 2 && all.leads.some(l => l.source === 'school' && l.schoolName === 'Test Public School'), 'admin sees demo + school leads, no duplicate');
ok((await call('GET', '/career/admin/leads', null, TC)).j.total === 0, 'counsellor sees none until assigned');
const sch = all.leads.find(l => l.source === 'school');
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { status: 'contacted' }, TC)).s === 404, 'counsellor cannot touch an unassigned lead');
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { assignedTo: c1.id, status: 'contacted', note: 'called' }, TA)).s === 200, 'admin assigns lead to a counsellor');
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { assignedTo: c2.id }, TC)).s === 403, 'counsellor cannot reassign a lead');
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { assignedTo: 'not-a-uuid' }, TA)).s === 400, 'bad assignee rejected');
ok((await call('GET', '/career/admin/leads', null, TC)).j.total === 1 && (await call('GET', '/career/admin/leads', null, TC2)).j.total === 0, 'counsellor sees only their own leads');
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { status: 'interested' }, TC2)).s === 404, "another counsellor cannot touch it");
ok((await call('PATCH', '/career/admin/leads/' + sch.id, { status: 'interested' }, TC)).s === 200 && (await call('PATCH', '/career/admin/leads/' + sch.id, { status: 'bogus' }, TC)).s === 400, 'counsellor updates status; bogus rejected');
r = await call('POST', '/career/admin/leads', { contactName: 'Walk In', studentName: 'Walk Kid', mobile: '9822233344', email: 'w@in.in', note: 'fair' }, TC); ok(r.j.id, 'counsellor adds a lead (auto-assigned to them)');
ok((await call('GET', '/career/admin/leads', null, TC)).j.total === 2, 'own manual lead visible');
ok((await call('POST', '/career/admin/leads', { contactName: 'W', mobile: '123' }, TC)).s === 400, 'manual lead validates');
ok((await call('POST', '/career/admin/leads', { contactName: 'Walk In', mobile: '9822233344' }, TC)).s === 400, 'manual lead needs the student name');
// student name + report view for staff
const demoLead = (await call('GET', '/career/admin/leads', null, TA)).j.leads.find(l => l.source === 'demo');
ok(demoLead.studentName === 'Asha Rao' && demoLead.hasAnswers === true, 'demo lead shows the student name and has answers');
const ld = (await call('GET', '/career/admin/leads/' + demoLead.id, null, TA)).j.lead; ok(ld.studentName === 'Asha Rao' && Object.keys(ld.answers).length === 41, 'admin opens the demo student report data');
ok((await call('GET', '/career/admin/leads/' + demoLead.id, null, TC)).s === 404, 'counsellor cannot open an unassigned lead report');
const schLead = (await call('GET', '/career/admin/leads', null, TA)).j.leads.find(l => l.source === 'school'); ok(schLead.hasAnswers && (await call('GET', '/career/admin/leads/' + schLead.id, null, TC)).s === 200, 'school lead carries the answers; assigned counsellor can open it');
const subs = (await call('GET', '/career/admin/submissions?schoolId=' + sid, null, TC)).j.submissions; ok(subs[0].resultCode && /^[A-Z2-9]{6}$/.test(subs[0].resultCode), 'staff see each student result code');
ok((await (await call('GET', '/career/admin/leads.csv?source=school', null, TC)).r.text()).includes('Mr Sharma'), 'leads CSV');
ok((await call('DELETE', '/career/admin/leads/' + r.j.id, null, TC)).s === 403 && (await call('DELETE', '/career/admin/leads/' + r.j.id, null, TA)).s === 200, 'only admin deletes leads');

// backup + restore through the app's existing settings router
const bk = (await call('GET', '/settings/backup', null, TA)).j; ok(bk.data.careerDiscovery && bk.data.careerDiscovery.submissions.length === 2003 && bk.data.careerDiscovery.leads.length === 2, 'existing backup export now includes career data');
const victim = (await call('GET', '/career/admin/submissions?schoolId=' + sid + '&status=held', null, TA)).j.submissions[0];
await call('DELETE', '/career/admin/submissions/' + victim.id, null, TA);
const before = (await call('GET', '/career/admin/submissions?schoolId=' + sid, null, TA)).j.total;
const rs = await call('POST', '/settings/backup/restore', { confirm: 'RESTORE', data: JSON.parse(JSON.stringify(bk.data)) }, TA);
ok(rs.s === 200, 'existing restore accepts the backup' + (rs.s === 200 ? '' : ': ' + JSON.stringify(rs.j)));
ok((await call('GET', '/career/admin/submissions?schoolId=' + sid, null, TA)).j.total === before + 1, 'restore brings the erased student back, same school id');
ok((await call('POST', '/career/result', { schoolCode: 'TPS1', roll: cOne.roll, resultCode: cOne.code })).j.status === 'approved', 'result codes still work after restore');
ok((await call('GET', '/career/admin/leads', null, TC)).j.total === 1, 'lead assignment survives restore');
ok((await call('POST', '/career/admin/schools', { name: 'After Restore' }, TA)).s === 200 && (await call('POST', '/career/admin/leads', { contactName: 'After', studentName: 'After Kid', mobile: '9877700000' }, TA)).s === 200, 'new rows still insert after restore (sequences resynced)');
// delete
ok((await call('DELETE', '/career/admin/schools/' + tid, null, TA)).s === 400, 'school delete needs confirm'); ok((await call('DELETE', '/career/admin/schools/' + tid + '?confirm=DELETE', null, TA)).s === 200, 'school delete cascades');
console.log('\nALL PASSED'); srv.close(); process.exit(0);
