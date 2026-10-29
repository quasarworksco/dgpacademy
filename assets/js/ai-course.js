// =========================================================
// Programa "IA aplicada a los negocios": visor de lecciones
// El índice es público; el contenido de cada lección es protegido (tabla content, producto "ia").
// =========================================================
const AI_COURSE = {"modules": [{"es": "Fundamentos de la IA", "en": "AI fundamentals"}, {"es": "Productividad y ventas con IA", "en": "Productivity and sales with AI"}, {"es": "Vibe coding: crea tus propios sistemas", "en": "Vibe coding: build your own systems"}, {"es": "Automatización y datos", "en": "Automation and data"}, {"es": "Gana dinero con IA", "en": "Make money with AI"}], "lessons": [{"id": "ai0", "mod": null, "title": {"es": "Empieza aquí: cómo funciona el curso", "en": "Start here: how the course works"}, "min": 5}, {"id": "ai1", "mod": 0, "title": {"es": "Qué es la IA y qué puede hacer por tu negocio", "en": "What AI is and what it can do for your business"}, "min": 12}, {"id": "ai2", "mod": 0, "title": {"es": "Las herramientas de IA que necesitas", "en": "The AI tools you need"}, "min": 12}, {"id": "ai3", "mod": 0, "title": {"es": "El arte del prompt: cómo pedirle a la IA", "en": "The art of prompting: how to ask AI"}, "min": 15}, {"id": "ai4", "mod": 1, "title": {"es": "Productividad: correo, agenda, reuniones y documentos", "en": "Productivity: email, calendar, meetings and documents"}, "min": 18}, {"id": "ai5", "mod": 1, "title": {"es": "Contenido e imágenes para redes con IA", "en": "Social media content and images with AI"}, "min": 20}, {"id": "ai6", "mod": 1, "title": {"es": "Vende más: atención al cliente y textos que venden", "en": "Sell more: customer service and copy that sells"}, "min": 20}, {"id": "ai7", "mod": 2, "title": {"es": "Vibe coding: crea software hablando con la IA", "en": "Vibe coding: build software by talking to AI"}, "min": 15}, {"id": "ai8", "mod": 2, "title": {"es": "Tu primera app con IA, paso a paso", "en": "Your first AI-built app, step by step"}, "min": 18}, {"id": "ai9", "mod": 2, "title": {"es": "Sistemas a medida: CRM, citas e inventario con IA", "en": "Custom systems: CRM, bookings and inventory with AI"}, "min": 16}, {"id": "ai10", "mod": 2, "title": {"es": "Chatbots y agentes de IA con la información de tu negocio", "en": "AI chatbots and agents with your business information"}, "min": 15}, {"id": "ai11", "mod": 3, "title": {"es": "Automatiza tareas sin programar", "en": "Automate tasks without coding"}, "min": 14}, {"id": "ai12", "mod": 3, "title": {"es": "Analiza tus datos y decide mejor", "en": "Analyze your data and decide better"}, "min": 14}, {"id": "ai13", "mod": 3, "title": {"es": "Procesos (SOPs): la base para automatizar tu empresa", "en": "Processes (SOPs): the foundation for automating your company"}, "min": 12}, {"id": "ai14", "mod": 4, "title": {"es": "Cómo generar dinero con IA: 7 modelos de negocio", "en": "How to make money with AI: 7 business models"}, "min": 16}, {"id": "ai15", "mod": 4, "title": {"es": "Consigue clientes y ponle precio a tus servicios de IA", "en": "Land clients and price your AI services"}, "min": 16}, {"id": "ai16", "mod": 4, "title": {"es": "Proyecto final: uso responsable y tu plan de lanzamiento", "en": "Final project: responsible use and your launch plan"}, "min": 15}]};
const AI_LESSONS = AI_COURSE.lessons.map(l => l.id);
const AI_COUNTED = AI_LESSONS.filter(id => id !== 'ai0');
let currentAI = 'ai0';

function aiTitle(l) { return LANG === 'en' ? l.title.en : l.title.es; }

