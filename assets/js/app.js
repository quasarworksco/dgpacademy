// ── Firebase Config ──────────────────────────────────────────────────────────
// Reemplaza estos valores con los de tu proyecto en console.firebase.google.com
// Proyecto → Configuración → Tus apps → Configuración del SDK
const firebaseConfig = {
  apiKey:            "AIzaSyC0B2yyVFLKRIuslI7sHMHjp4XLlrHzieY",
  authDomain:        "dgp-academy.firebaseapp.com",
  projectId:         "dgp-academy",
  storageBucket:     "dgp-academy.firebasestorage.app",
  messagingSenderId: "556603875596",
  appId:             "1:556603875596:web:e65f527733c7bbdc44a929",
  measurementId:     "G-2S5RJ9P6D1"
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin UID ─────────────────────────────────────────────────────────────────
// Reemplaza este string con tu UID de Firebase (Firebase Console → Auth → Users → tu correo → User UID)
const ADMIN_UID = 'xbrwtQPEmdPXUOqYabkZQPWG32C3';

// ── Reglas de Firestore: ver firestore.rules en la raíz del repositorio ─────────

let firebaseReady = false;
let auth = null;
let db   = null;

try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db   = firebase.firestore();
  firebaseReady = true;
  // Carga cupos en el landing apenas Firebase esté listo
  setTimeout(loadCupos, 0);
} catch(e) {
  console.warn('Firebase no configurado. Modo demo activo.');
}

// ── Contacto para activar accesos ───────────────────────────────────────────
// Número de WhatsApp en formato internacional sin "+" ni espacios (ej. '5215512345678').
// Si se deja vacío, el panel de activación solo muestra el botón de correo.
const CONTACT = {
  email: 'hola@dgpglobalgroup.com',
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
function showLanding() { showScreen('landing-screen'); hideSplash(); }
function withSplash(fn) {
  const splash = document.getElementById('splash-screen');
  if (!splash) return fn();
  splash.style.display = 'flex';
  requestAnimationFrame(() => splash.classList.add('active'));
  setTimeout(fn, 650);
}
function goToAuth()     { withSplash(() => { showAuth(); switchTab('login'); }); }
function goToRegister() { withSplash(() => { showAuth(); switchTab('register'); }); }
function showAuth()      { showScreen('auth-screen', 'flex'); hideSplash(); }
function showDashboard() { showScreen('dash-screen'); updateDashStats(); hideSplash(); }
function showCourse()    { showScreen('course-screen'); }
function showAdmin()     { showScreen('admin-screen'); loadAdminData(); }

// ── Book reader ───────────────────────────────────────────────────────────────
function showBook(bookId) {
  showScreen('book-screen');
  // Resume from last saved chapter (Firestore)
  const startChapter = window._bookLastChapter || 'ch-intro';
  goToChapter(startChapter);
}

function closeBook() {
  document.getElementById('book-screen').style.display = 'none';
  showDashboard();
}

let currentChapter = 'ch-intro';
window._bookReadChapters = window._bookReadChapters || new Set();
const BOOK_CHAPTERS = ['ch-intro','ch-1','ch-2','ch-3','ch-4','ch-5','ch-6','ch-7','ch-8','ch-9','ch-10','ch-conclusion'];

function markChapterRead(id) {
  if (!BOOK_CHAPTERS.includes(id)) return;
  if (window._bookReadChapters.has(id)) return; // already marked
  window._bookReadChapters.add(id);
  // Update TOC checkmark
  const tocEl = document.querySelector('[data-ch="' + id + '"]');
  if (tocEl) tocEl.classList.add('read');
  // Update library card progress bar
  updateBookReadProgress();
  // Save to Firestore
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({
      'bookProgress.7st-read': Array.from(window._bookReadChapters)
    }).catch(() => {});
  }
}

function updateBookReadProgress() {
  const total = BOOK_CHAPTERS.length;
  const done = BOOK_CHAPTERS.filter(c => window._bookReadChapters.has(c)).length;
  const pct = Math.round((done / total) * 100);
  const fill = document.getElementById('book-read-bar-fill');
  const lbl  = document.getElementById('book-read-label');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent = done + ' / ' + total + ' capítulos leídos';
}

