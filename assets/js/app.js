// =========================================================
// DGP Academy — aplicación (pantallas, acceso, panel, libros, admin)
// Los datos viven en Supabase: ver assets/js/data.js
// =========================================================

// ── Contacto para activar accesos ───────────────────────────────────────────
// Número de WhatsApp en formato internacional sin "+" ni espacios (ej. '5215512345678').
// Si se deja vacío, el panel de activación solo muestra el botón de correo.
const CONTACT = {
  email: 'info@dgpglobalgroup.com',
  whatsapp: ''
};

// ── Pantallas ────────────────────────────────────────────────────────────────
const SCREENS = ['landing-screen','auth-screen','dash-screen','course-screen','admin-screen','book-screen','book-screen-2'];
function showScreen(id, display) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === id) ? (display || 'block') : 'none';
  });
  window.scrollTo(0, 0);
}
function hideSplash() {
  const splash = document.getElementById('splash-screen');
  if (splash) { splash.classList.remove('active'); setTimeout(() => { splash.style.display = 'none'; }, 400); }
}
function showLanding() { showScreen('landing-screen'); hideSplash(); fillLandingWelcome(); const ls = document.getElementById('landing-screen'); if (ls) ls.scrollTo({ top: 0, behavior: 'instant' }); }
// Con sesión iniciada, el inicio sigue visible como portada del campus
function fillLandingWelcome() {
  const box = document.getElementById('lp-welcome');
  if (!box) return;
  box.hidden = !STATE.user;
  if (!STATE.user) return;
  const name = ((STATE.profile && STATE.profile.full_name) || '').trim().split(/\s+/)[0];
  document.getElementById('lp-welcome-name').textContent = name ? t('Hola') + ', ' + name : t('Hola');
}
// Tarjetas de programas: con sesión llevan al campus; sin sesión, a crear la cuenta
function openProgram(kind) {
  if (!STATE.user) { goToRegister(); return; }
  showDashboard();
  const el = document.getElementById(kind === 'books' ? 'dash-library' : 'dash-programs');
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}
function withSplash(fn) {
  const splash = document.getElementById('splash-screen');
  if (!splash) return fn();
  splash.style.display = 'flex';
  requestAnimationFrame(() => splash.classList.add('active'));
  setTimeout(fn, 650);
}
function goToAuth()     { if (STATE.user) { showDashboard(); return; } withSplash(() => { showAuth(); switchTab('login'); }); }
function goToRegister() { if (STATE.user) { showDashboard(); return; } withSplash(() => { showAuth(); switchTab('register'); }); }
function showAuth()      { showScreen('auth-screen', 'flex'); hideSplash(); }
function showDashboard() { if (!STATE.user) { showLanding(); return; } showScreen('dash-screen'); updateDashStats(); hideSplash(); if (typeof renderBadges === 'function') renderBadges(); if (typeof syncTryFree === 'function') syncTryFree(); }
function showCourse()    { showScreen('course-screen'); }
async function showAdmin() {
  await loadMyPerms();
  if (!firstAllowedTab()) { toast(t('Todavía no tienes secciones del panel asignadas.')); return; }
  showScreen('admin-screen'); adminTab(ADMIN_TAB);
}

// ── Lector de libros ─────────────────────────────────────────────────────────
// Abre un producto protegido: descarga su contenido y luego muestra la pantalla
async function openProtected(product, rootSelector, onReady) {
  // Sin acceso se abre en vista previa: lección gratis completa y el resto con aviso para desbloquear
  const splash = document.getElementById('splash-screen');
  if (splash) { splash.style.display = 'flex'; splash.classList.add('active'); }
  try {
    const ok = await loadContent(product, rootSelector);
    if (!ok) throw new Error('El contenido no está disponible.');
    onReady();
  } catch (e) {
    toast('No se pudo cargar el contenido: ' + (e.message || e));
  } finally {
    hideSplash();
  }
}

function showBook() {
  openProtected('7st', '#book-screen', () => {
    showScreen('book-screen');
    goToChapter((STATE.reading['7st'] && STATE.reading['7st'].last_item) || 'ch-intro');
  });
}

function closeBook() {
  document.getElementById('book-screen').style.display = 'none';
  showDashboard();
}

let currentChapter = 'ch-intro';
const BOOK_CHAPTERS = ['ch-intro','ch-1','ch-2','ch-3','ch-4','ch-5','ch-6','ch-7','ch-8','ch-9','ch-10','ch-conclusion'];

function readSet(product) { return STATE.progress[product] || new Set(); }

function markChapterRead(id) {
  if (!BOOK_CHAPTERS.includes(id) || readSet('7st').has(id)) return;
  saveProgress('7st', id);
  const tocEl = document.querySelector('#book-screen [data-ch="' + id + '"]');
  if (tocEl) tocEl.classList.add('read');
  updateBookReadProgress();
}

function updateBookReadProgress() {
  const total = BOOK_CHAPTERS.length;
  const done = BOOK_CHAPTERS.filter(c => readSet('7st').has(c)).length;
  const fill = document.getElementById('book-read-bar-fill');
  const lbl  = document.getElementById('book-read-label');
  if (fill) fill.style.width = Math.round(done / total * 100) + '%';
  if (lbl)  lbl.textContent = done + ' / ' + total + ' capítulos leídos';
  BOOK_CHAPTERS.forEach(id => {
    const tocEl = document.querySelector('#book-screen [data-ch="' + id + '"]');
    if (tocEl) tocEl.classList.toggle('read', readSet('7st').has(id));
  });
}

function goToChapter(id) {
  document.querySelectorAll('#book-screen .book-chapter').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#book-screen .book-toc-item').forEach(el => el.classList.remove('active'));
  const ch = document.getElementById(id);
  if (ch) { ch.classList.add('active'); document.getElementById('book-content').scrollTop = 0; }
  const tocItem = document.querySelector('#book-screen [data-ch="' + id + '"]');
  if (tocItem) {
    tocItem.classList.add('active');
    const labels = {
      'ch-intro': 'Introducción',
      'ch-1': 'Cap. 1 · El Entorno Digital',
      'ch-2': 'Cap. 2 · Sitio Web',
      'ch-3': 'Cap. 3 · Identidad de Marca',
      'ch-4': 'Cap. 4 · Contenido',
      'ch-5': 'Cap. 5 · Comunidad',
      'ch-6': 'Cap. 6 · Análisis',
      'ch-7': 'Cap. 7 · Legal y Ética',
      'ch-8': 'Cap. 8 · Casos de Éxito',
      'ch-9': 'Cap. 9 · Mentalidad y Finanzas',
      'ch-10': 'Cap. 10 · Recursos',
      'ch-conclusion': 'Conclusión',
      'ch-quiz': 'Evaluación final'
    };
    const lbl = document.getElementById('book-chapter-label');
    if (lbl) lbl.textContent = labels[id] || id;
  }
  currentChapter = id;
  markChapterRead(id);
  savePosition('7st', id);
  if (id === 'ch-quiz') restoreQuizState();
  document.getElementById('book-nav').classList.remove('open');
  const bd = document.getElementById('book-backdrop');
  if (bd) bd.style.display = 'none';
}

function toggleBookNav() {
  const nav = document.getElementById('book-nav');
  nav.classList.toggle('open');
  const bd = document.getElementById('book-backdrop');
  if (bd) bd.style.display = nav.classList.contains('open') ? 'block' : 'none';
}

// ── Sticky nav shadow on scroll (landing-screen scrolls, not window) ─────────
(function() {
  function bindLandingScroll() {
    const ls = document.getElementById('landing-screen');
    const nav = document.querySelector('.lp-nav');
    if (!ls || !nav) return;
    ls.addEventListener('scroll', function() {
      nav.classList.toggle('scrolled', ls.scrollTop > 10);
    });
  }
  bindLandingScroll();
})();

