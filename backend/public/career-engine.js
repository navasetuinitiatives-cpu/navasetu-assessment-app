/* NavaSetu Career Discovery - shared content + scoring engine (UMD: browser global `Engine`, Node require).
   Used by BOTH the student app and the server, so scores computed in the browser and on the server are identical. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Engine = factory(); })(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const pct = (v, max) => Math.round((v / max) * 100);
/* ====================== CONTENT ====================== */
const THEMES = {
  R: { name: 'Doer', full: 'Hands-on', d: 'You like real, practical work: tools, machines, the outdoors, fixing and building.', school: 'You are happiest in labs, workshops, sports fields and any task where you can see what you made.', careers: 'engineering, skilled technical work, agriculture, sports, defence services' },
  I: { name: 'Thinker', full: 'Investigative', d: 'You are curious about how and why things work, and you enjoy solving problems that take thought.', school: 'You ask "why?", enjoy science and maths puzzles, and like working things out yourself.', careers: 'research, medicine, computing and data, science, analysis' },
  A: { name: 'Creator', full: 'Artistic', d: 'You like original ideas, self-expression and making things that are beautiful or new.', school: 'You are drawn to art, writing, music, drama, design and anything open-ended.', careers: 'design, media, film, writing, architecture, fashion' },
  S: { name: 'Helper', full: 'Social', d: 'You care about people and feel good when you help, teach or support someone.', school: 'Friends come to you with problems, and you enjoy explaining things and working in groups.', careers: 'teaching, counselling, healthcare, social work, human resources' },
  E: { name: 'Leader', full: 'Enterprising', d: 'You like taking charge, persuading people and turning ideas into action.', school: 'You volunteer to lead, enjoy debates, events and competitions, and like having a goal to chase.', careers: 'business, law, management, marketing, public service' },
  C: { name: 'Organiser', full: 'Conventional', d: 'You like order, clear steps and getting details exactly right.', school: 'You keep neat notes, like a plan, and are careful and dependable with numbers and records.', careers: 'finance, accounting, administration, data work, operations' }
};
const INTEREST = [
  ['R1', 'R', 'Fixing a broken gadget, bicycle or toy until it works again'],
  ['I1', 'I', 'Finding out why something works by trying experiments'],
  ['A1', 'A', 'Drawing, painting or designing things so they look great'],
  ['S1', 'S', 'Helping a classmate understand a lesson they find difficult'],
  ['E1', 'E', 'Leading a team for a school event, club or competition'],
  ['C1', 'C', 'Keeping your notes, files and study schedule neat and organised'],
  ['R2', 'R', 'Building or assembling something with tools, wood or electronics'],
  ['I2', 'I', 'Cracking a tricky puzzle or maths problem that takes a long time'],
  ['A2', 'A', 'Writing stories or scripts, or making videos and music'],
  ['S2', 'S', 'Listening to a friend who is upset and helping them feel better'],
  ['E2', 'E', 'Convincing people to try your idea, or selling something at a fair'],
  ['C2', 'C', 'Working with numbers and tables, checking that everything adds up'],
  ['R3', 'R', 'Spending a day outdoors: trekking, gardening or working with animals'],
  ['I3', 'I', 'Watching or reading about space, nature or science and asking "how does this happen?"'],
  ['A3', 'A', 'Coming up with unusual new ideas for a project or school function'],
  ['S3', 'S', 'Volunteering for a cause, such as a clean-up drive or teaching younger children'],
  ['E3', 'E', 'Starting a small project or business and managing it'],
  ['C3', 'C', 'Following clear steps and rules to finish a task accurately']
];
const MOTIV = [
  ['creativity', 'Creating or inventing something new'],
  ['helping', "Making a real difference to people's lives"],
  ['independence', 'Deciding how and when I do my work'],
  ['stability', 'A steady income and a predictable routine'],
  ['challenge', 'Fast-moving work with new challenges and a bit of adventure']
];
const MOTIV_TXT = {
  creativity: ['Creativity', 'You want room to create and invent. Look for fields where ideas matter more than routine.'],
  helping: ['Helping others', 'You want your work to matter to people. Fields in care, education and public service tend to suit this.'],
  independence: ['Independence', 'You want freedom in how you work. Careers with self-direction, such as research, consulting or running your own venture, may suit you.'],
  stability: ['Stability', 'You value security and routine. Structured careers with clear growth paths may feel comfortable.'],
  challenge: ['Challenge and excitement', 'You enjoy pace and new problems. Careers with variety, travel or high responsibility may keep you engaged.']
};
const LEARN = [
  ['L1', 'When you learn something new in class, what helps you most?', [['V', 'Diagrams, charts and mind maps'], ['A', 'Listening to the teacher and discussing it'], ['R', 'Reading the textbook and making written notes'], ['K', 'Trying an experiment or example myself']]],
  ['L2', 'Before an exam, you prefer to…', [['V', 'Colour-code notes and draw flowcharts'], ['A', 'Explain it aloud to someone'], ['R', 'Rewrite notes and make summaries'], ['K', 'Solve practice problems or build a model']]],
  ['L3', 'To reach a new place, you would…', [['V', 'Look at a map'], ['A', 'Ask someone for directions'], ['R', 'Read written directions'], ['K', 'Start walking and figure it out on the way']]],
  ['L4', 'When you get a new gadget, you…', [['V', 'Follow the pictures in the guide'], ['A', 'Ask someone to show you'], ['R', 'Read the instruction manual'], ['K', 'Start pressing buttons and exploring']]]
];
const LEARN_TXT = {
  V: ['Visual', 'You learn best when you can see the idea.', ['Turn chapters into mind maps and flowcharts', 'Use colours and diagrams in notes', 'Watch animations or videos for hard topics']],
  A: ['Listening and talking', 'You learn best when you hear and discuss ideas.', ['Explain each topic aloud as if teaching', 'Study with a partner or in a small group', 'Use audio lessons and record your own summaries']],
  R: ['Reading and writing', 'You learn best through words on the page.', ['Rewrite notes in your own words', 'Make lists, definitions and short summaries', 'Read an extra book or article on each topic']],
  K: ['Hands-on', 'You learn best by doing and testing.', ['Solve many practice problems', 'Build models or run small experiments', 'Take short active breaks while studying']]
};
const STRENGTH = [
  ['num', 'Numerical', 'Working with numbers, percentages and calculations'],
  ['log', 'Logical', 'Spotting patterns and reasoning step by step'],
  ['ver', 'Verbal', 'Explaining ideas clearly in speech and writing'],
  ['spa', 'Spatial', 'Picturing shapes, maps and how parts fit together'],
  ['peo', 'People skills', 'Understanding people and working in a team'],
  ['org', 'Planning', 'Planning your time and finishing what you start']
];
const OPT = {
  int: [['Love it', 3], ['Like it', 2], ['Not really', 1], ['No way', 0]],
  imp: [['Very important', 3], ['Important', 2], ['A little', 1], ['Not important', 0]],
  comf: [['Very comfortable', 3], ['Comfortable', 2], ['Still building', 1], ['Find it hard', 0]],
  cur: [['Very curious', 3], ['Curious', 2], ['Not sure', 1], ['Not for me', 0]]
};