function loadBookReadChapters(arr) {
  window._bookReadChapters = new Set(arr || []);
  BOOK_CHAPTERS.forEach(id => {
    if (window._bookReadChapters.has(id)) {
      const tocEl = document.querySelector('[data-ch="' + id + '"]');
      if (tocEl) tocEl.classList.add('read');
    }
  });
  updateBookReadProgress();
}

function goToChapter(id) {
  document.querySelectorAll('.book-chapter').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.book-toc-item').forEach(el => el.classList.remove('active'));
  const ch = document.getElementById(id);
  if (ch) { ch.classList.add('active'); document.getElementById('book-content').scrollTop = 0; }
  const tocItem = document.querySelector('[data-ch="' + id + '"]');
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
  // Mark chapter as read
  markChapterRead(id);
  // Save chapter position to Firestore per user
  window._bookLastChapter = id;
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({
      'bookProgress.7st': id
    }).catch(() => {});
  }
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

// ── Auth State ───────────────────────────────────────────────────────────────
if (firebaseReady) {
  auth.onAuthStateChanged(user => {
    if (user) {
      fillUserUI(user);
      // Show admin button if this is the admin account
      const adminBtn = document.getElementById('btn-admin-panel');
      if (adminBtn) adminBtn.style.display = (user.uid === ADMIN_UID) ? 'flex' : 'none';
      // Save/update user doc and load their course access
      if (db) {
        db.collection('users').doc(user.uid).set({
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        .then(() => db.collection('users').doc(user.uid).get())
        .then(doc => {
          const docData = doc.exists ? doc.data() : {};
          window._userDoc = docData;
          const courses = docData.courses || [];
          updateCourseAccess(courses);
          const books = docData.books || [];
          updateBookAccess(books);
          // ── Load course progress from Firestore (not localStorage) ──
          const savedLessons = (docData.completedLessons && docData.completedLessons['web-dev']) || null;
          if (savedLessons && savedLessons.length > 0) {
            completed = savedLessons;
          } else {
            // Fallback: reconstruct from count if completedLessons not stored yet
            const count = (docData.progress && docData.progress['web-dev']) || 0;
            if (count > 0) {
              completed = lessons.filter(l => l !== 'home').slice(0, count);
            } else {
              completed = [];
            }
          }
          // Ensure completedCourses flag is reflected
          if (docData.completedCourses && docData.completedCourses.includes('web-dev') && !completed.includes('l16')) {
            completed.push('l16');
          }
          // ── Load book chapter position ──
          window._bookLastChapter = (docData.bookProgress && docData.bookProgress['7st']) || 'ch-intro';
          window._book2LastChapter = (docData.bookProgress && docData.bookProgress['semilla']) || 's2-nota';
          // ── Load read chapters ──
          loadBookReadChapters((docData.bookProgress && docData.bookProgress['7st-read']) || []);
          loadBook2ReadChapters((docData.bookProgress && docData.bookProgress['semilla-read']) || []);
          updateBookAccess2(docData.books || []);
          // Sync to localStorage as cache
          localStorage.setItem('curso_done_' + user.uid, JSON.stringify(completed));
          updateDashStats();
        })
        .catch(() => { updateCourseAccess([]); updateBookAccess([]); updateBookAccess2([]); });
      }
      showDashboard();
    } else {
      showLanding();
    }
  });
} else {
  // Modo demo: muestra landing con acceso completo
  showLanding();
}

// ── Course access control ─────────────────────────────────────────────────────
const ICON = {
  play: '<svg><use href="#i-play"/></svg>',
  lock: '<svg><use href="#i-lock"/></svg>',
  book: '<svg><use href="#i-book"/></svg>',
  award: '<svg><use href="#i-award"/></svg>',
  check: '<svg><use href="#i-check"/></svg>'
};
let hasWebAccess = false;

function updateCourseAccess(courses) {
  // courses = IDs de programas habilitados por el admin, ej. ['web-dev']
  const btn = document.getElementById('btn-web-dev');
  if (!btn) return;
  hasWebAccess = courses.includes('web-dev');
  const status = document.getElementById('web-dev-status');
  if (hasWebAccess) {
    btn.className = 'ui-btn ui-btn--block btn-course is-active';
    btn.disabled = false;
    btn.onclick = function() { enterCourse(); };
    if (status) { status.textContent = 'Activo'; status.className = 'chip chip--light course-status is-active'; }
  } else {
    btn.innerHTML = ICON.lock + 'Acceso pendiente de activación';
    btn.className = 'ui-btn ui-btn--block btn-course is-locked';
    btn.disabled = true;
    btn.onclick = null;
    if (status) { status.textContent = 'Sin activar'; status.className = 'chip chip--light course-status'; }
  }
  renderActivation();
  updateDashStats();
}

// Panel "Activa tu acceso" para cuentas sin programa habilitado
function renderActivation() {
  const box = document.getElementById('dash-activate');
  if (!box) return;
  const books = (window._userDoc && window._userDoc.books) || [];
  box.style.display = (!hasWebAccess && !books.length) ? 'grid' : 'none';
  const user = auth && auth.currentUser;
  const who = user ? (user.displayName || user.email) : '';
  const msg = 'Hola, quiero activar mi acceso a DGP Academy (Diseño y Desarrollo Web con IA). Mi cuenta: ' + (user ? user.email : '') + (who && user && who !== user.email ? ' — ' + who : '');
  const mail = document.getElementById('dash-activate-mail');
  if (mail) mail.href = 'mailto:' + CONTACT.email + '?subject=' + encodeURIComponent('Activar acceso — DGP Academy') + '&body=' + encodeURIComponent(msg);
  const wa = document.getElementById('dash-activate-wa');
  if (wa) {
    wa.style.display = CONTACT.whatsapp ? '' : 'none';
    if (CONTACT.whatsapp) wa.href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(msg);
  }
}

function updateBookAccess(books) {
  const btn = document.getElementById('btn-7st');
  const progressWrap = document.getElementById('book-7st-progress');
  if (!btn) return;
  if (books.includes('7st')) {
    btn.innerHTML = ICON.book + 'Leer libro';
    btn.className = 'ui-btn ui-btn--block btn-book is-active';
    btn.disabled = false;
    btn.onclick = function() { showBook('7st'); };
    if (progressWrap) progressWrap.style.display = 'block';
    updateBookReadProgress();
  } else {
    btn.innerHTML = ICON.lock + 'Sin acceso';
    btn.className = 'ui-btn ui-btn--block btn-book is-locked';
    btn.disabled = true;
    btn.onclick = null;
    if (progressWrap) progressWrap.style.display = 'none';
  }
  renderActivation();
}

// ── Book Quiz ────────────────────────────────────────────────────────────────
const QUIZ_ANSWERS = [1, 2, 1, 1, 1, 1, 1, 2, 2, 1]; // correct index per question (0-based)
const quizSelected = new Array(10).fill(-1);

function selectOpt(btn) {
  const q = parseInt(btn.getAttribute('data-q'));
  const i = parseInt(btn.getAttribute('data-i'));
  // Clear previous selection for this question
  document.querySelectorAll('[data-q="' + q + '"].quiz-opt').forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  quizSelected[q] = i;
  // Enable submit if all answered
  const allAnswered = quizSelected.every(v => v !== -1);
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) sub.disabled = !allAnswered;
}

function submitQuiz() {
  // Disable all options
  document.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.disabled = true;
    const q = parseInt(btn.getAttribute('data-q'));
    const i = parseInt(btn.getAttribute('data-i'));
    if (i === QUIZ_ANSWERS[q]) btn.classList.add('reveal-correct');
    else if (btn.classList.contains('selected') && i !== QUIZ_ANSWERS[q]) btn.classList.add('wrong');
    btn.classList.remove('selected');
  });
  // Score
  let score = 0;
  for (let q = 0; q < 10; q++) {
    if (quizSelected[q] === QUIZ_ANSWERS[q]) score++;
  }
  const pass = score >= 7;
  const pct = Math.round((score / 10) * 100);
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) sub.style.display = 'none';
  const resultEl = document.getElementById('quiz-result');
  resultEl.style.display = 'block';
  if (pass) {
    resultEl.innerHTML = '<div class="quiz-result-banner pass">' +
      '<div class="quiz-score-big">' + score + '/10</div>' +
      '<div class="quiz-score-lbl">Has aprobado la evaluación</div>' +
      '<div class="quiz-cert-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> Certificado de Lectura 7ST Vol. 1</div>' +
      '<p style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:8px;">¡Felicitaciones! Completaste el 7ST Vol. 1 con ' + pct + '% de precisión.<br>Eres parte de la comunidad DGP Global Group.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;">' +
      '<button class="ui-btn ui-btn--light" onclick="openCertificate(\'7st\')">' + ICON.award + 'Ver certificado de lectura</button>' +
      '<button class="ui-btn ui-btn--ghost-light" onclick="closeBook()">Volver a mis cursos</button></div>' +
      '</div>';
    // Save completion to Firestore
    if (db && auth && auth.currentUser) {
      db.collection('users').doc(auth.currentUser.uid).update({
        'bookProgress.7st-quiz-score': score,
        'bookProgress.7st-completed': true
      }).catch(() => {});
    }
    window._userDoc = window._userDoc || {};
    window._userDoc.bookProgress = Object.assign({}, window._userDoc.bookProgress, { '7st-quiz-score': score, '7st-completed': true });
    // Mark quiz chapter read
    markChapterRead('ch-conclusion');
  } else {
    resultEl.innerHTML = '<div class="quiz-result-banner fail">' +
      '<div class="quiz-score-big">' + score + '/10</div>' +
      '<div class="quiz-score-lbl">Necesitas 7 o más para aprobar</div>' +
      '<p style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:10px;">¡Casi! Revisa los capítulos donde fallaste y vuelve a intentarlo.</p>' +
      '<button class="btn btn-primary" style="margin-top:14px;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);color:#fff;" onclick="retryQuiz()">Reintentar evaluación</button>' +
      '</div>';
  }
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function retryQuiz() {
  for (let i = 0; i < 10; i++) quizSelected[i] = -1;
  document.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected','correct','wrong','reveal-correct');
  });
  const sub = document.getElementById('btn-submit-quiz');
  if (sub) { sub.style.display = ''; sub.disabled = true; }
  const resultEl = document.getElementById('quiz-result');
  if (resultEl) resultEl.style.display = 'none';
  document.getElementById('book-content').scrollTop = 0;
}