function lpScrollTo(id) {
  const el  = document.getElementById(id);
  const ls  = document.getElementById('landing-screen');
  if (!el || !ls) return;
  const offset = el.getBoundingClientRect().top - ls.getBoundingClientRect().top + ls.scrollTop - 75;
  ls.scrollTo({ top: offset, behavior: 'smooth' });
}

// ── Sesión ───────────────────────────────────────────────────────────────────
let sessionUserId = null;

async function onSignedIn(user) {
  if (sessionUserId === user.id && STATE.profile) return;
  // Sesión guardada pero sin actividad en más de 10 minutos: se cierra
  let last = 0;
  try { last = Number(localStorage.getItem('dgp-last-activity')) || 0; } catch (e) {}
  if (!sessionUserId && last && Date.now() - last >= 10 * 60 * 1000) {
    try { localStorage.removeItem('dgp-last-activity'); } catch (e) {}
    await sb.auth.signOut();
    showIdleClosed();
    return;
  }
  try { localStorage.setItem('dgp-last-activity', String(Date.now())); } catch (e) {}
  sessionUserId = user.id;
  STATE.user = user;
  document.body.classList.add('is-auth');
  dismissIdleClosed();
  try {
    await loadUserData();
  } catch (e) {
    console.warn(e);
    toast('No se pudieron cargar tus datos. Recarga la página.');
  }
  await syncCertificates();
  applyUserData();
  showDashboard();
}

function applyUserData() {
  fillUserUI();
  const adminBtn = document.getElementById('btn-admin-panel');
  if (adminBtn) adminBtn.style.display = STATE.profile && STATE.profile.is_admin ? 'flex' : 'none';
  completed = [...readSet('web-dev')].filter(i => lessons.includes(i));
  updateCourseAccess();
  updateBookAccess();
  updateBookAccess2();
  if (typeof updateAIAccess === 'function') updateAIAccess();
  updateBookReadProgress();
  updateBook2ReadProgress();
  updateProgress();
  updateDashStats();
  paymentsOnUser();
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { setTimeout(showRecovery, 50); }
  if (session && session.user) {
    setTimeout(() => onSignedIn(session.user), 0);
  } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
    sessionUserId = null;
    document.body.classList.remove('is-auth');
    resetState();
    clearContent();
    completed = [];
    showLanding();
  }
});

loadCuposPublic().then(v => updateLpCupos(v.disponibles, v.total)).catch(() => {});

// ── Acceso a programas y libros ───────────────────────────────────────────────
const ICON = {
  play: '<svg><use href="#i-play"/></svg>',
  lock: '<svg><use href="#i-lock"/></svg>',
  book: '<svg><use href="#i-book"/></svg>',
  award: '<svg><use href="#i-award"/></svg>',
  check: '<svg><use href="#i-check"/></svg>'
};
let hasWebAccess = false;

function updateCourseAccess() {
  const btn = document.getElementById('btn-web-dev');
  if (!btn) return;
  hasWebAccess = hasAccess('web-dev');
  const status = document.getElementById('web-dev-status');
  if (hasWebAccess) {
    btn.className = 'ui-btn ui-btn--block btn-course is-active';
    btn.disabled = false;
    btn.onclick = function() { continueCourse(); };
    if (status) { status.textContent = 'Activo'; status.className = 'chip chip--light course-status is-active'; }
  } else {
    btn.innerHTML = ICON.lock + escapeHtml(t('Desbloquear programa')) + priceTag('web-dev');
    btn.className = 'ui-btn ui-btn--block btn-course is-buy';
    btn.disabled = false;
    btn.onclick = () => openCheckout('web-dev');
    if (status) { status.textContent = t('Disponible'); status.className = 'chip chip--light course-status'; }
  }
  renderActivation();
}

// Panel "Activa tu acceso" para cuentas sin ningún producto habilitado
function renderActivation() {
  const box = document.getElementById('dash-activate');
  if (!box) return;
  const passBtn = document.getElementById('dash-activate-pay');
  if (passBtn) passBtn.innerHTML = '<svg><use href="#i-lock"/></svg>' + escapeHtml(t('Pase completo')) + priceTag('pase');
  const anyAccess = ['web-dev', 'ia', '7st', 'semilla'].some(hasAccess);
  box.style.display = (STATE.user && !anyAccess) ? 'grid' : 'none';
  const email = STATE.user ? STATE.user.email : '';
  const who = displayName();
  const msg = (LANG === 'en'
      ? 'Hi, I would like to activate my access to DGP Academy (Web Design & Development with AI). My account: '
      : 'Hola, quiero activar mi acceso a DGP Academy (Diseño y Desarrollo Web con IA). Mi cuenta: ') + email + (who && who !== email ? ' — ' + who : '');
  const mail = document.getElementById('dash-activate-mail');
  if (mail) mail.href = 'mailto:' + CONTACT.email + '?subject=' + encodeURIComponent(t('Activar acceso — DGP Academy')) + '&body=' + encodeURIComponent(msg);
  const wa = document.getElementById('dash-activate-wa');
  if (wa) {
    wa.style.display = CONTACT.whatsapp ? '' : 'none';
    if (CONTACT.whatsapp) wa.href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(msg);
  }
}

// Precio corto para los botones de compra: " · $40"
function priceTag(product) {
  const pr = (SITE_CFG.products || {})[product];
  return pr && pr.price_usd != null ? ' · ' + fmtMoney(pr.price_usd) : '';
}

function setBookButton(btnId, progressId, product, open, extraCls) {
  const btn = document.getElementById(btnId);
  const progressWrap = document.getElementById(progressId);
  if (!btn) return;
  if (hasAccess(product)) {
    btn.innerHTML = ICON.book + (readSet(product).size ? 'Continuar leyendo' : 'Leer libro');
    btn.className = 'ui-btn ui-btn--block btn-book is-active' + (extraCls ? ' ' + extraCls : '');
    btn.disabled = false;
    btn.onclick = open;
    if (progressWrap) progressWrap.style.display = 'block';
  } else {
    btn.innerHTML = ICON.lock + escapeHtml(t('Desbloquear libro')) + priceTag(product);
    btn.className = 'ui-btn ui-btn--block btn-book is-buy';
    btn.disabled = false;
    btn.onclick = () => openCheckout(product);
    if (progressWrap) progressWrap.style.display = 'none';
  }
}
function updateBookAccess()  { setBookButton('btn-7st', 'book-7st-progress', '7st', showBook); }
function updateBookAccess2() { setBookButton('btn-semilla', 'book2-progress', 'semilla', showBook2, 'is-green'); }

// ── Evaluación final 7ST (se califica en el servidor) ───────────────────────────
const quizSelected = new Array(10).fill(-1);

function selectOpt(btn) {
  const q = parseInt(btn.getAttribute('data-q'));
  const i = parseInt(btn.getAttribute('data-i'));
  document.querySelectorAll('[data-q="' + q + '"].quiz-opt').forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  quizSelected[q] = i;
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) sub.disabled = !quizSelected.every(v => v !== -1);
}