// Career areas. themes = weights over interest themes; str = strengths that help; need = subject requirement (Class 11-12 only).
const AREAS = [
  { id: 'eng', name: 'Engineering & Technology', themes: { I: .5, R: .5 }, str: ['log', 'num', 'spa'], need: 'PCM', grp: 'PCM',
    fq: 'Engineering: designing machines, structures, circuits or vehicles', careers: 'Mechanical, civil, electrical or electronics engineer; robotics; aerospace',
    subj: 'Usually needs Physics, Chemistry and Maths in Class 12, with engineering entrance exams.', try: 'Build a small circuit or model, or join a robotics or tinkering club.' },
  { id: 'comp', name: 'Computing, AI & Data', themes: { I: .6, C: .4 }, str: ['log', 'num'], need: 'M', grp: 'PCM',
    fq: 'Computing: coding, apps, AI, data or cybersecurity', careers: 'Software developer, data scientist, AI/ML engineer, cybersecurity analyst',
    subj: 'Maths in Class 12 keeps the widest set of routes open (engineering, BSc, BCA and others).', try: 'Take a free beginner coding course and build one tiny project.' },
  { id: 'arch', name: 'Architecture & Built Environment', themes: { A: .5, R: .5 }, str: ['spa', 'num'], need: 'M', grp: 'PCM',
    fq: 'Architecture: designing buildings, spaces and cities', careers: 'Architect, urban planner, interior or landscape designer, construction manager',
    subj: 'Architecture degrees usually need Maths in Class 12 and a design aptitude test.', try: 'Sketch your classroom or street from memory, then measure and compare.' },
  { id: 'health', name: 'Health & Medicine', themes: { S: .5, I: .5 }, str: ['peo', 'log'], need: 'PCB', grp: 'PCB',
    fq: 'Health and medicine: doctors, therapists, pharmacists, nutrition experts', careers: 'Doctor, dentist, physiotherapist, pharmacist, nutritionist, public-health specialist',
    subj: 'Medicine and most allied-health degrees usually need Biology in Class 12 (NEET for MBBS and BDS).', try: 'Ask a doctor or pharmacist you know about a typical day, and read about one health career.' },
  { id: 'life', name: 'Life Sciences & Research', themes: { I: .7, R: .3 }, str: ['log', 'ver'], need: 'PCMorB', grp: 'PCB',
    fq: 'Science research: labs, biotechnology, forensics, environment', careers: 'Biotechnologist, microbiologist, forensic scientist, environmental scientist, researcher',
    subj: 'Open to Science students with Maths or Biology; research paths run through BSc and integrated MSc programmes.', try: 'Pick one science question and design a small home experiment to test it.' },
  { id: 'agri', name: 'Agriculture & Environment', themes: { R: .6, I: .4 }, str: ['log', 'org'], need: 'PCMorB', grp: 'PCB',
    fq: 'Agriculture and food: farming technology, forestry, food science', careers: 'Agricultural scientist, food technologist, forestry officer, environment consultant, agritech entrepreneur',
    subj: 'Agriculture degrees usually take PCM or PCB (ICAR and state tests).', try: 'Visit a farm, nursery or food unit, or start a small kitchen-garden project.' },
  { id: 'design', name: 'Design & Creative Arts', themes: { A: .8, R: .2 }, str: ['spa', 'ver'], need: 'ANY', grp: 'ANY',
    fq: 'Design and arts: graphics, animation, fashion, product or film design', careers: 'UX or product designer, animator, graphic or fashion designer, filmmaker, artist',
    subj: 'Open from any stream. Design colleges mostly admit through their own aptitude tests, so drawing skills and a portfolio matter.', try: 'Start a sketchbook, or design the poster for a school event.' },
  { id: 'media', name: 'Media & Communication', themes: { A: .5, E: .3, S: .2 }, str: ['ver', 'peo'], need: 'ANY', grp: 'ARTS',
    fq: 'Media: journalism, content creation, advertising, film', careers: 'Journalist, content creator, PR professional, film and TV, advertising, podcaster',
    subj: 'Open from any stream; mass-communication courses start after Class 12.', try: 'Start a school newsletter or record a short podcast on something you care about.' },
  { id: 'biz', name: 'Business & Management', themes: { E: .6, C: .2, S: .2 }, str: ['peo', 'org'], need: 'ANY', grp: 'COM',
    fq: 'Business: starting or managing companies, marketing, consulting', careers: 'Entrepreneur, marketing manager, consultant, HR professional, operations manager',
    subj: 'Open from any stream; routes include BBA, BMS and integrated management programmes, and later an MBA.', try: 'Run a small stall or fundraiser and track your costs and profit.' },
  { id: 'fin', name: 'Finance & Accounting', themes: { C: .6, E: .2, I: .2 }, str: ['num', 'org'], need: 'ANY', grp: 'COM',
    fq: 'Finance: accounting, banking, investing, economics', careers: 'Chartered accountant, investment analyst, banker, actuary, company secretary',
    subj: 'Open from any stream (Commerce with Maths is the common route); CA, CS and CMA have their own entry routes.', try: 'Track a month of your own spending and make a simple budget.' },
  { id: 'law', name: 'Law & Public Policy', themes: { E: .4, I: .3, S: .3 }, str: ['ver', 'log'], need: 'ANY', grp: 'ARTS',
    fq: 'Law and policy: courts, legal advice, public policy', careers: 'Lawyer, judge, legal adviser, policy analyst',
    subj: 'Open from any stream; five-year integrated law programmes admit through CLAT and similar tests.', try: 'Join a debate or mock-court event and follow one court judgment closely.' },
  { id: 'civil', name: 'Civil Services & Government', themes: { E: .4, C: .3, S: .3 }, str: ['ver', 'org'], need: 'ANY', grp: 'ARTS',
    fq: 'Civil services and government jobs', careers: 'IAS, IPS or IFS officer, state services, public-sector roles, banking and railway services',
    subj: 'Open from any stream; most services need a graduate degree in any subject plus steady preparation.', try: 'Read one national newspaper editorial a day for two weeks and note what you learn.' },
  { id: 'teach', name: 'Teaching & Education', themes: { S: .6, C: .2, I: .2 }, str: ['ver', 'peo'], need: 'ANY', grp: 'ARTS',
    fq: 'Teaching, training and educational research', careers: 'School teacher, professor, curriculum designer, ed-tech professional, academic researcher',
    subj: 'Open from any stream; school teaching needs a degree plus a teacher-education qualification.', try: 'Teach a younger student one topic and ask them for honest feedback.' },
  { id: 'counsel', name: 'Counselling & Social Services', themes: { S: .8, I: .2 }, str: ['peo', 'ver'], need: 'ANY', grp: 'ARTS',
    fq: 'Counselling, psychology and social work', careers: 'Psychologist, counsellor, social worker, NGO leader, wellbeing professional',
    subj: 'Open from any stream; psychology starts at graduation and practising roles usually need further study.', try: 'Practise listening: hear a friend out for five minutes without giving advice.' },
  { id: 'defence', name: 'Defence & Public Safety', themes: { R: .4, E: .3, S: .3 }, str: ['peo', 'org'], need: 'ANY', grp: 'ANY',
    fq: 'The defence forces, police and public safety', careers: 'Armed forces officer, police and paramilitary services, disaster management, security services',
    subj: 'Entries open after Class 12. The Air Force and Navy wings of NDA need Physics and Maths; the Army wing accepts any stream.', try: 'Talk to a serving or retired officer, and build a regular fitness routine.' },
  { id: 'sports', name: 'Sports & Fitness', themes: { R: .6, S: .4 }, str: ['org', 'peo'], need: 'ANY', grp: 'ANY',
    fq: 'Sports, fitness and coaching', careers: 'Athlete, coach, sports scientist, sports manager, fitness trainer',
    subj: 'Open from any stream; sports science, physical education and sports management degrees exist alongside competitive sport.', try: 'Set a four-week fitness or skill goal and log your progress.' },
  { id: 'hosp', name: 'Hospitality & Tourism', themes: { S: .4, E: .4, A: .2 }, str: ['peo', 'org'], need: 'ANY', grp: 'ANY',
    fq: 'Hospitality, travel and events', careers: 'Hotel manager, chef, event manager, travel entrepreneur, airline and cruise services',
    subj: 'Open from any stream; hotel-management degrees admit through entrance tests.', try: 'Plan a family trip or a school event end to end, with a budget.' }
];
const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const FIELDS = {
  '810': ['eng', 'health', 'comp', 'biz', 'law', 'design', 'defence', 'teach'],
  PCM: ['eng', 'comp', 'arch', 'defence', 'biz', 'fin', 'design', 'civil'],
  PCB: ['health', 'life', 'agri', 'counsel', 'teach', 'sports', 'defence', 'media'],
  PCMB: ['eng', 'comp', 'health', 'life', 'agri', 'arch', 'defence', 'design'],
  COMM: ['fin', 'biz', 'comp', 'law', 'civil', 'media', 'hosp', 'design'],
  COM: ['fin', 'biz', 'law', 'civil', 'media', 'hosp', 'design', 'teach'],
  ARTS: ['law', 'civil', 'media', 'design', 'counsel', 'teach', 'hosp', 'defence']
};
const STREAMS = [
  ['PCM', 'Science with Maths', 'Physics, Chemistry, Maths (PCM)'], ['PCB', 'Science with Biology', 'Physics, Chemistry, Biology (PCB)'],
  ['PCMB', 'Science with Maths and Biology', 'Physics, Chemistry, Maths, Biology (PCMB)'], ['COMM', 'Commerce with Maths', 'Accountancy, Business Studies, Economics, Maths'],
  ['COM', 'Commerce without Maths', 'Accountancy, Business Studies, Economics'], ['ARTS', 'Humanities / Arts', 'History, Political Science, Geography, Psychology and similar']
];
const STREAM_NAME = Object.fromEntries(STREAMS.map(s => [s[0], s[1]]));
const STREAM810 = { PCM: 'Science with Maths (PCM)', PCB: 'Science with Biology (PCB)', COM: 'Commerce', ARTS: 'Humanities / Arts' };
const CLASSES = ['VIII', 'IX', 'X', 'XI', 'XII'];