// ── Book 2 (De la Semilla al Árbol) ──────────────────────────────────────────
const BOOK2_CHAPTERS = ['s2-nota','s2-1','s2-2','s2-3','s2-4','s2-5','s2-6','s2-7','s2-8','s2-9','s2-10','s2-11','s2-recursos','s2-conclusion'];
window._book2ReadChapters = window._book2ReadChapters || new Set();
let currentChapter2 = 's2-nota';

function showBook2() {
  showScreen('book-screen-2');
  const startChapter = window._book2LastChapter || 's2-nota';
  goToChapter2(startChapter);
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
  window._book2LastChapter = id;
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({ 'bookProgress.semilla': id }).catch(() => {});
  }
  const nav = document.getElementById('book-nav-2');
  if (nav) nav.classList.remove('open');
  const bd = document.getElementById('book-backdrop-2');
  if (bd) bd.style.display = 'none';
}

function markChapter2Read(id) {
  if (!BOOK2_CHAPTERS.includes(id)) return;
  if (window._book2ReadChapters.has(id)) return;
  window._book2ReadChapters.add(id);
  const tocEl = document.querySelector('#book-screen-2 [data-ch="' + id + '"]');
  if (tocEl) tocEl.classList.add('read');
  updateBook2ReadProgress();
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({
      'bookProgress.semilla-read': Array.from(window._book2ReadChapters)
    }).catch(() => {});
  }
}