async function submitQuiz() {
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) { sub.disabled = true; sub.textContent = 'Calificando…'; }
  const { data, error } = await sb.rpc('submit_quiz', { p: '7st', answers: quizSelected });
  if (error) {
    toast('No se pudo enviar la evaluación: ' + error.message);
    if (sub) { sub.disabled = false; sub.textContent = 'Ver resultados →'; }
    return;
  }
  const key = data.key || [];
  document.querySelectorAll('#book-screen .quiz-opt').forEach(btn => {
    btn.disabled = true;
    const q = parseInt(btn.getAttribute('data-q'));
    const i = parseInt(btn.getAttribute('data-i'));
    if (i === key[q]) btn.classList.add('reveal-correct');
    else if (btn.classList.contains('selected')) btn.classList.add('wrong');
    btn.classList.remove('selected');
  });
  STATE.reading['7st'] = Object.assign({}, STATE.reading['7st'], {
    quiz_score: Math.max(data.score, (STATE.reading['7st'] && STATE.reading['7st'].quiz_score) || 0),
    quiz_passed: data.passed || !!(STATE.reading['7st'] && STATE.reading['7st'].quiz_passed)
  });
  if (sub) sub.style.display = 'none';
  showQuizResult(data.score, data.total, data.passed);
  if (data.passed) {
    markChapterRead('ch-conclusion');
    try { await issueCertificate('7st'); } catch (e) { /* se emite al abrir el certificado */ }
    renderCertificates();
  }
}

function showQuizResult(score, total, pass) {
  const resultEl = document.getElementById('quiz-result');
  if (!resultEl) return;
  resultEl.style.display = 'block';
  if (pass) {
    resultEl.innerHTML = '<div class="quiz-result-banner pass">' +
      '<div class="quiz-score-big">' + score + '/' + total + '</div>' +
      '<div class="quiz-score-lbl">Has aprobado la evaluación</div>' +
      '<p style="color:rgba(255,255,255,0.8);font-size:15px;margin-top:12px;">¡Felicitaciones! Completaste 7ST Vol. 1. Tu certificado de lectura ya está disponible.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;">' +
      '<button class="ui-btn ui-btn--light" onclick="openCertificate(\'7st\')">' + ICON.award + 'Ver certificado de lectura</button>' +
      '<button class="ui-btn ui-btn--ghost-light" onclick="closeBook()">Volver a mis cursos</button></div>' +
      '</div>';
  } else {
    resultEl.innerHTML = '<div class="quiz-result-banner fail">' +
      '<div class="quiz-score-big">' + score + '/' + total + '</div>' +
      '<div class="quiz-score-lbl">Necesitas 7 o más para aprobar</div>' +
      '<p style="color:rgba(255,255,255,0.7);font-size:15px;margin-top:10px;">¡Casi! Revisa los capítulos donde fallaste y vuelve a intentarlo.</p>' +
      '<button class="ui-btn ui-btn--ghost-light" style="margin-top:16px;" onclick="retryQuiz()">Reintentar evaluación</button>' +
      '</div>';
  }
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Si ya aprobó antes, lo muestra al entrar a la evaluación
function restoreQuizState() {
  const r = STATE.reading['7st'];
  if (r && r.quiz_passed && document.getElementById('quiz-result') && !document.querySelector('#quiz-result .quiz-result-banner')) {
    const sub = document.getElementById('btn-submit-quiz');
    if (sub) sub.style.display = 'none';
    showQuizResult(r.quiz_score || 7, 10, true);
  }
}

function retryQuiz() {
  for (let i = 0; i < 10; i++) quizSelected[i] = -1;
  document.querySelectorAll('#book-screen .quiz-opt').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected','correct','wrong','reveal-correct');
  });
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) { sub.style.display = ''; sub.disabled = true; sub.textContent = 'Ver resultados →'; }
  const resultEl = document.getElementById('quiz-result');
  if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
  document.getElementById('book-content').scrollTop = 0;
}

// ── Libro 2 (De la Semilla al Árbol) ─────────────────────────────────────────
const BOOK2_CHAPTERS = ['s2-nota','s2-1','s2-2','s2-3','s2-4','s2-5','s2-6','s2-7','s2-8','s2-9','s2-10','s2-11','s2-recursos','s2-conclusion'];
let currentChapter2 = 's2-nota';

function showBook2() {
  openProtected('semilla', '#book-screen-2', () => {
    showScreen('book-screen-2');
    goToChapter2((STATE.reading['semilla'] && STATE.reading['semilla'].last_item) || 's2-nota');
  });
}

function closeBook2() {
  const bs = document.getElementById('book-screen-2');
  if (bs) bs.style.display = 'none';
  showDashboard();
}

function toggleBookNav2() {
  const nav = document.getElementById('book-nav-2');
  if (!nav) return;
  nav.classList.toggle('open');
  const bd = document.getElementById('book-backdrop-2');
  if (bd) bd.style.display = nav.classList.contains('open') ? 'block' : 'none';
}

function goToChapter2(id) {
  document.querySelectorAll('#book-screen-2 .book-chapter').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#book-screen-2 .book-toc-item').forEach(el => el.classList.remove('active'));
  const ch = document.getElementById(id);
  if (ch) { ch.classList.add('active'); const bc = document.getElementById('book-content-2'); if (bc) bc.scrollTop = 0; }
  const tocItem = document.querySelector('#book-screen-2 [data-ch="' + id + '"]');
  if (tocItem) {
    tocItem.classList.add('active');
    const labels = {
      's2-nota':'Nota Inicial','s2-1':'Cap. 1 · Por Qué Emprendes','s2-2':'Cap. 2 · Libros que Cambian Vidas',
      's2-3':'Cap. 3 · Mensajes para Ti','s2-4':'Cap. 4 · El Dinero','s2-5':'Cap. 5 · Administrar',
      's2-6':'Cap. 6 · Inversión y Libertad','s2-7':'Cap. 7 · Marca Personal',
      's2-8':'Cap. 8 · Redes Sociales','s2-9':'Cap. 9 · Tu Sitio Web',
      's2-10':'Cap. 10 · Contenido con Alma','s2-11':'Cap. 11 · 90 Días',
      's2-recursos':'Recursos especiales','s2-conclusion':'Conclusión'
    };
    const lbl = document.getElementById('book-chapter-label-2');
    if (lbl) lbl.textContent = labels[id] || id;
  }
  currentChapter2 = id;
  markChapter2Read(id);
  savePosition('semilla', id);
  const nav = document.getElementById('book-nav-2');
  if (nav) nav.classList.remove('open');
  const bd = document.getElementById('book-backdrop-2');
  if (bd) bd.style.display = 'none';
}

function markChapter2Read(id) {
  if (!BOOK2_CHAPTERS.includes(id) || readSet('semilla').has(id)) return;
  saveProgress('semilla', id);
  updateBook2ReadProgress();
}

function updateBook2ReadProgress() {
  const total = BOOK2_CHAPTERS.length;
  const done = BOOK2_CHAPTERS.filter(c => readSet('semilla').has(c)).length;
  const fill = document.getElementById('book2-read-bar-fill');
  const lbl = document.getElementById('book2-read-label');
  if (fill) fill.style.width = Math.round(done / total * 100) + '%';
  if (lbl) lbl.textContent = done + ' / ' + total + ' capítulos leídos';
  BOOK2_CHAPTERS.forEach(id => {
    const tocEl = document.querySelector('#book-screen-2 [data-ch="' + id + '"]');
    if (tocEl) tocEl.classList.toggle('read', readSet('semilla').has(id));
  });
}

// ── Panel admin ──────────────────────────────────────────────────────────────
let allAdminUsers = [];

// Escapa texto que viene de los usuarios antes de insertarlo como HTML
function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function adminMessage(text, isError) {
  document.getElementById('admin-user-list').innerHTML =
    '<div class="admin-empty' + (isError ? ' is-error' : '') + '">' + escapeHtml(text) + '</div>';
}

async function loadAdminData() {
  adminMessage('Cargando usuarios…');
  const { data, error } = await sb.rpc('admin_students');
  if (error) { adminMessage('Error cargando usuarios: ' + error.message, true); return; }
  allAdminUsers = data || [];
  renderAdminStats();
  refreshAdminList();
}

const acc = (u, p) => (u.access && u.access[p]) || { active: false, paid: false };