function openFor(stream, need) {
  switch (need) {
    case 'ANY': return true;
    case 'PCM': return stream === 'PCM' || stream === 'PCMB';
    case 'PCB': return stream === 'PCB' || stream === 'PCMB';
    case 'PCMorB': return ['PCM', 'PCB', 'PCMB'].includes(stream);
    case 'M': return ['PCM', 'PCMB', 'COMM'].includes(stream);
  }
  return true;
}


/* ====================== SCORING ====================== */
function compute(A, b, stream) {
  const theme = {};
  for (const t of Object.keys(THEMES)) theme[t] = pct(INTEREST.filter(i => i[1] === t).reduce((n, i) => n + (A['i_' + i[0]] || 0), 0), 9);
  const mot = Object.fromEntries(MOTIV.map(([id]) => [id, pct(A['m_' + id] || 0, 3)]));
  const lc = { V: 0, A: 0, R: 0, K: 0 }; LEARN.forEach(([id]) => { if (A['l_' + id]) lc[A['l_' + id]]++; });
  const lmax = Math.max(...Object.values(lc)), lead = Object.keys(lc).filter(k => lc[k] === lmax);
  const str = Object.fromEntries(STRENGTH.map(([id]) => [id, pct(A['s_' + id] || 0, 3)]));
  const asked = new Set(FIELDS[b === '810' ? '810' : stream]);
  const rows = AREAS.map(a => {
    const tw = Object.entries(a.themes), tsum = tw.reduce((n, [, w]) => n + w, 0);
    const themeFit = tw.reduce((n, [t, w]) => n + w * theme[t], 0) / tsum;
    const strFit = a.str.reduce((n, k) => n + str[k], 0) / a.str.length;
    // areas the student was not asked about count a little less than ones they confirmed, so unconfirmed areas do not tie with confirmed ones
    const field = asked.has(a.id) ? pct(A['f_' + a.id] || 0, 3) : themeFit * 0.85;
    const score = Math.round(.55 * themeFit + .25 * field + .20 * strFit);
    const reasons = [];
    const ts = tw.filter(([t, w]) => w >= .3 && theme[t] >= 55).map(([t]) => THEMES[t].name);
    if (ts.length) reasons.push('your strong ' + ts.join(' and ') + ' side');
    if (asked.has(a.id) && (A['f_' + a.id] || 0) >= 2) reasons.push("you said you are curious about this field");
    const ss = a.str.filter(k => str[k] >= 67).map(k => STRENGTH.find(s => s[0] === k)[1].toLowerCase());
    if (ss.length) reasons.push('you feel comfortable with ' + ss.join(' and ') + ' skills');
    return { a, score, reasons, open: b === '810' ? true : openFor(stream, a.need) };
  }).sort((x, y) => y.score - x.score);
  const themeRank = Object.entries(theme).sort((x, y) => y[1] - x[1]);
  let streams = null;
  if (b === '810') {
    streams = Object.keys(STREAM810).map(g => {
      const list = rows.filter(r => r.a.grp === g).map(r => r.score).sort((x, y) => y - x).slice(0, 2);
      return [g, Math.round(list.reduce((n, v) => n + v, 0) / list.length)];
    }).sort((x, y) => y[1] - x[1]);
  }
  return { theme, themeRank, mot, lc, lead, str, rows, streams, flat: themeRank[0][1] < 35 };
}