function updateBook2ReadProgress() {
  const total = BOOK2_CHAPTERS.length;
  const done = BOOK2_CHAPTERS.filter(c => window._book2ReadChapters.has(c)).length;
  const pct = Math.round((done / total) * 100);
  const fill = document.getElementById('book2-read-bar-fill');
  const lbl = document.getElementById('book2-read-label');
  if (fill) fill.style.width = pct + '%';
  if (lbl) lbl.textContent = done + ' / ' + total + ' capítulos leídos';
}

function loadBook2ReadChapters(arr) {
  window._book2ReadChapters = new Set(arr || []);
  BOOK2_CHAPTERS.forEach(id => {
    if (window._book2ReadChapters.has(id)) {
      const tocEl = document.querySelector('#book-screen-2 [data-ch="' + id + '"]');
      if (tocEl) tocEl.classList.add('read');
    }
  });
  updateBook2ReadProgress();
}

function updateBookAccess2(books) {
  const btn = document.getElementById('btn-semilla');
  const progressWrap = document.getElementById('book2-progress');
  if (!btn) return;
  if (books.includes('semilla')) {
    btn.innerHTML = ICON.book + 'Leer libro';
    btn.className = 'ui-btn ui-btn--block btn-book is-active is-green';
    btn.disabled = false;
    btn.onclick = function() { showBook2(); };
    if (progressWrap) progressWrap.style.display = 'block';
    updateBook2ReadProgress();
  } else {
    btn.innerHTML = ICON.lock + 'Sin acceso';
    btn.className = 'ui-btn ui-btn--block btn-book is-locked';
    btn.disabled = true;
    btn.onclick = null;
    if (progressWrap) progressWrap.style.display = 'none';
  }
}