function renderAdminStats() {
  const now = Date.now();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const students = allAdminUsers.filter(u => !u.is_admin);
  set('admin-stat-total', students.length);
  set('admin-stat-active', students.filter(u => Object.values(u.access || {}).some(a => a.active)).length);
  set('admin-stat-completed', students.filter(u => (u.certificates || []).includes('web-dev') || u.web_progress >= 16).length);
  set('admin-stat-paid', students.filter(u => acc(u, 'web-dev').paid).length);
  set('admin-stat-inactive', students.filter(u => {
    const t = u.last_seen_at || u.created_at;
    return t && (now - new Date(t).getTime()) / 86400000 >= 7;
  }).length);
}

function refreshAdminList() {
  const q = document.getElementById('admin-search');
  filterAdminUsers(q ? q.value : '');
}

function adminToggle(label, opts) {
  return '<button class="admin-toggle ' + (opts.cls || '') + '"' + (opts.disabled ? ' disabled' : '') +
    (opts.action ? ' onclick="' + opts.action + '"' : '') + ' title="' + escapeHtml(opts.title || '') + '">' +
    (opts.on ? ICON.check : '') + escapeHtml(label) + '</button>';
}

function fmtDate(t) {
  return t ? new Date(t).toLocaleDateString(locale(), { day:'2-digit', month:'short', year:'numeric' }) : '—';
}

function renderAdminUsers(users) {
  const list = document.getElementById('admin-user-list');
  if (!users.length) { list.innerHTML = '<div class="admin-empty">' + (allAdminUsers.length ? 'No se encontraron usuarios.' : 'Todavía no hay estudiantes registrados.') + '</div>'; return; }
  list.innerHTML = users.map(u => {
    const uid = String(u.id).replace(/[^A-Za-z0-9-]/g, '');
    const initial = (u.full_name || u.email || '?').trim().charAt(0).toUpperCase();
    const web = acc(u, 'web-dev'), b7 = acc(u, '7st'), bs = acc(u, 'semilla');
    const prog = u.web_progress || 0;
    const done = (u.certificates || []).includes('web-dev') || prog >= 16;
    return '<div class="admin-user-card">' +
      '<div class="admin-user-avatar">' + escapeHtml(initial) + '</div>' +
      '<div class="admin-user-info">' +
        '<div class="admin-user-name">' + escapeHtml(u.full_name || '—') + (u.is_owner ? ' <span class="chip chip--accent">' + escapeHtml(t('Dueño')) + '</span>' : u.is_admin ? ' <span class="chip chip--accent">Admin</span>' : '') + (u.courtesy ? ' <span class="chip chip--gold">Cortesía</span>' : '') + (u.suspended ? ' <span class="chip chip--danger">Suspendida</span>' : '') + (u.member_plan ? ' <span class="chip chip--light">' + escapeHtml(((SITE_CFG.plans || {})[u.member_plan] || {}).name || u.member_plan) + '</span>' : '') + '</div>' +
        '<div class="admin-user-email">' + escapeHtml(u.email || '—') + '</div>' +
        '<div class="admin-user-phone">' + escapeHtml(u.phone || 'Sin teléfono') + ' · Registro: ' + escapeHtml(fmtDate(u.created_at)) + ' · Última visita: ' + escapeHtml(fmtDate(u.last_seen_at)) + '</div>' +
        '<div class="admin-user-prog"><div class="admin-user-prog-label"><span>Web Dev</span><span>' + prog + ' / 16' + (done ? ' · completado' : '') + '</span></div>' +
        '<div class="admin-user-prog-bar"><span class="' + (done ? 'is-done' : '') + '" style="width:' + Math.min(100, Math.round(prog / 16 * 100)) + '%"></span></div></div>' +
      '</div>' +
      '<div class="admin-course-toggles">' +
        adminToggle('Web Dev', { cls: web.active ? 'active' : '', on: web.active, action: "setAccess('" + uid + "','web-dev','active'," + !web.active + ")", title: web.active ? 'Quitar acceso a Desarrollo Web' : 'Dar acceso a Desarrollo Web' }) +
        adminToggle(web.paid ? 'Pagó Web Dev' : 'Pago pendiente', { cls: web.paid ? 'paid' : 'unpaid', on: web.paid, action: "setAccess('" + uid + "','web-dev','paid'," + !web.paid + ")", title: web.paid ? 'Marcar como pendiente' : 'Marcar como pagado' }) +
        adminToggle('7ST', { cls: b7.active ? 'active' : '', on: b7.active, action: "setAccess('" + uid + "','7st','active'," + !b7.active + ")", title: b7.active ? 'Quitar libro 7ST' : 'Dar acceso al libro 7ST' }) +
        adminToggle('Semilla', { cls: bs.active ? 'active is-green' : '', on: bs.active, action: "setAccess('" + uid + "','semilla','active'," + !bs.active + ")", title: bs.active ? 'Quitar De la semilla al árbol' : 'Dar acceso a De la semilla al árbol' }) +
        adminToggle('IA', { cls: acc(u, 'ia').active ? 'active' : '', on: acc(u, 'ia').active, action: "setAccess('" + uid + "','ia','active'," + !acc(u, 'ia').active + ")", title: acc(u, 'ia').active ? 'Quitar IA aplicada a los negocios' : 'Dar acceso a IA aplicada a los negocios' }) +
        adminToggle(t('Pase completo'), { cls: acc(u, 'pase').active ? 'active is-gold' : '', on: acc(u, 'pase').active, action: "setAccess('" + uid + "','pase','active'," + !acc(u, 'pase').active + ")", title: 'Acceso a todos los programas y libros' }) +
        adminToggle('Marketing', { disabled: true, title: 'Próximamente' }) +
        (u.is_admin || !canTab('membresias') ? '' : memberControl(u, uid)) +
        (MY_PERMS.owner && !u.is_owner ? '<button class="admin-toggle' + (u.is_admin ? ' active' : '') + '" onclick="openStaffPerms(\'' + uid + '\')" title="' + escapeHtml(t('Dar o quitar acceso al panel de administración')) + '">' + escapeHtml(u.is_admin ? t('Equipo') + ' · ' + (u.admin_perms || []).length : t('Hacer administrador')) + '</button>' : '') +
        (u.is_admin ? '' :
          '<span class="admin-acct">' +
          adminToggle(u.suspended ? 'Reactivar' : 'Suspender', { cls: u.suspended ? 'unpaid' : '', action: "suspendUser('" + uid + "'," + !u.suspended + ")", title: u.suspended ? 'Permitir de nuevo el acceso' : 'Bloquear el inicio de sesión' }) +
          adminToggle('Eliminar', { cls: 'is-danger', action: "deleteUser('" + uid + "')", title: 'Eliminar la cuenta para siempre' }) +
          '</span>') +
      '</div>' +
    '</div>';
  }).join('');
}

