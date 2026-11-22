/* Career Discovery back-office, loaded by admin.html. Uses that page's globals: api(), token, currentAdmin, loadCounsellors().
   Admins: everything. Counsellors: review/approve, reports, and only the leads assigned to them. */
(function () {
  const E = window.Engine;
  const root = () => document.getElementById('cdRoot');
  const $ = s => root().querySelector(s), $$ = s => root().querySelectorAll(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isAdmin = () => currentAdmin && currentAdmin.role === 'platform_admin';
  const A = (p, o) => api('/career/admin' + p, o);
  const J = b => ({ method: 'POST', body: JSON.stringify(b) });
  const st = { tab: 'schools', schools: [], schoolId: '', sel: new Set(), page: 0, f: { cls: '', status: '', flagged: '' }, lf: { source: '', status: '', q: '', schoolId: '' } };
  const bar = (v, g) => `<div class="cdbar ${g ? 'g' : ''}"><i style="width:${v || 0}%"></i></div>`;
  const fmtD = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  async function dl(path, name) {
    const r = await fetch('/api/career/admin' + path, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return alert('Download failed'); const b = await r.blob(), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const picker = () => `<label>School</label><select id="cdsp" class="cdw">${st.schools.map(s => `<option value="${s.id}"${String(s.id) === st.schoolId ? ' selected' : ''}>${esc(s.name)} (${esc(s.code)})</option>`).join('')}</select>`;
  const needSchool = () => { root().querySelector('#cdBody').innerHTML = '<div class="card"><p class="muted">Add a school first (an admin can do this on the Schools tab).</p></div>'; };

  window.loadCareer = async function () {
    if (!E) { document.getElementById('tab-career').innerHTML = '<div class="card">Career engine failed to load.</div>'; return; }
    const tabs = [['schools', 'Schools'], ['review', 'Review & approve'], ['report', 'School report'], ['leads', 'Student leads']];
    root().innerHTML = `<style>
      .cd input,.cd select{width:auto}.cd .cdw{min-width:200px}.cd .row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end}.cd .row label{margin-top:0}
      .cd .tabs{display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap}.cd .tabs button{border:1px solid var(--border);background:#fff;border-radius:99px;padding:.35rem .9rem;cursor:pointer;font-size:.85rem;margin:0}.cd .tabs button.on{background:var(--primary);color:#fff}
      .cd .cdbar{height:9px;background:#ece7d3;border-radius:9px;overflow:hidden;min-width:80px}.cd .cdbar i{display:block;height:100%;background:var(--primary)}.cd .cdbar.g i{background:var(--gold)}
      .cd .scroll{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:6px}.cd .scroll th{position:sticky;top:0;background:#f9fafb}
      .cd .meter{display:grid;grid-template-columns:200px 1fr 44px;gap:8px;align-items:center;margin:4px 0;font-size:.85rem}.cd .tag{display:inline-block;border-radius:99px;padding:1px 9px;font-size:.72rem;font-weight:600;background:#EDE9FE;color:#5B21B6}
      .cd .tag.approved,.cd .tag.open,.cd .tag.converted{background:#D1FAE5;color:#065F46}.cd .tag.pending,.cd .tag.contacted{background:#FEF3C7;color:#92400E}.cd .tag.held,.cd .tag.closed{background:#FCE7E9;color:#9F1239}
      .cd .link{font-family:ui-monospace,monospace;font-size:.8rem;background:#f1f3fb;padding:4px 8px;border-radius:6px;word-break:break-all}.cd .err{color:var(--danger);min-height:1.2em;font-size:.85rem}
      .cd .rep h3{margin:16px 0 6px;font-size:1rem}.cd .note{background:#f1f3fb;border:1px solid #dde1f3;border-radius:8px;padding:8px 10px;font-size:.82rem}
    </style><div class="cd"><div class="tabs">${tabs.map(([k, l]) => `<button data-cdt="${k}" class="${st.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="cdBody"></div></div>`;
    $$('[data-cdt]').forEach(b => b.onclick = () => { st.tab = b.dataset.cdt; window.loadCareer(); });
    try { st.schools = (await A('/schools')).schools; if (!st.schoolId && st.schools[0]) st.schoolId = String(st.schools[0].id); await ({ schools: vSchools, review: vReview, report: vReport, leads: vLeads })[st.tab](); }
    catch (e) { $('#cdBody').innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
  };

  /* ---------- schools ---------- */
  function vSchools() {
    const link = c => location.origin + '/career.html?school=' + c;
    $('#cdBody').innerHTML = `
    ${isAdmin() ? `<div class="card"><h2>Add a school</h2>
      <div class="row"><div><label>School name</label><input id="cdn" style="width:260px"></div><div><label>City</label><input id="cdc" style="width:140px"></div><div><label>Link code (optional)</label><input id="cdcode" style="width:120px" maxlength="12" placeholder="auto"></div></div>
      <label>Students per class (optional, used for participation %)</label>
      <div class="row">${E.CLASSES.map(c => `<div><label style="margin:0">${c}</label><input type="number" min="0" class="cdhc" data-c="${c}" style="width:80px"></div>`).join('')}</div>
      <div class="err" id="cdserr"></div><button class="btn" id="cdadd">Create school</button></div>` : ''}
    ${st.schools.map(s => `<div class="card">
      <div class="row"><h2 style="margin:0">${esc(s.name)}</h2><span class="tag ${s.isOpen ? 'open' : 'closed'}">${s.isOpen ? 'Open' : 'Closed'}</span><span class="muted">${esc(s.city || '')}</span>
        <span class="muted" style="margin-left:auto">${s.counts.pending} pending · ${s.counts.approved} approved · ${s.counts.held} held</span></div>
      <p class="muted" style="margin:8px 0 2px">Student link:</p><div class="link">${esc(link(s.code))}</div>
      ${isAdmin() ? `<div class="row" style="margin-top:8px">
        <div><label>Parental consent confirmed by (name and role at school)</label><input class="cdby" data-id="${s.id}" style="width:280px" value="${esc(s.consentBy || '')}"></div>
        <div><label>Note (e.g. circular no. / date)</label><input class="cdnote" data-id="${s.id}" style="width:240px" value="${esc(s.consentNote || '')}"></div>
        <button class="btn secondary cdsavec" data-id="${s.id}" style="margin:0">Save consent</button></div>` : ''}
      <p class="muted">${s.consentAt ? 'Consent recorded ' + fmtD(s.consentAt) + (s.consentBy ? ' (' + esc(s.consentBy) + ')' : '') + '.' : 'Consent not recorded yet. The activity cannot be opened without it.'}</p>
      ${isAdmin() ? `<div class="row"><button class="btn cdtoggle" data-id="${s.id}" data-open="${s.isOpen ? 0 : 1}" style="margin:0">${s.isOpen ? 'Close activity' : 'Open activity'}</button>
        <button class="btn danger cddelsch" data-id="${s.id}" data-name="${esc(s.name)}" style="margin:0">Delete school and all data</button></div>` : ''}
    </div>`).join('') || '<div class="card muted">No schools yet.</div>'}`;
    if ($('#cdadd')) $('#cdadd').onclick = async () => {
      const hc = {}; $$('.cdhc').forEach(i => { if (i.value) hc[i.dataset.c] = Number(i.value); });
      try { await A('/schools', J({ name: $('#cdn').value, city: $('#cdc').value, code: $('#cdcode').value, headcount: hc })); window.loadCareer(); } catch (e) { $('#cdserr').textContent = e.message; }
    };
    $$('.cdsavec').forEach(b => b.onclick = async () => { const id = b.dataset.id; try { await A('/schools/' + id, { method: 'PATCH', body: JSON.stringify({ consent: { by: $(`.cdby[data-id="${id}"]`).value, note: $(`.cdnote[data-id="${id}"]`).value } }) }); window.loadCareer(); } catch (e) { alert(e.message); } });
    $$('.cdtoggle').forEach(b => b.onclick = async () => { try { await A('/schools/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ isOpen: b.dataset.open === '1' }) }); window.loadCareer(); } catch (e) { alert(e.message); } });
    $$('.cddelsch').forEach(b => b.onclick = async () => { if (prompt('This permanently deletes "' + b.dataset.name + '" and every student record. Type DELETE to confirm.') !== 'DELETE') return; try { await A('/schools/' + b.dataset.id + '?confirm=DELETE', { method: 'DELETE' }); window.loadCareer(); } catch (e) { alert(e.message); } });
  }

  /* ---------- review & approve ---------- */
  async function vReview() {
    if (!st.schools.length) return needSchool();
    const f = st.f, q = new URLSearchParams({ schoolId: st.schoolId }); if (f.cls) q.set('cls', f.cls); if (f.status) q.set('status', f.status); if (f.flagged) q.set('flagged', '1');
    const data = await A('/submissions?' + q), PS = 100, pages = Math.max(1, Math.ceil(data.submissions.length / PS)); st.page = Math.min(st.page, pages - 1);
    const rows = data.submissions.slice(st.page * PS, st.page * PS + PS), sch = st.schools.find(s => String(s.id) === st.schoolId), again = () => { vReview(); };
    $('#cdBody').innerHTML = `
    <div class="card"><div class="row">${picker()}
      <div><label>Class</label><select id="cdfc"><option value="">All</option>${E.CLASSES.map(c => `<option${f.cls === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="cdfs"><option value="">All</option>${['pending', 'approved', 'held'].map(c => `<option${f.status === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
      <label style="display:flex;gap:6px;align-items:center;margin:0 0 6px"><input type="checkbox" id="cdff"${f.flagged ? ' checked' : ''}> Flagged only</label></div>
      <p class="muted" style="margin:8px 0 0">Students see a result only after you approve it. "Flagged" means answered very fast or with near-identical answers: look at these before releasing. Approve-all-clean skips them.</p>
      <div class="row" style="margin-top:6px"><button class="btn" id="cdapclean">Approve all clean pending (${esc(sch ? sch.name : '')})</button><button class="btn secondary" id="cdapsel">Approve selected (${st.sel.size})</button><button class="btn secondary" id="cdhold">Hold selected</button>
        <button class="btn secondary" id="cdcodes">Result codes CSV</button><button class="btn secondary" id="cdfup">Follow-up list CSV</button></div></div>
    <div class="card"><div class="muted">${data.total} students · page ${st.page + 1} of ${pages}
      <button class="btn secondary" id="cdpp" style="margin:0 4px"${st.page ? '' : ' disabled'}>Prev</button><button class="btn secondary" id="cdpn" style="margin:0"${st.page < pages - 1 ? '' : ' disabled'}>Next</button></div>
      <div class="scroll"><table><thead><tr><th><input type="checkbox" id="cdall"></th><th>Class</th><th>Roll</th><th>Student name</th><th>Result code</th><th>Top career areas</th><th>Flags</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><input type="checkbox" class="cdsel" value="${r.id}"${st.sel.has(r.id) ? ' checked' : ''}></td><td>${r.cls}-${esc(r.section)}</td><td>${esc(r.roll)}</td><td><b>${esc(r.name)}</b></td><td><code>${esc(r.resultCode)}</code></td>
        <td>${r.topAreas.map(a => esc(a.name)).join(', ')}</td><td>${r.flags.map(x => `<span class="tag">${esc(x)}</span>`).join(' ')}</td>
        <td>${r.durationSec == null ? '' : Math.round(r.durationSec / 60) + ' min'}</td><td><span class="tag ${r.status}">${r.status}</span></td>
        <td><button class="btn secondary cdview" data-ref="sub:${r.id}" style="margin:0;padding:.25rem .6rem">View report</button> ${isAdmin() ? `<button class="btn danger cddel" data-id="${r.id}" style="margin:0;padding:.25rem .6rem">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">No students match.</td></tr>'}
      </tbody></table></div></div>`;
    $('#cdsp').onchange = e => { st.schoolId = e.target.value; st.page = 0; st.sel.clear(); again(); };
    $('#cdfc').onchange = e => { f.cls = e.target.value; st.page = 0; again(); }; $('#cdfs').onchange = e => { f.status = e.target.value; st.page = 0; again(); }; $('#cdff').onchange = e => { f.flagged = e.target.checked ? '1' : ''; st.page = 0; again(); };
    $('#cdpp').onclick = () => { st.page--; again(); }; $('#cdpn').onclick = () => { st.page++; again(); };
    $('#cdall').onchange = e => { rows.forEach(r => e.target.checked ? st.sel.add(r.id) : st.sel.delete(r.id)); again(); };
    $$('.cdsel').forEach(c => c.onchange = () => { c.checked ? st.sel.add(c.value) : st.sel.delete(c.value); $('#cdapsel').textContent = 'Approve selected (' + st.sel.size + ')'; });
    const run = async fn => { try { await fn(); } catch (e) { alert(e.message); } };
    $('#cdapclean').onclick = () => run(async () => { if (!confirm('Approve every pending student with no quality flag in this school? They will be able to see their result.')) return; const r = await A('/approve', J({ schoolId: Number(st.schoolId), clean: true })); alert(r.updated + ' results released.'); again(); });
    $('#cdapsel').onclick = () => run(async () => { if (!st.sel.size) return; const r = await A('/approve', J({ ids: [...st.sel] })); st.sel.clear(); alert(r.updated + ' results released.'); again(); });
    $('#cdhold').onclick = () => run(async () => { if (!st.sel.size) return; await A('/hold', J({ ids: [...st.sel] })); st.sel.clear(); again(); });
    $('#cdcodes').onclick = () => dl('/codes.csv?schoolId=' + st.schoolId, 'result-codes.csv'); $('#cdfup').onclick = () => dl('/followup.csv?schoolId=' + st.schoolId, 'followup.csv');
    $$('.cdview').forEach(b => b.onclick = () => window.open('/career.html?review=' + b.dataset.ref, '_blank'));
    $$('.cddel').forEach(b => b.onclick = () => run(async () => { if (!confirm("Permanently delete this student's record?")) return; await A('/submissions/' + b.dataset.id, { method: 'DELETE' }); again(); }));
  }

  /* ---------- school report (anonymous aggregate) ---------- */
  function reportHtml(r, org) {
    const T = E.THEMES, K = r.minGroup, na = `<span class="muted">fewer than ${K}</span>`, active = r.classes.filter(c => c.n);
    const meters = (o, labels) => o ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="meter"><span>${esc(labels(k))}</span>${bar(v, 1)}<b>${v}%</b></div>`).join('') : na;
    const share = list => list ? list.map(x => `<div class="meter"><span>${esc(x.label || x.name)}</span>${bar(x.pct)}<b>${x.pct}%</b></div>`).join('') : na;
    return `<div style="border-bottom:3px solid var(--gold);padding-bottom:8px;display:flex;gap:14px;align-items:center;justify-content:space-between"><div><h2 style="margin:0">${esc(r.school.name)}</h2>
      <div class="muted">Career Discovery activity report${r.school.city ? ' · ' + esc(r.school.city) : ''} · ${new Date(r.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br>Prepared by ${esc(org)}</div></div><img src="/api/settings/logo" style="max-height:64px" onerror="this.style.display='none'" alt=""></div>
    <h3>Key findings</h3><ul>${r.insights.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Participation</h3><table><thead><tr><th>Class</th><th>Students</th><th>Headcount</th><th>Participation</th></tr></thead><tbody>${r.classes.map(c => `<tr><td>${c.cls}</td><td>${c.n}</td><td>${c.headcount || '–'}</td><td>${c.participation == null ? '–' : c.participation + '%'}</td></tr>`).join('')}<tr><th>Total</th><th>${r.totals.included}</th><th></th><th></th></tr></tbody></table>
    <h3>Interest profile (average score, all students)</h3>${meters(r.interests.overall, k => T[k].name + ' (' + T[k].full + ')')}
    ${active.length ? `<h3>Interest profile by class</h3><table><thead><tr><th>Class</th>${Object.keys(T).map(k => `<th>${T[k].name}</th>`).join('')}</tr></thead><tbody>${active.map(c => { const o = r.interests.byClass[c.cls]; return `<tr><td>${c.cls}</td>${Object.keys(T).map(k => `<td>${o ? o[k] + '%' : '–'}</td>`).join('')}</tr>`; }).join('')}</tbody></table>` : ''}
    <h3>Career areas most often in students' top three</h3>${share(r.areas.overall)}
    ${active.map(c => `<p class="muted" style="margin:6px 0 2px"><b>Class ${c.cls}:</b> ${r.areas.byClass[c.cls] ? r.areas.byClass[c.cls].map(a => esc(a.name) + ' ' + a.pct + '%').join(' · ') : na}</p>`).join('')}
    ${r.leaning.classes810 ? `<h3>Stream leaning, Classes VIII–X</h3>${share(r.leaning.classes810)}<p class="muted">A leaning to discuss with families, not a recommendation or a decision.</p>` : ''}
    ${r.subjects.classes1112 ? `<h3>Current subject combinations, Classes XI–XII</h3>${share(r.subjects.classes1112)}` : ''}
    <h3>Learning preferences</h3>${share(r.learning.overall)}
    <h3>What matters at work (average importance)</h3>${meters(r.motivators.overall, k => E.MOTIV_TXT[k][0])}
    <h3>Self-rated strengths (average comfort, not measured ability)</h3>${meters(r.strengths.overall, k => E.STRENGTH.find(s => s[0] === k)[1])}
    <div class="note" style="margin-top:14px">This is an indicative, self-reported snapshot to guide career conversations and activities. It is not a diagnostic or selection tool. For a measured, in-depth assessment and individual counselling, contact ${esc(org)} · www.navasetu.online · navasetuinitiatives@gmail.com</div>`;
  }
  async function vReport() {
    if (!st.schools.length) return needSchool();
    const r = (await A('/report/' + st.schoolId)).report; let org = 'NavaSetu Initiatives'; try { org = (await (await fetch('/api/settings')).json()).org_name || org; } catch (e) { /* default */ }
    $('#cdBody').innerHTML = `<div class="card"><div class="row">${picker()}<button class="btn" id="cdpr" style="margin:0">Print / Save as PDF</button><button class="btn secondary" id="cdxl" style="margin:0">Download Excel</button></div>
      <p class="muted" style="margin:8px 0 0">The report is anonymous: no names or roll numbers, and any class with fewer than ${r.minGroup} students is not broken out. It counts pending and approved students, not held ones.</p></div>
      <div class="card rep" id="cdRep">${reportHtml(r, org)}</div>`;
    $('#cdsp').onchange = e => { st.schoolId = e.target.value; vReport(); };
    $('#cdxl').onclick = () => dl('/report/' + st.schoolId + '/xlsx', 'career-discovery-report.xlsx');
    $('#cdpr').onclick = () => { const w = window.open('', '_blank'); w.document.write(`<html><head><title>${esc(r.school.name)} - Career Discovery report</title><style>body{font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#1F2937;margin:24px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #E5E7EB}.meter{display:grid;grid-template-columns:200px 1fr 44px;gap:8px;align-items:center;margin:4px 0}.cdbar{height:9px;background:#ece7d3;border-radius:9px;overflow:hidden}.cdbar i{display:block;height:100%;background:#0a0e27}.cdbar.g i{background:#D4A017}.muted{color:#6B7280}.note{background:#f1f3fb;border:1px solid #dde1f3;border-radius:8px;padding:8px 10px}h3{margin:14px 0 6px;page-break-after:avoid}table,.meter{page-break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${$('#cdRep').innerHTML}<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`); w.document.close(); };
  }

  /* ---------- student leads ---------- */
  const LSTAT = ['new', 'contacted', 'interested', 'converted', 'not-interested'], SRC = { demo: 'Public demo', school: 'School activity', manual: 'Added by staff' };
  async function vLeads() {
    const f = st.lf, q = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    const d = await A('/leads?' + q), couns = await loadCounsellors();
    $('#cdBody').innerHTML = `
    <div class="card"><div class="row"><h2 style="margin:0">Student leads</h2><span class="muted">${d.total} shown${isAdmin() ? '' : ' (leads assigned to you)'}</span><button class="btn secondary" id="cdlcsv" style="margin:0 0 0 auto">Download CSV</button><button class="btn" id="cdladd" style="margin:0">Add a lead</button></div>
      <p class="muted" style="margin:6px 0">Parents' contact details left through the free student app. They are kept by NavaSetu only and are never shown to the school.</p>
      <div class="row"><div><label>Search name / mobile / email</label><input id="cdlq" value="${esc(f.q)}" style="width:210px"></div>
        <div><label>Source</label><select id="cdlsrc"><option value="">All</option>${Object.entries(SRC).map(([k, v]) => `<option value="${k}"${f.source === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>Status</label><select id="cdlst"><option value="">All</option>${LSTAT.map(x => `<option${f.status === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label>School</label><select id="cdlsc"><option value="">All</option>${st.schools.map(s => `<option value="${s.id}"${String(s.id) === f.schoolId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <button class="btn secondary" id="cdlgo" style="margin:0">Search</button></div></div>
    <div class="card" id="cdaddbox" style="display:none"><h2>Add a lead</h2><div class="row"><div><label>Name</label><input id="cdan" style="width:190px"></div><div><label>Mobile</label><input id="cdam" maxlength="10" style="width:130px"></div><div><label>Email</label><input id="cdae" style="width:210px"></div>
      <div><label>Student name</label><input id="cdas" style="width:160px"></div><div><label>Class</label><input id="cdac" style="width:70px"></div></div><label>Note</label><input id="cdano" style="width:100%"><div class="err" id="cdaerr"></div><button class="btn" id="cdasave">Save lead</button></div>
    <div class="card"><div class="scroll"><table><thead><tr><th>Date</th><th>Student name</th><th>Class</th><th>Parent / contact</th><th>Mobile</th><th>Email</th><th>Source</th><th>Status</th>${isAdmin() ? '<th>Assigned</th>' : ''}<th>Note</th><th></th></tr></thead><tbody>
    ${d.leads.map(l => `<tr><td>${fmtD(l.createdAt)}</td><td><b>${esc(l.studentName) || '<span class="muted">not given</span>'}</b><div class="muted">${(l.topAreas || []).map(a => esc(a.name || a.area)).join(', ')}${l.schoolName ? ' · ' + esc(l.schoolName) : ''}</div>${l.hasAnswers ? `<button class="btn secondary cdview" data-ref="lead:${l.id}" style="margin:4px 0 0;padding:.2rem .55rem">View report</button>` : ''}</td>
      <td>${esc(l.classLabel)} ${esc(l.stream)}</td><td>${esc(l.contactName)}</td><td>${esc(l.mobile)}</td><td>${esc(l.email)}</td>
      <td><span class="tag">${SRC[l.source] || l.source}</span></td>
      <td><select class="cdlstat" data-id="${l.id}">${LSTAT.map(x => `<option${l.status === x ? ' selected' : ''}>${x}</option>`).join('')}</select></td>
      ${isAdmin() ? `<td><select class="cdlasg" data-id="${l.id}"><option value="">Unassigned</option>${couns.map(u => `<option value="${u.id}"${l.assignedTo === u.id ? ' selected' : ''}>${esc(u.full_name)}</option>`).join('')}</select></td>` : ''}
      <td><input class="cdlnote" data-id="${l.id}" value="${esc(l.note)}" style="width:150px"></td>
      <td>${isAdmin() ? `<button class="btn danger cdldel" data-id="${l.id}" style="margin:0;padding:.25rem .6rem">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">No leads yet.</td></tr>'}</tbody></table></div></div>`;
    const reload = () => { f.q = $('#cdlq').value; f.source = $('#cdlsrc').value; f.status = $('#cdlst').value; f.schoolId = $('#cdlsc').value; vLeads(); };
    $('#cdlgo').onclick = reload; $('#cdlq').onkeydown = e => { if (e.key === 'Enter') reload(); }; ['#cdlsrc', '#cdlst', '#cdlsc'].forEach(s => $(s).onchange = reload);
    $$('.cdview').forEach(b => b.onclick = () => window.open('/career.html?review=' + b.dataset.ref, '_blank'));
    $('#cdlcsv').onclick = () => dl('/leads.csv?' + q, 'career-leads.csv');
    $('#cdladd').onclick = () => { const b = $('#cdaddbox'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; };
    $('#cdasave').onclick = async () => { try { await A('/leads', J({ contactName: $('#cdan').value, mobile: $('#cdam').value, email: $('#cdae').value, studentName: $('#cdas').value, classLabel: $('#cdac').value, note: $('#cdano').value })); vLeads(); } catch (e) { $('#cdaerr').textContent = e.message; } };
    const patch = (id, body) => A('/leads/' + id, { method: 'PATCH', body: JSON.stringify(body) }).catch(e => alert(e.message));
    $$('.cdlstat').forEach(s => s.onchange = () => patch(s.dataset.id, { status: s.value })); $$('.cdlasg').forEach(s => s.onchange = () => patch(s.dataset.id, { assignedTo: s.value || null })); $$('.cdlnote').forEach(s => s.onchange = () => patch(s.dataset.id, { note: s.value }));
    $$('.cdldel').forEach(b => b.onclick = async () => { if (!confirm('Delete this lead?')) return; await A('/leads/' + b.dataset.id, { method: 'DELETE' }); vLeads(); });
  }
})();