// ── Admin panel ───────────────────────────────────────────────────────────────
let allAdminUsers = [];

// Escapa texto que viene de los usuarios antes de insertarlo como HTML
function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function adminMessage(text, isError) {
  document.getElementById('admin-user-list').innerHTML =
    '<div class="admin-empty' + (isError ? ' is-error' : '') + '">' + escapeHtml(text) + '</div>';
}

function loadAdminData() {
  loadCupos();
  if (!db) { adminMessage('Firestore no disponible en modo demo.', true); return; }
  adminMessage('Cargando usuarios…');
  db.collection('users').orderBy('lastLogin', 'desc').get()
    .then(snapshot => {
      allAdminUsers = [];
      snapshot.forEach(doc => allAdminUsers.push({ uid: doc.id, ...doc.data() }));
      renderAdminStats();
      refreshAdminList();
    })
    .catch(err => adminMessage('Error cargando usuarios: ' + err.message, true));
}

function renderAdminStats() {
  const now = Date.now();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('admin-stat-total', allAdminUsers.length);
  set('admin-stat-active', allAdminUsers.filter(u => u.courses && u.courses.length > 0).length);
  set('admin-stat-completed', allAdminUsers.filter(u => u.completedCourses && u.completedCourses.includes('web-dev')).length);
  set('admin-stat-paid', allAdminUsers.filter(u => u.payments && u.payments['web-dev']).length);
  set('admin-stat-inactive', allAdminUsers.filter(u => {
    const t = u.lastActivity || u.lastLogin;
    return t && (now - t.seconds * 1000) / 86400000 >= 7;
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

function renderAdminUsers(users) {
  const list = document.getElementById('admin-user-list');
  if (!users.length) { list.innerHTML = '<div class="admin-empty">No se encontraron usuarios.</div>'; return; }
  list.innerHTML = users.map(u => {
    const uid = String(u.uid).replace(/[^A-Za-z0-9_-]/g, '');
    const courses  = u.courses || [];
    const books    = u.books || [];
    const initial  = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
    const date     = u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const webActive = courses.includes('web-dev');
    const webPaid = !!(u.payments && u.payments['web-dev']);
    const webProgress = (u.progress && u.progress['web-dev']) || 0;
    const webCompleted = !!(u.completedCourses && u.completedCourses.includes('web-dev'));
    const has7 = books.includes('7st'), hasSem = books.includes('semilla');
    return '<div class="admin-user-card" id="auc-' + uid + '">' +
      '<div class="admin-user-avatar">' + escapeHtml(initial) + '</div>' +
      '<div class="admin-user-info">' +
        '<div class="admin-user-name">' + escapeHtml(u.name || '—') + '</div>' +
        '<div class="admin-user-email">' + escapeHtml(u.email || '—') + '</div>' +
        '<div class="admin-user-phone">' + escapeHtml(u.phone || 'Sin teléfono') + ' · Último acceso: ' + escapeHtml(date) + '</div>' +
        '<div class="admin-user-prog"><div class="admin-user-prog-label"><span>Web Dev</span><span>' + webProgress + ' / 16' + (webCompleted ? ' · completado' : '') + '</span></div>' +
        '<div class="admin-user-prog-bar"><span class="' + (webCompleted ? 'is-done' : '') + '" style="width:' + Math.min(100, Math.round(webProgress / 16 * 100)) + '%"></span></div></div>' +
      '</div>' +
      '<div class="admin-course-toggles">' +
        adminToggle('Web Dev', { cls: webActive ? 'active' : '', on: webActive, action: "toggleCourse('" + uid + "','web-dev'," + webActive + ")", title: webActive ? 'Quitar acceso a Desarrollo Web' : 'Dar acceso a Desarrollo Web' }) +
        adminToggle(webPaid ? 'Pagó Web Dev' : 'Pago pendiente', { cls: webPaid ? 'paid' : 'unpaid', on: webPaid, action: "togglePaid('" + uid + "','web-dev'," + webPaid + ")", title: webPaid ? 'Marcar como pendiente' : 'Marcar como pagado' }) +
        adminToggle('7ST', { cls: has7 ? 'active' : '', on: has7, action: "toggleBook('" + uid + "','7st'," + has7 + ")", title: has7 ? 'Quitar libro 7ST' : 'Dar acceso al libro 7ST' }) +
        adminToggle('Semilla', { cls: hasSem ? 'active is-green' : '', on: hasSem, action: "toggleBook('" + uid + "','semilla'," + hasSem + ")", title: hasSem ? 'Quitar De la semilla al árbol' : 'Dar acceso a De la semilla al árbol' }) +
        adminToggle('IA', { disabled: true, title: 'Próximamente' }) +
        adminToggle('Marketing', { disabled: true, title: 'Próximamente' }) +
      '</div>' +
    '</div>';
  }).join('');
}

function updateAdminUser(uid, update, mutate) {
  if (!db) return;
  const u = allAdminUsers.find(x => x.uid === uid);
  const backup = u ? JSON.parse(JSON.stringify(u)) : null;
  if (u) mutate(u);
  renderAdminStats(); refreshAdminList();
  db.collection('users').doc(uid).update(update)
    .then(() => toast('Cambios guardados'))
    .catch(err => {
      if (u && backup) Object.assign(u, backup);
      renderAdminStats(); refreshAdminList();
      toast('No se pudo guardar: ' + err.message);
    });
}

function toggleCourse(uid, courseId, hasAccess) {
  const FV = firebase.firestore.FieldValue;
  updateAdminUser(uid, { courses: hasAccess ? FV.arrayRemove(courseId) : FV.arrayUnion(courseId) }, u => {
    u.courses = (u.courses || []).filter(c => c !== courseId);
    if (!hasAccess) u.courses.push(courseId);
  });
}

function toggleBook(uid, bookId, hasAccess) {
  const FV = firebase.firestore.FieldValue;
  updateAdminUser(uid, { books: hasAccess ? FV.arrayRemove(bookId) : FV.arrayUnion(bookId) }, u => {
    u.books = (u.books || []).filter(b => b !== bookId);
    if (!hasAccess) u.books.push(bookId);
  });
}

function togglePaid(uid, courseId, isPaid) {
  updateAdminUser(uid, { ['payments.' + courseId]: !isPaid }, u => {
    u.payments = u.payments || {};
    u.payments[courseId] = !isPaid;
  });
}

function filterAdminUsers(q) {
  const lq = (q || '').toLowerCase().trim();
  const filtered = lq
    ? allAdminUsers.filter(u => (u.email||'').toLowerCase().includes(lq) || (u.name||'').toLowerCase().includes(lq))
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
  const headers = ['Nombre', 'Email', 'Teléfono', 'Cursos', 'Libros', 'Pagó Web Dev', 'Progreso Web Dev', 'Fecha registro'];
  const rows = allAdminUsers.map(u => [
    u.name, u.email, u.phone, (u.courses || []).join(', '), (u.books || []).join(', '),
    (u.payments && u.payments['web-dev']) ? 'Sí' : 'No',
    ((u.progress && u.progress['web-dev']) || 0) + '/16',
    u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('es') : ''
  ].map(cell));
  const csv = [headers.map(cell).join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dgp-academy-usuarios.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadCupos() {
  if (!db) return;
  db.collection('config').doc('cupos').get().then(doc => {
    const n = doc.exists ? (doc.data().disponibles ?? 20) : 20;
    const input = document.getElementById('admin-cupos-input');
    if (input) input.value = n;
    updateLpCupos(n);
  }).catch(() => {});
}

function updateLpCupos(n) {
  const lpNum = document.getElementById('lp-cupos-num');
  if (lpNum) lpNum.textContent = n;
  const bar = document.getElementById('lp-cupos-bar');
  if (bar) bar.style.width = Math.max(0, Math.min(100, n / 20 * 100)) + '%';
  const wrap = document.getElementById('lp-cupos-wrap');
  if (wrap) wrap.classList.toggle('is-low', n <= 5);
}

function saveCupos() {
  if (!db) return;
  const val = parseInt(document.getElementById('admin-cupos-input').value) || 0;
  db.collection('config').doc('cupos').set({ disponibles: val }).then(() => {
    const msg = document.getElementById('admin-cupos-msg');
    if (msg) { msg.textContent = 'Guardado'; setTimeout(() => msg.textContent = '', 2000); }
    updateLpCupos(val);
  }).catch(err => toast('Error: ' + err.message));
}

// ── UI de usuario ─────────────────────────────────────────────────────────────
function fillUserUI(user) {
  const name    = user.displayName || user.email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('dash-avatar').textContent       = initial;
  document.getElementById('dash-username').textContent     = name;
  document.getElementById('dash-useremail').textContent    = user.email;
  document.getElementById('dash-welcome-name').textContent = name.split(' ')[0];
  const h = new Date().getHours();
  const g = document.getElementById('dash-greeting');
  if (g) g.textContent = h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
}

// ── Tabs login / registro ──────────────────────────────────────────────────────
let authMode = 'login';
function switchTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&mode==='login')||(i===1&&mode==='register')));
  document.getElementById('field-name').style.display    = mode==='register' ? 'flex'  : 'none';
  document.getElementById('field-phone').style.display   = mode==='register' ? 'block' : 'none';
  document.getElementById('forgot-link').style.display   = mode==='login'    ? 'block' : 'none';
  document.getElementById('auth-title').textContent      = mode==='login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta';
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

function handleAuth(e) {
  e.preventDefault();
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const name     = document.getElementById('input-name').value.trim();
  const apellido = document.getElementById('input-apellido')?.value.trim() || '';
  const phone    = document.getElementById('input-phone')?.value.trim() || '';
  const fullName = authMode === 'register' ? `${name} ${apellido}`.trim() : name;

  if (authMode === 'register' && !passwordValid(password)) {
    showAuthError('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y un carácter especial.');
    return;
  }

  setAuthLoading(true);
  showAuthError('');

  if (!firebaseReady) {
    // Modo demo sin Firebase configurado
    setTimeout(() => {
      setAuthLoading(false);
      fillUserUI({ displayName: fullName || 'Usuario Demo', email });
      showDashboard();
    }, 900);
    return;
  }

  if (authMode === 'login') {
    auth.signInWithEmailAndPassword(email, password)
      .then(cred => {
        if (db) db.collection('users').doc(cred.user.uid).update({ lastActivity: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        fillUserUI(cred.user); showDashboard();
      })
      .catch(err => { setAuthLoading(false); showAuthError(mapAuthError(err.code)); });
  } else {
    auth.createUserWithEmailAndPassword(email, password)
      .then(cred => {
        const user = cred.user;
        return user.updateProfile({ displayName: fullName }).then(() => {
          if (db) {
            db.collection('users').doc(user.uid).set({
              email: user.email,
              name: fullName,
              phone: phone,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
          // Notificación al admin via Formspree
          fetch('https://formspree.io/f/xpqnajzo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              _subject: 'Nuevo registro — DGP Academy',
              Nombre: fullName,
              Email: user.email,
              Telefono: phone || 'No proporcionado',
              Fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
              UID: user.uid
            })
          }).catch(() => {});
          // Email de bienvenida al nuevo estudiante via EmailJS
          // Requiere: crear cuenta en emailjs.com, configurar template y reemplazar IDs abajo
          if (window.emailjs && typeof emailjs.send === 'function') {
            emailjs.send('service_o1k4wpe', 'template_3sbztj9', {
              to_name:  fullName,
              to_email: user.email,
              reply_to: 'hola@dgpglobalgroup.com'
            }).catch(() => {});
          }
          fillUserUI({ ...user, displayName: fullName });
          showDashboard();
        });
      })
      .catch(err => { setAuthLoading(false); showAuthError(mapAuthError(err.code)); });
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

function mapAuthError(code) {
  const map = {
    'auth/user-not-found':    'No existe una cuenta con ese correo.',
    'auth/wrong-password':    'Contraseña incorrecta.',
    'auth/invalid-email':     'El correo no es válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password':     'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/invalid-credential':'Correo o contraseña incorrectos.',
  };
  return map[code] || 'Error al iniciar sesión. Intenta de nuevo.';
}

function forgotPassword() {
  const email = document.getElementById('input-email').value.trim();
  if (!email) { showAuthError('Escribe tu correo primero para recuperar la contraseña.'); return; }
  if (!firebaseReady) { showAuthError('Firebase no configurado.'); return; }
  auth.sendPasswordResetEmail(email)
    .then(() => showAuthError('✓ Revisa tu correo para restablecer la contraseña.'))
    .catch(() => showAuthError('No se pudo enviar el correo. Verifica la dirección.'));
}

// ── Sign out ──────────────────────────────────────────────────────────────────
function signOut() {
  window._userDoc = null;
  if (firebaseReady) auth.signOut().then(showLanding);
  else showLanding();
}

// ── Entrar al curso ────────────────────────────────────────────────────────────
function enterCourse() {
  showCourse();
  updateProgress();
}

// ── Stats del dashboard ────────────────────────────────────────────────────────
const LESSON_TITLES = {
  home:'Bienvenida al curso', l1:'¿Cómo funciona la web?', l2:'HTML desde cero', l3:'CSS — estilo y diseño',
  l4:'JavaScript — interactividad', l5:'GitHub y control de versiones', l6:'IA: Claude y Gemini Pro',
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
  updateCourseBtn(done);
  renderCertificates();
}

function continueCourse() {
  if (!hasWebAccess) {
    const box = document.getElementById('dash-activate');
    if (box) { box.style.display = 'grid'; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return;
  }
  const n = completed.filter(l => l !== 'home').length;
  if (n >= 16) { openCertificate('web-dev'); return; }
  enterCourse();
  goTo(n === 0 ? 'home' : nextLessonId());
}

function updateCourseBtn(done) {
  const btn = document.getElementById('btn-web-dev');
  if (!btn || btn.disabled) return;
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