// Membresía desde la ficha: plan pagado a mano (1 mes, se renueva sumando meses) o cortesía total
function memberControl(u, uid) {
  const plans = (SITE_CFG.planList || []).slice().sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
  const top = plans[plans.length - 1];
  const sub = u.subscription;
  const cur = u.courtesy ? 'courtesy' : (sub ? sub.plan_id : '');
  const opt = (v, label) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  const until = sub && !u.courtesy ? ' · ' + t('hasta') + ' ' + fmtDate(sub.period_end) : '';
  return '<span class="admin-member">' +
    '<select class="admin-member-select" aria-label="' + escapeHtml(t('Membresía')) + '" onchange="setMembership(\'' + uid + '\', this)">' +
      opt('', t('Sin membresía')) +
      plans.map(p => opt(p.id, t('Membresía') + ' ' + p.name + ' · $' + Number(p.price_usd))).join('') +
      (top ? opt('courtesy', t('Cortesía: acceso total')) : '') +
    '</select>' +
    (sub && !u.courtesy ? '<button class="admin-toggle" onclick="renewMembership(\'' + uid + '\')" title="' + escapeHtml(t('Sumar un mes a la membresía')) + '">+1 ' + escapeHtml(t('mes')) + '</button>' : '') +
    (until ? '<small class="admin-member-until">' + escapeHtml(until.slice(3)) + '</small>' : '') +
  '</span>';
}
async function setMembership(uid, sel) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u) return;
  const v = sel.value, who = u.full_name || u.email;
  const plans = (SITE_CFG.planList || []).slice().sort((a, b) => Number(b.price_usd) - Number(a.price_usd));
  const msg = v === 'courtesy' ? t('¿Dar acceso total de cortesía a') + ' ' + who + '?'
    : v === '' ? t('¿Quitar la membresía de') + ' ' + who + '?'
    : t('¿Activar un mes de membresía') + ' ' + ((SITE_CFG.plans || {})[v] || {}).name + ' ' + t('para') + ' ' + who + '? ' + t('Úsalo cuando el pago se recibió por fuera de la plataforma.');
  if (!confirm(msg)) { refreshAdminList(); return; }
  sel.disabled = true;
  try {
    if (v === 'courtesy') {
      const { error } = await sb.rpc('admin_set_courtesy', { email: u.email, plan: plans[0].id, note: t('Desde la ficha del estudiante'), enabled: true });
      if (error) throw error;
    } else {
      if (u.courtesy) { const { error } = await sb.rpc('admin_set_courtesy', { email: u.email, plan: '', note: '', enabled: false }); if (error) throw error; }
      const { error } = await sb.rpc('admin_set_membership', { uid, plan: v });
      if (error) throw error;
    }
    toast(t('Membresía actualizada'));
  } catch (e) { toast(e.message); }
  loadAdminData();
}
async function renewMembership(uid) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u || !u.subscription) return;
  if (!confirm(t('¿Sumar un mes a la membresía de') + ' ' + (u.full_name || u.email) + '?')) return;
  const { error } = await sb.rpc('admin_set_membership', { uid, plan: u.subscription.plan_id });
  if (error) { toast(error.message); return; }
  toast(t('Se sumó un mes'));
  loadAdminData();
}

// Permisos del equipo (solo el dueño): qué secciones del panel puede usar cada administrador
function openStaffPerms(uid) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u) return;
  const cur = u.admin_perms || [];
  let ov = document.getElementById('staff-overlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'staff-overlay'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal staff-modal" role="dialog" aria-modal="true">' +
    '<div class="modal-head"><h2>' + escapeHtml(t('Permisos del panel')) + '</h2><button class="icon-btn" onclick="closeStaffPerms()" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button></div>' +
    '<div class="modal-section"><p class="modal-hint"><b>' + escapeHtml(u.full_name || u.email) + '</b> · ' + escapeHtml(u.email) + '<br>' + escapeHtml(t('Marca las secciones del panel de administración que podrá usar. Sin ninguna marcada, vuelve a ser estudiante.')) + '</p>' +
    '<div class="staff-perms">' + PERM_LABELS.map(([k, label]) => '<label class="staff-perm"><input type="checkbox" value="' + k + '"' + (cur.includes(k) ? ' checked' : '') + '><span>' + escapeHtml(t(label)) + '</span></label>').join('') + '</div>' +
    '<div class="sv-actions"><button class="ui-btn ui-btn--ghost" onclick="closeStaffPerms()">' + escapeHtml(t('Cancelar')) + '</button><button class="ui-btn ui-btn--primary" id="staff-save" onclick="saveStaffPerms(\'' + uid + '\')">' + escapeHtml(t('Guardar permisos')) + '</button></div></div></div>';
  ov.style.display = 'flex';
  ov.onclick = e => { if (e.target === ov) closeStaffPerms(); };
}
function closeStaffPerms() { const ov = document.getElementById('staff-overlay'); if (ov) ov.style.display = 'none'; }
async function saveStaffPerms(uid) {
  const perms = [...document.querySelectorAll('#staff-overlay input:checked')].map(i => i.value);
  const btn = document.getElementById('staff-save'); btn.disabled = true;
  const { error } = await sb.rpc('owner_set_staff', { uid, perms });
  btn.disabled = false;
  if (error) { toast(error.message); return; }
  closeStaffPerms();
  toast(t(perms.length ? 'Permisos guardados' : 'Ya no es administrador'));
  loadAdminData();
}

// Activa / quita un acceso o marca un pago
async function setAccess(uid, product, field, value) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u) return;
  const prev = Object.assign({}, acc(u, product));
  const next = Object.assign({}, prev, { [field]: value });
  u.access = Object.assign({}, u.access, { [product]: next });
  renderAdminStats(); refreshAdminList();
  const { error } = await sb.from('access').upsert(
    { user_id: uid, product_id: product, active: next.active, paid: next.paid, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id' }
  );
  if (error) {
    u.access[product] = prev;
    renderAdminStats(); refreshAdminList();
    toast('No se pudo guardar: ' + error.message);
  } else {
    toast('Cambios guardados');
  }
}

// Suspender bloquea el inicio de sesión; eliminar borra la cuenta (los pagos quedan en Conciliación)
async function suspendUser(uid, suspend) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u) return;
  if (suspend && !confirm(t('¿Suspender la cuenta de') + ' ' + (u.full_name || u.email) + '? ' + t('No podrá entrar hasta que la reactives.'))) return;
  const { error } = await sb.rpc('admin_suspend_user', { uid, suspend });
  if (error) { toast(error.message); return; }
  u.suspended = suspend;
  refreshAdminList();
  toast(t(suspend ? 'Cuenta suspendida' : 'Cuenta reactivada'));
}

async function deleteUser(uid) {
  const u = allAdminUsers.find(x => x.id === uid);
  if (!u) return;
  const typed = prompt(t('Esto borra la cuenta, su progreso y certificados para siempre. Los pagos se conservan para tu contabilidad. Escribe el correo de la cuenta para confirmar:') + '\n' + u.email, '');
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== (u.email || '').toLowerCase()) { toast(t('El correo no coincide. No se eliminó nada.')); return; }
  const { error } = await sb.rpc('admin_delete_user', { uid });
  if (error) { toast(error.message); return; }
  allAdminUsers = allAdminUsers.filter(x => x.id !== uid);
  renderAdminStats(); refreshAdminList();
  toast(t('Cuenta eliminada'));
}

function filterAdminUsers(q) {
  const lq = (q || '').toLowerCase().trim();
  const filtered = lq
    ? allAdminUsers.filter(u => (u.email||'').toLowerCase().includes(lq) || (u.full_name||'').toLowerCase().includes(lq) || (u.phone||'').includes(lq))
    : allAdminUsers;
  renderAdminUsers(filtered);
}

