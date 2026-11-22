// Browser-level test (jsdom) of career.html and the Career Discovery tab inside admin.html, against the real routers.
process.env.JWT_SECRET = 'test-secret'; process.env.NODE_ENV = 'test';
import express from 'express'; import assert from 'assert'; import fs from 'fs'; import jwt from 'jsonwebtoken'; import crypto from 'crypto';
import { newDb } from 'pg-mem'; import { JSDOM } from 'jsdom';
const { createCareerRouter } = await import('../src/routes/career.js'); const { pool: realPool } = await import('../src/config/database.js'); const settingsRouter = (await import('../src/routes/settings.js')).default;
const db = newDb(); const { Pool } = db.adapters.createPg(); const pool = new Pool();
const sql = fs.readFileSync(new URL('../src/migrations/schema.sql', import.meta.url), 'utf8');
await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, email text, full_name text, role text, status text DEFAULT 'active')`);
await pool.query(`CREATE TABLE platform_settings (id int PRIMARY KEY, org_name text, logo_data text, logo_mime text, updated_by uuid, updated_at timestamp)`); await pool.query(`INSERT INTO platform_settings (id, org_name) VALUES (1,'NavaSetu Initiatives')`);
for (const st of sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS cd_schools')).split(';').filter(x => x.trim())) await pool.query(st);
const admin = crypto.randomUUID(), couns = crypto.randomUUID();
await pool.query("INSERT INTO users (id,email,full_name,role) VALUES ($1,'a@x.in','Boss','platform_admin'),($2,'c@x.in','Asha','counsellor')", [admin, couns]);
realPool.query = pool.query.bind(pool);
const app = express(); app.use(express.json()); app.use(express.static(new URL('../public', import.meta.url).pathname, { index: false })); app.use('/api/career', createCareerRouter(pool)); app.use('/api/settings', settingsRouter);
app.get('/api/leads-stub', (q, r) => r.json({ leads: [] }));
const srv = app.listen(0); const base = 'http://127.0.0.1:' + srv.address().port;
const sign = (id, role) => jwt.sign({ userId: id, email: 'x', role }, 'test-secret', { expiresIn: '1h' });
const H = t => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }), TA = sign(admin, 'platform_admin'), TC = sign(couns, 'counsellor');
const post = (p, b, t) => fetch(base + '/api/career' + p, { method: 'POST', headers: H(t || ''), body: JSON.stringify(b) }).then(r => r.json());
const sc = (await post('/admin/schools', { name: 'Demo School', code: 'DEMO', headcount: { IX: 10 } }, TA)).school;
await fetch(base + '/api/career/admin/schools/' + sc.id, { method: 'PATCH', headers: H(TA), body: JSON.stringify({ consent: { by: 'Principal' }, isOpen: true }) });
const wait = ms => new Promise(r => setTimeout(r, ms));
const open = async (path, pre) => {
  let html = await (await fetch(base + path.split('?')[0])).text(); html = html.replace(/<link[^>]*>/g, '').replace(/<script src="https:[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: base + path, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.fetch = (u, o) => fetch(new URL(u, base), o); w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); pre && pre(w); } });
  await wait(900); return dom.window;
};
const ok = (c, m) => { assert(c, m); console.log('  ✓', m); };

// ---- student journey ----
let w = await open('/career.html?school=demo'), d = w.document;
ok(d.getElementById('app').textContent.includes('Demo School') && d.getElementById('roll'), 'school link opens the intro for Demo School');
d.getElementById('go').click(); ok(d.getElementById('err').textContent, 'empty form is blocked');
d.getElementById('name').value = 'Riya Sharma'; d.getElementById('cls').value = 'IX'; d.getElementById('section').value = 'b'; d.getElementById('roll').value = '17'; d.getElementById('consent').checked = true; d.getElementById('go').click();
let pages = 0; while (d.querySelector('.progress') && pages < 12) { pages++; for (const q of new Set([...d.querySelectorAll('.opt')].map(b => b.dataset.q))) { const bs = [...d.querySelectorAll(`.opt[data-q="${q}"]`)]; bs[(q.length + pages) % bs.length].click(); } d.getElementById('go').click(); await wait(10); }
await wait(600); ok(d.getElementById('app').textContent.includes('Your result code'), 'answers submitted to /api/career/submit');
const code = d.querySelector('[style*="letter-spacing:.2em"]').textContent.trim();
ok(!d.getElementById('app').textContent.includes('Your interest profile'), 'no result before approval');
d.getElementById('tocheck').click(); d.getElementById('roll').value = '17'; d.getElementById('code').value = code; d.getElementById('docheck').click(); await wait(500);
ok(d.getElementById('app').textContent.includes('being reviewed'), 'check before approval says "being reviewed"');
const subs = (await (await fetch(base + '/api/career/admin/submissions?schoolId=' + sc.id, { headers: H(TC) })).json()).submissions;
await fetch(base + '/api/career/admin/approve', { method: 'POST', headers: H(TC), body: JSON.stringify({ ids: [subs[0].id] }) });
d.getElementById('docheck').click(); await wait(600);
ok(d.getElementById('app').textContent.includes('Riya Sharma') && d.getElementById('app').textContent.includes('Your interest profile'), 'result renders after a counsellor approves');
const apTxt = d.getElementById('app').textContent;
ok(apTxt.includes('Book a free 15-minute call') && apTxt.includes('8556840001') && apTxt.includes('Explore the Career Library') && d.querySelector('img[src="/ns-dashboard.jpg"]'), 'result shows booking, WhatsApp, career library and the dashboard screenshot');
ok([...d.querySelectorAll('a')].some(a => a.href === 'https://navasetu.edumilestones.com/career-counsellor/Dr-Vibhuti-Jasrotia') && [...d.querySelectorAll('a')].some(a => a.href === 'https://navasetu.edumilestones.com/global-career-library/') && [...d.querySelectorAll('a')].some(a => a.href.startsWith('https://wa.me/918556840001')), 'the three links point to the right places');
d.getElementById('sendlead').click(); ok(d.getElementById('lerr').textContent, 'parent contact form validates');
d.getElementById('lname').value = 'Mr Sharma'; d.getElementById('lmob').value = '9811122233'; d.getElementById('lemail').value = 'p@x.in'; d.getElementById('lconsent').checked = true; d.getElementById('sendlead').click(); await wait(600);
ok(d.getElementById('app').textContent.includes('We have noted your details'), 'parent contact accepted');
ok(w.errs.length === 0, 'no JS errors in the student app: ' + w.errs.join('; '));
w = await open('/career.html'); ok(w.document.getElementById('phone'), 'public demo mode still asks for parent phone + consent');
// logo from the app's existing settings
await pool.query("UPDATE platform_settings SET logo_data=$1, logo_mime='image/png' WHERE id=1", [Buffer.alloc(300, 7).toString('base64')]);
w = await open('/career.html?school=DEMO'); ok(w.document.querySelector('header.top img[data-brand-logo]'), 'logo uploaded in HR Panel replaces the crest in the student app');
await pool.query('UPDATE platform_settings SET logo_data=NULL');

// ---- admin: Career Discovery tab ----
const adminFlow = async (tok, isAdm) => {
  const aw = await open('/admin.html', w => { w.localStorage.setItem('navasetu_admin_token', tok); }); const ad = aw.document;
  ok(ad.getElementById('app').style.display === 'block', (isAdm ? 'admin' : 'counsellor') + ' enters the HR Panel');
  ad.getElementById('navCareer').click(); await wait(800);
  const txt = () => ad.getElementById('cdRoot').textContent;
  ok(txt().includes('Demo School') && txt().includes('/career.html?school=DEMO'), 'Career tab lists the school and its student link');
  ok(isAdm ? !!ad.getElementById('cdadd') : !ad.getElementById('cdadd'), isAdm ? 'admin sees "Add a school"' : 'counsellor does not see school management');
  ad.querySelector('[data-cdt="review"]').click(); await wait(800); ok(txt().includes('Riya Sharma') && ad.querySelector('#cdRoot .tag.approved'), 'Review tab lists the student with status');
  ad.querySelector('[data-cdt="report"]').click(); await wait(800); ok(txt().includes('Key findings') && txt().includes('Participation'), 'Report tab renders the anonymous report');
  ad.querySelector('[data-cdt="leads"]').click(); await wait(800);
  return { aw, ad, txt };
};
let { ad, txt, aw } = await adminFlow(TA, true);
ok(txt().includes('Mr Sharma') && txt().includes('School activity'), 'admin sees the parent contact in Student leads');
ad.getElementById('cdladd').click(); ad.getElementById('cdan').value = 'Walk In'; ad.getElementById('cdas').value = 'Walk Kid'; ad.getElementById('cdam').value = '9822233344'; ad.getElementById('cdasave').click(); await wait(800); ok(txt().includes('Walk In'), 'admin adds a lead from the console');
ok(ad.querySelector('.cdlasg') && [...ad.querySelectorAll('.cdlasg')[0].options].length >= 1, 'admin gets the assign-to dropdown');
ok(aw.errs.length === 0, 'no JS errors in the admin tab: ' + aw.errs.join('; '));
({ ad, txt, aw } = await adminFlow(TC, false)); ok(!txt().includes('Mr Sharma'), 'counsellor sees only leads assigned to them (none yet)');
ok(!ad.querySelector('.cdlasg'), 'counsellor has no assign dropdown'); ok(aw.errs.length === 0, 'no JS errors for counsellor');
// relogin on a new visit: the roll number and code are remembered on this device, and the result opens again
const w2 = await open('/career.html?school=DEMO', w0 => w0.localStorage.setItem('ns_career_login_DEMO', JSON.stringify({ roll: '17', code })));
w2.document.getElementById('tocheck').click(); await wait(200);
ok(w2.document.getElementById('roll').value === '17' && w2.document.getElementById('code').value === code, 'returning student finds the roll number and code filled in');
w2.document.getElementById('docheck').click(); await wait(700); ok(w2.document.getElementById('app').textContent.includes('Your interest profile'), 'student opens the same result again');
// staff view of one student's report
const subRow = (await (await fetch(base + '/api/career/admin/submissions?schoolId=' + sc.id, { headers: H(TC) })).json()).submissions[0];
const w3 = await open('/career.html?review=sub:' + subRow.id, w0 => w0.localStorage.setItem('navasetu_admin_token', TC)); await wait(500);
const t3 = w3.document.getElementById('app').textContent; ok(t3.includes('Riya Sharma') && t3.includes('Your interest profile') && t3.includes('staff view') && !t3.includes('Book a free 15-minute call'), 'staff open the student report from the panel');
const w4 = await open('/career.html?review=sub:' + subRow.id); ok(w4.document.getElementById('app').textContent.includes('sign in'), 'no staff sign-in, no report');

console.log('\nUI TESTS PASSED'); srv.close(); process.exit(0);