// Crea la pantalla una sola vez (mismo diseño que los libros, con índice por módulos)
function ensureAIScreen() {
  if (document.getElementById('ai-screen')) return;
  const toc = AI_COURSE.modules.map((m, mi) => {
    const items = AI_COURSE.lessons.filter(l => l.mod === mi);
    return '<div class="ai-toc-mod">' + escapeHtml(t('Módulo') + ' ' + (mi + 1)) + ' · ' + escapeHtml(LANG === 'en' ? m.en : m.es) + '</div>' +
      items.map(l => '<div class="book-toc-item" data-ch="' + l.id + '" onclick="goToAI(\'' + l.id + '\')"><span>' + (AI_LESSONS.indexOf(l.id)) + ' · ' + escapeHtml(aiTitle(l)) + '</span></div>').join('');
  }).join('');
  const el = document.createElement('div');
  el.id = 'ai-screen'; el.style.display = 'none';
  el.innerHTML =
    '<div id="ai-backdrop" onclick="toggleAINav()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:399;"></div>' +
    '<div style="display:flex;height:100vh;overflow:hidden;">' +
      '<nav class="book-nav" id="ai-nav">' +
        '<div class="book-nav-header"><button onclick="closeAICourse()" class="book-back-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' + escapeHtml(t('Mis cursos')) + '</button>' +
          '<div class="ai-nav-brand"><div class="ai-nav-kicker">DGP Academy · ' + escapeHtml(t('Programa')) + '</div><div class="ai-nav-title">' + escapeHtml(t('IA aplicada a los negocios')) + '</div>' +
          '<div class="ai-nav-prog"><div class="ai-nav-bar"><span id="ai-prog-fill"></span></div><small id="ai-prog-text">0 / 16</small></div></div></div>' +
        '<div class="book-toc">' + '<div class="book-toc-item" data-ch="ai0" onclick="goToAI(\'ai0\')"><span>' + escapeHtml(aiTitle(AI_COURSE.lessons[0])) + '</span></div>' + toc + '</div>' +
      '</nav>' +
      '<main class="book-main" id="ai-main">' +
        '<div class="book-topbar"><button class="book-menu-btn" onclick="toggleAINav()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>' +
          '<span class="book-topbar-title" id="ai-label"></span><span data-lang-slot="lang-switch--sm book-lang"></span></div>' +
        '<div class="book-content" id="ai-content">' + AI_LESSONS.map(id => '<section class="book-chapter" id="' + id + '"></section>').join('') + '</div>' +
      '</main>' +
    '</div>';
  document.body.appendChild(el);
  if (!SCREENS.includes('ai-screen')) SCREENS.push('ai-screen');
  el.querySelectorAll('[data-lang-slot]').forEach(x => { x.outerHTML = langSwitchHTML(x.getAttribute('data-lang-slot')); });
  el.querySelectorAll('.lang-switch button').forEach(b => { b.classList.toggle('is-on', b.dataset.lang === LANG); b.setAttribute('aria-pressed', b.dataset.lang === LANG); });
  delete _contentLoaded['ia'];
  if (typeof initReaderUX === 'function') initReaderUX();
}

function showAICourse() {
  ensureAIScreen();
  openProtected('ia', '#ai-screen', () => {
    showScreen('ai-screen');
    goToAI((STATE.reading['ia'] && STATE.reading['ia'].last_item) || 'ai0');
    updateAIProgress();
  });
}
function closeAICourse() { const s = document.getElementById('ai-screen'); if (s) s.style.display = 'none'; showDashboard(); }
function toggleAINav() {
  const nav = document.getElementById('ai-nav'); if (!nav) return;
  nav.classList.toggle('open');
  document.getElementById('ai-backdrop').style.display = nav.classList.contains('open') ? 'block' : 'none';
}

function goToAI(id) {
  if (!AI_LESSONS.includes(id)) id = 'ai0';
  document.querySelectorAll('#ai-screen .book-chapter').forEach(el => el.classList.toggle('active', el.id === id));
  document.querySelectorAll('#ai-screen .book-toc-item').forEach(el => el.classList.toggle('active', el.dataset.ch === id));
  const c = document.getElementById('ai-content'); if (c) c.scrollTop = 0;
  const l = AI_COURSE.lessons.find(x => x.id === id);
  const idx = AI_LESSONS.indexOf(id);
  document.getElementById('ai-label').textContent = idx ? t('Lección') + ' ' + idx + ' · ' + aiTitle(l) : aiTitle(l);
  currentAI = id;
  savePosition('ia', id);
  const nav = document.getElementById('ai-nav'); if (nav) nav.classList.remove('open');
  const bd = document.getElementById('ai-backdrop'); if (bd) bd.style.display = 'none';
}