function exportCSV() {
  if (!allAdminUsers.length) { toast('No hay usuarios para exportar.'); return; }
  const cell = v => {
    let t = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(t)) t = "'" + t; // evita fórmulas al abrir en Excel
    return '"' + t.replace(/"/g, '""') + '"';
  };
  const en = LANG === 'en';
  const yes = b => b ? (en ? 'Yes' : 'Sí') : 'No';
  const headers = en
    ? ['Name', 'Email', 'Phone', 'Web Dev active', 'Paid Web Dev', 'Web Dev progress', '7ST', 'Seed', 'Certificates', 'Joined', 'Last visit']
    : ['Nombre', 'Email', 'Teléfono', 'Web Dev activo', 'Pagó Web Dev', 'Progreso Web Dev', '7ST', 'Semilla', 'Certificados', 'Registro', 'Última visita'];
  const rows = allAdminUsers.map(u => [
    u.full_name, u.email, u.phone, yes(acc(u, 'web-dev').active), yes(acc(u, 'web-dev').paid),
    (u.web_progress || 0) + '/16', yes(acc(u, '7st').active), yes(acc(u, 'semilla').active),
    (u.certificates || []).join(' '), fmtDate(u.created_at), fmtDate(u.last_seen_at)
  ].map(cell));
  const csv = [headers.map(cell).join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dgp-academy-estudiantes.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let cuposTotal = 20;
async function loadCupos() {
  try {
    const v = await loadCuposPublic();
    cuposTotal = v.total || 20;
    updateLpCupos(v.disponibles, cuposTotal);
  } catch (e) { /* sin cupos */ }
}

function updateLpCupos(n, total) {
  total = total || cuposTotal;
  const lpNum = document.getElementById('lp-cupos-num');
  if (lpNum) lpNum.textContent = n;
  const lpTotal = document.getElementById('lp-cupos-total');
  if (lpTotal) lpTotal.textContent = total;
  const bar = document.getElementById('lp-cupos-bar');
  if (bar) bar.style.width = Math.max(0, Math.min(100, n / total * 100)) + '%';
  const wrap = document.getElementById('lp-cupos-wrap');
  if (wrap) wrap.classList.toggle('is-low', n <= 5);
}

// ── UI de usuario ─────────────────────────────────────────────────────────────
function fillUserUI() {
  if (!STATE.user) return;
  const name    = displayName();
  document.getElementById('dash-avatar').textContent       = name.charAt(0).toUpperCase();
  document.getElementById('dash-username').textContent     = name;
  document.getElementById('dash-useremail').textContent    = STATE.user.email;
  document.getElementById('dash-welcome-name').textContent = name.split(' ')[0];
  const h = new Date().getHours();
  const g = document.getElementById('dash-greeting');
  if (g) g.textContent = (h < 12 ? t('Buenos días') : (h < 19 ? t('Buenas tardes') : t('Buenas noches'))) + ' · ' + welcomeBack();
}

// Saludo según cómo prefiere que le llamemos (perfil): Bienvenido / Bienvenida / Te damos la bienvenida
function userGender() { return (STATE.profile && STATE.profile.gender) || 'x'; }
function welcomeWord() {
  const g = userGender();
  if (LANG === 'en') return 'Welcome';
  return g === 'm' ? 'Bienvenido' : g === 'f' ? 'Bienvenida' : 'Te damos la bienvenida';
}
function welcomeBack() {
  const g = userGender();
  if (LANG === 'en') return 'Welcome back';
  return g === 'm' ? 'Bienvenido de nuevo' : g === 'f' ? 'Bienvenida de nuevo' : 'Qué bueno verte';
}
async function saveSettingsGender(g) {
  if (!STATE.user || !['m', 'f', 'x'].includes(g)) return;
  const { error } = await sb.from('profiles').update({ gender: g }).eq('id', STATE.user.id);
  if (error) { toast(t('No se pudo guardar') + ': ' + error.message); return; }
  STATE.profile.gender = g;
  fillUserUI();
  flashMsg('settings-gender-msg');
}

// ── Tabs login / registro ──────────────────────────────────────────────────────
let authMode = 'login';
function switchTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&mode==='login')||(i===1&&mode==='register')));
  document.getElementById('field-name').style.display    = mode==='register' ? 'flex'  : 'none';
  document.getElementById('field-phone').style.display   = mode==='register' ? 'block' : 'none';
  document.getElementById('field-gender').style.display  = mode==='register' ? 'block' : 'none';
  document.getElementById('forgot-link').style.display   = mode==='login'    ? 'block' : 'none';
  document.getElementById('auth-title').textContent      = mode==='login' ? 'Qué bueno verte de nuevo' : 'Crea tu cuenta';
  document.getElementById('auth-sub').textContent        = mode==='login' ? 'Ingresa para continuar con tus programas.' : 'Es gratis y toma un minuto. Después activamos tu acceso.';
  const pw = document.getElementById('input-password');
  if (pw) pw.setAttribute('autocomplete', mode==='login' ? 'current-password' : 'new-password');
  document.getElementById('btn-auth-text').textContent   = mode==='login' ? 'Iniciar sesión' : 'Crear mi cuenta';
  const rules = document.getElementById('password-rules');
  if (rules) rules.style.display = 'none';
  const pwInput = document.getElementById('input-password');
  if (pwInput) pwInput.value = '';
  showAuthError('');
}

// ── Manejo del form ────────────────────────────────────────────────────────────
function checkPasswordStrength(val) {
  const rules = document.getElementById('password-rules');
  if (!rules) return;
  const isRegister = authMode === 'register';
  rules.style.display = isRegister && val.length > 0 ? 'grid' : 'none';
  const set = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('ok', ok);
    const svgOk = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const svgNo = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>';
    el.querySelector('svg').outerHTML; // noop read
    el.innerHTML = (ok ? svgOk : svgNo) + ' ' + el.textContent.trim();
  };
  set('pw-len',     val.length >= 8);
  set('pw-upper',   /[A-Z]/.test(val));
  set('pw-lower',   /[a-z]/.test(val));
  set('pw-num',     /[0-9]/.test(val));
  set('pw-special', /[^A-Za-z0-9]/.test(val));
}

function passwordValid(val) {
  return val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val);
}

async function handleAuth(e) {
  e.preventDefault();
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const name     = document.getElementById('input-name').value.trim();
  const apellido = document.getElementById('input-apellido')?.value.trim() || '';
  const phone    = document.getElementById('input-phone')?.value.trim() || '';
  const fullName = `${name} ${apellido}`.trim();

  if (!email) { showAuthError('Escribe tu correo electrónico.'); return; }
  if (!password) { showAuthError('Escribe tu contraseña.'); return; }
  if (authMode === 'register' && !name) { showAuthError('Escribe tu nombre.'); return; }
  if (authMode === 'register' && !passwordValid(password)) {
    showAuthError('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y un carácter especial.');
    return;
  }

  setAuthLoading(true);
  showAuthError('');

  if (authMode === 'login') {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) showAuthError(mapAuthError(error));
    // La sesión la recoge onAuthStateChange
    return;
  }

  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone, lang: LANG, gender: (document.querySelector('input[name="gender"]:checked') || {}).value || 'x' }, emailRedirectTo: SITE_URL }
  });
  setAuthLoading(false);
  if (error) { showAuthError(mapAuthError(error)); return; }
  // Si el correo ya existía, Supabase devuelve un usuario sin identidades
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    showAuthError('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
    return;
  }
  if (!data.session) {
    switchTab('login');
    document.getElementById('input-email').value = email;
    showAuthError('✓ Te enviamos un correo a ' + email + '. Ábrelo y confirma tu cuenta para entrar.');
  }
}

function setAuthLoading(on) {
  const btn = document.getElementById('btn-auth');
  const txt = document.getElementById('btn-auth-text');
  const ldr = document.getElementById('btn-loader');
  btn.disabled = on;
  txt.style.display = on ? 'none' : '';
  ldr.style.display = on ? 'block' : 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  const ok = msg.startsWith('✓');
  el.textContent = ok ? msg.replace(/^✓\s*/, '') : msg;
  el.classList.toggle('show', !!msg);
  el.classList.toggle('is-ok', ok);
}

function togglePw() {
  const pw = document.getElementById('input-password');
  const btn = document.querySelector('.pw-toggle');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  if (btn) { btn.textContent = show ? 'Ocultar' : 'Mostrar'; btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); }
}