/* ---------- extras for the backend ---------- */
const bandOf = cls => (['XI', 'XII'].includes(cls) ? '1112' : '810');

// Question ids a student must answer for this class/stream (the server validates submissions against this).
function expectedIds(b, stream) {
  const ids = INTEREST.map(i => 'i_' + i[0]).concat(MOTIV.map(m => 'm_' + m[0]), LEARN.map(l => 'l_' + l[0]), STRENGTH.map(s => 's_' + s[0]));
  return ids.concat(FIELDS[b === '810' ? '810' : stream].map(id => 'f_' + id));
}
function validAnswers(answers, b, stream) {
  if (!answers || typeof answers !== 'object') return false;
  return expectedIds(b, stream).every(id => {
    const v = answers[id];
    return id.startsWith('l_') ? ['V', 'A', 'R', 'K'].includes(v) : Number.isInteger(v) && v >= 0 && v <= 3;
  });
}
// Data-quality flags for the reviewer: not a judgement on the child, just "look at this one before releasing".
function qualityFlags(answers, b, stream, durationSec, R) {
  const flags = [];
  const rated = expectedIds(b, stream).filter(id => !id.startsWith('l_')).map(id => answers[id]);
  const same = Math.max(...[0, 1, 2, 3].map(v => rated.filter(x => x === v).length));
  if (same / rated.length >= 0.95) flags.push('same-answer');
  if (Number.isFinite(durationSec) && durationSec < 150) flags.push('too-fast');
  if (R.flat) flags.push('flat-profile');
  return flags;
}
// What is stored per student: small, and enough to build every report without re-running anything.
function summarize(answers, cls, stream, durationSec) {
  const b = bandOf(cls), R = compute(answers, b, stream);
  const open = R.rows.filter(r => r.open);
  return {
    band: b,
    scores: { theme: R.theme, mot: R.mot, str: R.str, lc: R.lc, lead: R.lead, leaning: R.streams ? R.streams[0][0] : null },
    topAreas: open.slice(0, 3).map(r => ({ id: r.a.id, name: r.a.name, score: r.score })),
    flags: qualityFlags(answers, b, stream, durationSec, R)
  };
}

return { THEMES, INTEREST, MOTIV, MOTIV_TXT, LEARN, LEARN_TXT, STRENGTH, OPT, AREAS, AREA, FIELDS, STREAMS, STREAM_NAME, STREAM810, CLASSES,
  pct, openFor, compute, bandOf, expectedIds, validAnswers, qualityFlags, summarize };
});