function aiComplete(cur, next) {
  if (cur !== 'ai0' && !readSet('ia').has(cur)) saveProgress('ia', cur);
  updateAIProgress();
  goToAI(next);
}
async function aiFinish() {
  if (!readSet('ia').has('ai16')) saveProgress('ia', 'ai16');
  updateAIProgress();
  const missing = AI_COUNTED.filter(id => !readSet('ia').has(id));
  if (missing.length) { toast(t('Te faltan lecciones por completar:') + ' ' + missing.map(id => AI_LESSONS.indexOf(id)).join(', ')); goToAI(missing[0]); return; }
  await new Promise(r => setTimeout(r, 800));
  await openCertificate('ia');
  updateAIAccess();
  if (typeof renderBadges === 'function') renderBadges();
}

// Terminado: las 16 lecciones completadas o el certificado ya emitido
function aiCourseDone() {
  return AI_COUNTED.every(id => readSet('ia').has(id)) || !!(STATE.certificates && STATE.certificates['ia']);
}

function updateAIProgress() {
  const done = AI_COUNTED.filter(id => readSet('ia').has(id)).length;
  const pct = Math.round(done / AI_COUNTED.length * 100);
  const f = document.getElementById('ai-prog-fill'); if (f) f.style.width = pct + '%';
  const tx = document.getElementById('ai-prog-text'); if (tx) tx.textContent = done + ' / ' + AI_COUNTED.length;
  document.querySelectorAll('#ai-screen .book-toc-item').forEach(el => el.classList.toggle('read', readSet('ia').has(el.dataset.ch)));
  // Tarjeta del programa en el panel
  // Al completar el programa la barra pasa a verde, igual que en Desarrollo Web
  const bar = document.getElementById('ia-prog-fill'); if (bar) { bar.style.width = pct + '%'; bar.style.background = aiCourseDone() ? 'var(--green)' : ''; }
  const lbl = document.getElementById('ia-prog-text'); if (lbl) lbl.textContent = done + ' / ' + AI_COUNTED.length;
  const pc = document.getElementById('ia-prog-pct'); if (pc) pc.textContent = pct + '%';
}

// Botón del programa en el panel según el acceso
function updateAIAccess() {
  const btn = document.getElementById('btn-ia');
  if (!btn) return;
  const status = document.getElementById('ia-status');
  const prog = document.getElementById('ia-progress');
  if (hasAccess('ia') && aiCourseDone()) {
    // Programa terminado: se marca como completado y el botón abre el certificado
    btn.innerHTML = '<svg><use href="#i-award"/></svg>' + escapeHtml(t('Completado · Ver certificado'));
    btn.className = 'ui-btn ui-btn--block btn-course is-done';
    btn.disabled = false; btn.onclick = () => openCertificate('ia');
    if (status) { status.textContent = t('Completado'); status.className = 'chip chip--green course-status'; }
    if (prog) prog.hidden = false;
  } else if (hasAccess('ia')) {
    const started = readSet('ia').size > 0;
    btn.innerHTML = '<svg><use href="#i-play"/></svg>' + escapeHtml(t(started ? 'Continuar' : 'Empezar el programa'));
    btn.className = 'ui-btn ui-btn--block btn-course is-active';
    btn.disabled = false; btn.onclick = showAICourse;
    if (status) { status.textContent = t('Activo'); status.className = 'chip chip--green course-status'; }
    if (prog) prog.hidden = false;
  } else {
    btn.innerHTML = '<svg><use href="#i-lock"/></svg>' + escapeHtml(t('Desbloquear programa')) + priceTag('ia');
    btn.className = 'ui-btn ui-btn--block btn-course is-buy';
    btn.disabled = false; btn.onclick = () => openCheckout('ia');
    if (status) { status.textContent = t('Disponible'); status.className = 'chip chip--light course-status'; }
    if (prog) prog.hidden = true;
  }
  updateAIProgress();
}

// Copia un prompt al portapapeles
function copyPrompt(btn) {
  const txt = btn.closest('.ai-prompt').querySelector('.ai-prompt-text').textContent;
  const done = () => { const o = btn.textContent; btn.textContent = t('¡Copiado!'); btn.classList.add('is-done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('is-done'); }, 1600); };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => {});
  else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
}

// Al cambiar de idioma se rehace el índice y se recarga la lección abierta
function aiOnLangChange() {
  const el = document.getElementById('ai-screen');
  if (!el) return;
  const visible = el.style.display === 'block';
  el.remove();
  if (visible) { ensureAIScreen(); loadContent('ia', '#ai-screen').then(() => { showScreen('ai-screen'); goToAI(currentAI); updateAIProgress(); }).catch(() => {}); }
}