function mapAuthError(err) {
  const code = (err && (err.code || err.error_code)) || '';
  const msg = (err && err.message) || '';
  const map = {
    invalid_credentials:        'Correo o contraseña incorrectos. Si no la recuerdas, usa «¿Olvidaste tu contraseña?».',
    email_not_confirmed:        'Primero confirma tu cuenta con el enlace que te enviamos por correo.',
    user_already_exists:        'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    email_exists:               'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    weak_password:              'La contraseña es demasiado débil.',
    over_request_rate_limit:    'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    over_email_send_rate_limit: 'Ya enviamos varios correos. Espera unos minutos antes de pedir otro.',
    email_address_invalid:      'El correo no es válido.',
    validation_failed:          'Revisa el correo y la contraseña.',
    signup_disabled:            'Los registros están cerrados por el momento.',
    user_banned:                'Esta cuenta está suspendida. Escríbenos a ' + CONTACT.email + '.'
  };
  if (map[code]) return map[code];
  if (/invalid login credentials/i.test(msg)) return map.invalid_credentials;
  // Cuenta suspendida desde el panel admin (Supabase la marca como bloqueada)
  if (/banned|querying schema/i.test(msg)) return map.user_banned;
  if (/email not confirmed/i.test(msg)) return map.email_not_confirmed;
  if (/fetch|network/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  return 'No se pudo completar (' + (code || msg || 'error desconocido') + '). Intenta de nuevo.';
}

const SITE_URL = location.origin + location.pathname;

async function forgotPassword() {
  const email = document.getElementById('input-email').value.trim();
  if (!email) { showAuthError('Escribe tu correo primero para recuperar la contraseña.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
  if (error) showAuthError(mapAuthError(error));
  else showAuthError('✓ Si existe una cuenta con ese correo, te llegará un enlace para crear una nueva contraseña.');
}

// Nueva contraseña desde el enlace del correo
function showRecovery() {
  const o = document.getElementById('recovery-overlay');
  if (o) { o.style.display = 'flex'; document.getElementById('recovery-password').focus(); }
}
async function saveNewPassword() {
  const pw = document.getElementById('recovery-password').value;
  const msg = document.getElementById('recovery-msg');
  if (!passwordValid(pw)) {
    msg.textContent = 'Mínimo 8 caracteres, con mayúscula, minúscula, número y un carácter especial.';
    msg.className = 'modal-error'; return;
  }
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) { msg.textContent = mapAuthError(error); msg.className = 'modal-error'; return; }
  document.getElementById('recovery-overlay').style.display = 'none';
  toast('Contraseña actualizada');
}

// ── Cerrar sesión ──────────────────────────────────────────────────────────────
async function signOut() {
  await sb.auth.signOut();
  // onAuthStateChange limpia el estado y muestra la landing
}

// ── Cierre de sesión por inactividad (10 minutos) ─────────────────────────────
// La última actividad se guarda en localStorage para que cuente en todas las pestañas
// y también al volver a abrir la página después de un rato.
const IDLE_LIMIT = 10 * 60 * 1000, IDLE_KEY = 'dgp-last-activity';
let idleTimer = null, idleWarned = false;
function markActivity() {
  if (!STATE.user) return;
  try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch (e) {}
  idleWarned = false;
}
function lastActivity() {
  try { return Number(localStorage.getItem(IDLE_KEY)) || Date.now(); } catch (e) { return Date.now(); }
}
// 20 segundos antes del cierre aparece una cuenta regresiva en pantalla;
// al cerrarse queda un aviso fijo hasta que la persona lo descarta.
const IDLE_WARN = 20 * 1000;
let idleCountdown = null;
function showIdleWarning() {
  const box = document.getElementById('idle-warn');
  if (!box || !box.hidden) return;
  box.hidden = false;
  const tick = () => {
    const left = Math.max(0, Math.ceil((IDLE_LIMIT - (Date.now() - lastActivity())) / 1000));
    document.getElementById('idle-warn-secs').textContent = left;
    document.getElementById('idle-warn-bar').style.transform = 'scaleX(' + Math.min(1, left / (IDLE_WARN / 1000)) + ')';
    if (left <= 0) checkIdle();
  };
  tick();
  clearInterval(idleCountdown);
  idleCountdown = setInterval(tick, 250);
}
function hideIdleWarning() {
  clearInterval(idleCountdown);
  const box = document.getElementById('idle-warn');
  if (box) box.hidden = true;
}
function stayConnected() { lastMark = Date.now(); markActivity(); hideIdleWarning(); }
function showIdleClosed() {
  try { sessionStorage.setItem('dgp-idle-closed', '1'); } catch (e) {}
  const n = document.getElementById('idle-closed');
  if (n) n.hidden = false;
}
function dismissIdleClosed() {
  try { sessionStorage.removeItem('dgp-idle-closed'); } catch (e) {}
  const n = document.getElementById('idle-closed');
  if (n) n.hidden = true;
}
let idleClosing = false;
async function checkIdle() {
  if (!STATE.user || idleClosing) return;
  const idle = Date.now() - lastActivity();
  if (idle >= IDLE_LIMIT) {
    idleClosing = true;
    hideIdleWarning();
    try { localStorage.removeItem(IDLE_KEY); } catch (e) {}
    await signOut();
    showIdleClosed();
    idleClosing = false;
  } else if (idle >= IDLE_LIMIT - IDLE_WARN) {
    showIdleWarning();
  } else {
    hideIdleWarning();
  }
}
let lastMark = 0;
['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'wheel'].forEach(ev =>
  window.addEventListener(ev, e => {
    // Con la cuenta regresiva visible solo cuenta una acción clara (clic, tecla o toque), no mover el ratón
    const warn = document.getElementById('idle-warn');
    if (warn && !warn.hidden) { if (ev === 'pointerdown' || ev === 'keydown' || ev === 'touchstart') { if (!warn.contains(e.target)) stayConnected(); } return; }
    const n = Date.now(); if (n - lastMark > 15000) { lastMark = n; markActivity(); }
  }, { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkIdle(); });
idleTimer = setInterval(checkIdle, 2000);
document.addEventListener('DOMContentLoaded', () => {
  let flag = false;
  try { flag = sessionStorage.getItem('dgp-idle-closed') === '1'; } catch (e) {}
  if (flag) { const n = document.getElementById('idle-closed'); if (n) n.hidden = false; }
});

// ── Entrar al curso ────────────────────────────────────────────────────────────
function enterCourse(lessonId) {
  openProtected('web-dev', '#course-screen', () => {
    showCourse();
    updateProgress();
    goTo(lessonId || current || 'home');
  });
}

// ── Stats del dashboard ────────────────────────────────────────────────────────
const LESSON_TITLES = {
  home:'Introducción al curso', l1:'¿Cómo funciona la web?', l2:'HTML desde cero', l3:'CSS — estilo y diseño',
  l4:'JavaScript — interactividad', l5:'GitHub y control de versiones', l6:'IA: Claude Code y GitHub',
  l7:'GitHub Pages y publicación', l8:'Servicios y herramientas extra', l9:'APIs — cómo todo se conecta',
  l10:'Flujo completo de un proyecto', l11:'Diseño y tipografía', l12:'CSS avanzado y animaciones',
  l13:'Responsive design', l14:'SEO y posicionamiento', l15:'Analítica y métricas', l16:'Portafolio y primeros clientes'
};
const LESSON_MODULE = { l1:1,l2:1,l3:1,l4:1,l5:2,l6:2,l7:2,l8:2,l9:3,l10:3,l11:4,l12:4,l13:4,l14:5,l15:5,l16:5 };

function nextLessonId() {
  const order = ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10','l11','l12','l13','l14','l15','l16'];
  return order.find(id => !completed.includes(id)) || null;
}

function updateDashStats() {
  const n = completed.filter(l => l !== 'home').length;
  const pct = Math.round(n / 16 * 100);
  const done = n >= 16;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dash-completed', n);
  set('dash-remaining', Math.max(0, 16 - n));
  set('dash-prog-text', n + ' / 16');
  set('dash-circle-pct', pct + '%');
  set('dash-prog-pct-label', done ? 'Completado' : pct + '%');
  set('dash-prog-pct-mini', pct + '%');
  const elF = document.getElementById('dash-prog-fill');
  if (elF) { elF.style.width = pct + '%'; elF.style.background = done ? 'var(--green)' : ''; }
  const elC = document.getElementById('dash-circle-fill');
  if (elC) { elC.setAttribute('stroke-dasharray', pct + ' ' + (100 - pct)); elC.setAttribute('stroke', done ? '#15803d' : '#1a56e8'); }

  // Tarjeta "continúa donde lo dejaste"
  const card = document.getElementById('dash-continue');
  if (card) {
    const next = nextLessonId();
    const kicker = document.getElementById('dash-continue-kicker');
    const title = document.getElementById('dash-continue-title');
    const meta = document.getElementById('dash-continue-meta');
    const btn = document.getElementById('dash-continue-btn');
    card.classList.toggle('is-locked', !hasWebAccess);
    if (!hasWebAccess) {
      kicker.textContent = 'Programa pendiente de activación';
      title.textContent = 'Diseño y Desarrollo Web con IA';
      meta.textContent = 'Activa tu acceso para empezar la primera lección.';
      btn.innerHTML = ICON.lock + 'Cómo activarlo';
    } else if (done) {
      kicker.textContent = 'Programa completado';
      title.textContent = '¡Felicitaciones! Terminaste las 16 lecciones';
      meta.textContent = 'Tu certificado ya está disponible.';
      btn.innerHTML = ICON.award + 'Ver certificado';
    } else {
      const id = n === 0 ? 'home' : next;
      kicker.textContent = n === 0 ? 'Empieza aquí' : 'Tu siguiente lección · Módulo ' + LESSON_MODULE[id];
      title.textContent = LESSON_TITLES[id];
      meta.textContent = 'Diseño y Desarrollo Web con IA · ' + n + ' de 16 completadas';
      btn.innerHTML = ICON.play + (n === 0 ? 'Comenzar' : 'Continuar');
    }
  }
  if (card && preferAICourse()) {
    const ri = STATE.reading['ia'] || {};
    const doneIA = AI_COUNTED.filter(id => readSet('ia').has(id)).length;
    const nextIA = AI_COUNTED.find(id => !readSet('ia').has(id)) || 'ai16';
    const cur = ri.last_item && ri.last_item !== 'ai0' ? ri.last_item : (doneIA ? nextIA : 'ai0');
    const l = AI_COURSE.lessons.find(x => x.id === cur) || AI_COURSE.lessons[0];
    card.classList.remove('is-locked');
    if (aiCourseDone()) {
      document.getElementById('dash-continue-kicker').textContent = t('Programa completado');
      document.getElementById('dash-continue-title').textContent = t('¡Felicitaciones! Terminaste IA aplicada a los negocios');
      document.getElementById('dash-continue-meta').textContent = t('Tu certificado ya está disponible.');
      document.getElementById('dash-continue-btn').innerHTML = ICON.award + t('Ver certificado');
    } else {
      document.getElementById('dash-continue-kicker').textContent = cur === 'ai0' ? t('Empieza aquí') : t('Tu siguiente lección') + ' · ' + t('Lección') + ' ' + AI_LESSONS.indexOf(cur);
      document.getElementById('dash-continue-title').textContent = aiTitle(l);
      document.getElementById('dash-continue-meta').textContent = t('IA aplicada a los negocios') + ' · ' + doneIA + ' ' + t('de') + ' 16 ' + t('completadas');
      document.getElementById('dash-continue-btn').innerHTML = ICON.play + (doneIA ? t('Continuar') : t('Comenzar'));
    }
  }
  updateCourseBtn(done);
  renderCertificates();
}

// La tarjeta "continúa" lleva al programa de IA si es el que la persona tiene o usó más recientemente
function preferAICourse() {
  if (typeof AI_COURSE === 'undefined' || !hasAccess('ia')) return false;
  if (!hasWebAccess) return true;
  const ri = STATE.reading['ia'], rw = STATE.reading['web-dev'];
  const started = readSet('ia').size > 0 || !!(ri && ri.last_item && ri.last_item !== 'ai0');
  if (!started) return false;
  if (!completed.filter(l => l !== 'home').length) return true;
  return !!(ri && ri.updated_at && (!rw || !rw.updated_at || new Date(ri.updated_at) > new Date(rw.updated_at)));
}

function continueCourse() {
  if (preferAICourse()) { if (aiCourseDone()) openCertificate('ia'); else showAICourse(); return; }
  if (!hasWebAccess) {
    const box = document.getElementById('dash-activate');
    if (box) { box.style.display = 'grid'; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return;
  }
  const n = completed.filter(l => l !== 'home').length;
  if (n >= 16) { openCertificate('web-dev'); return; }
  enterCourse(n === 0 ? 'home' : nextLessonId());
}

function updateCourseBtn(done) {
  const btn = document.getElementById('btn-web-dev');
  // Sin acceso el botón es de compra (lo pone updateAccessUI); no se reemplaza
  if (!btn || btn.disabled || !hasWebAccess) return;
  if (done) {
    btn.innerHTML = ICON.award + 'Completado · Ver certificado';
    btn.className = 'ui-btn ui-btn--block btn-course is-done';
    btn.onclick = function() { openCertificate('web-dev'); };
  } else {
    const n = completed.filter(l => l !== 'home').length;
    btn.innerHTML = ICON.play + (n === 0 ? 'Comenzar programa' : 'Continuar programa');
    btn.className = 'ui-btn ui-btn--block btn-course is-active';
    btn.onclick = function() { continueCourse(); };
  }
}

// Botón "Volver al dashboard" en el curso — lo agregamos a la topbar
document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.querySelector('.topbar-actions');
  if (topbar) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-ghost topbar-back';
    backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Mis cursos';
    backBtn.onclick = () => { showDashboard(); updateDashStats(); };
    topbar.insertBefore(backBtn, topbar.firstChild);
  }
});

// ── Cambio de idioma ──────────────────────────────────────────────────────────
// Los textos fijos los traduce i18n.js; aquí se recarga lo que depende del idioma
function onLangChange() {
  if (STATE.user) {
    renderActivation(); renderCertificates();
    renderAnnouncement(); renderMyPayments(); renderPendingNotice(); renderMember();
    if (STATE.profile) STATE.profile.lang = LANG;
    sb.from('profiles').update({ lang: LANG }).eq('id', STATE.user.id).then(() => {}, () => {});
  }
  if (document.getElementById('admin-screen').style.display === 'block') adminRefresh();
  if (typeof previewCertificate === 'function') previewCertificate();
  renderLandingPlans(); renderBlog();
  if (typeof aiOnLangChange === 'function') aiOnLangChange();
  if (typeof updateAIAccess === 'function' && STATE.user) updateAIAccess();
  const course = document.getElementById('course-screen');
  if (course && course.style.display === 'block') {
    loadContent('web-dev', '#course-screen').then(() => { goTo(current); updateFinishBtn(); }).catch(() => {});
  }
  const b1 = document.getElementById('book-screen');
  if (b1 && b1.style.display === 'block') loadContent('7st', '#book-screen').then(() => goToChapter(currentChapter)).catch(() => {});
  const b2 = document.getElementById('book-screen-2');
  if (b2 && b2.style.display === 'block') loadContent('semilla', '#book-screen-2').then(() => goToChapter2(currentChapter2)).catch(() => {});
}
