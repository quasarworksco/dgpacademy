// =========================================================
// Asistente IA flotante del campus (panel, programas y libros)
// Usa el mismo historial y cupo mensual que el Coach IA (función "coach", acción chat).
// =========================================================
const ASSIST_SCREENS = ['dash-screen', 'course-screen', 'book-screen', 'book-screen-2', 'ai-screen'];

function ensureAssistant() {
  if (document.getElementById('asst')) return;
  const el = document.createElement('div');
  el.id = 'asst';
  el.innerHTML =
    '<button type="button" class="asst-fab" id="asst-fab" onclick="toggleAssistant()" aria-label="' + escapeHtml(t('Asistente IA')) + '">' +
      '<span class="asst-fab-ic">' + icon('spark') + '</span><span class="asst-fab-label">' + escapeHtml(t('Asistente IA')) + '</span></button>' +
    '<section class="asst-panel" id="asst-panel" hidden role="dialog" aria-label="' + escapeHtml(t('Asistente IA')) + '">' +
      '<header class="asst-head"><span class="asst-head-ic">' + icon('spark') + '</span><div><b>' + escapeHtml(t('Asistente IA de DGP')) + '</b><small id="asst-quota"></small></div>' +
        '<button type="button" class="icon-btn" onclick="toggleAssistant(false)" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button></header>' +
      '<div class="asst-log" id="asst-log"></div>' +
      '<div class="asst-ideas" id="asst-ideas"></div>' +
      '<form class="asst-form" onsubmit="event.preventDefault();assistantSend()">' +
        '<textarea id="asst-input" rows="1" maxlength="2000" placeholder="' + escapeHtml(t('Pregunta lo que quieras…')) + '" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();assistantSend()}" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,120)+\'px\'"></textarea>' +
        '<button class="asst-send" id="asst-send" aria-label="' + escapeHtml(t('Enviar')) + '"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
      '</form>' +
    '</section>';
  document.body.appendChild(el);
}

// Se muestra solo dentro del campus y con sesión iniciada
function syncAssistant() {
  ensureAssistant();
  const on = !!STATE.user && ASSIST_SCREENS.some(id => { const s = document.getElementById(id); return s && s.style.display && s.style.display !== 'none'; });
  document.getElementById('asst').hidden = !on;
  if (!on) toggleAssistant(false);
}

function assistantContext() {
  const vis = id => { const s = document.getElementById(id); return s && s.style.display === 'block'; };
  if (vis('ai-screen') && typeof currentAI !== 'undefined') {
    const l = AI_COURSE.lessons.find(x => x.id === currentAI);
    return 'Programa IA aplicada a los negocios — ' + (l ? l.title.es : '');
  }
  if (vis('course-screen') && typeof current !== 'undefined') return 'Programa de Desarrollo Web con IA — lección ' + current;
  if (vis('book-screen')) return 'Libro 7ST — ' + (document.getElementById('book-chapter-label') || {}).textContent;
  if (vis('book-screen-2')) return 'Libro De la semilla al árbol — ' + (document.getElementById('book-chapter-label-2') || {}).textContent;
  return '';
}

function renderAssistant() {
  const log = document.getElementById('asst-log');
  if (!log) return;
  const q = MEMBER.quota || { used: 0, limit: 0 };
  document.getElementById('asst-quota').textContent = Math.max(0, q.limit - q.used) + ' ' + t('de') + ' ' + q.limit + ' ' + t('consultas disponibles este mes');
  const hello = { role: 'assistant', content: t('¡Hola! Soy tu asistente de IA. Pregúntame sobre tus lecciones, cómo aplicar la IA en tu negocio, ideas para ganar dinero con IA o cómo construir tu primer sistema con vibe coding.') };
  const msgs = MEMBER.chat.length ? MEMBER.chat.slice(-12) : [hello];
  log.innerHTML = msgs.map(m => '<div class="mb-msg is-' + m.role + '">' + coachFormat(m.content) + '</div>').join('');
  const ideas = LANG === 'en'
    ? ['Explain this lesson with a simple example', 'Give me 3 AI business ideas for beginners', 'How do I start my first app with vibe coding?']
    : ['Explícame esta lección con un ejemplo sencillo', 'Dame 3 ideas de negocio con IA para empezar', '¿Cómo empiezo mi primera app con vibe coding?'];
  document.getElementById('asst-ideas').innerHTML = MEMBER.chat.length ? '' : ideas.map(i => '<button type="button" onclick="assistantSend(this.textContent)">' + escapeHtml(i) + '</button>').join('');
  document.getElementById('asst-send').disabled = q.limit > 0 && q.used >= q.limit;
  log.scrollTop = log.scrollHeight;
}

function toggleAssistant(force) {
  const p = document.getElementById('asst-panel');
  if (!p) return;
  const open = force === undefined ? p.hidden : !!force;
  p.hidden = !open;
  document.getElementById('asst-fab').classList.toggle('is-open', open);
  if (open) { renderAssistant(); setTimeout(() => { const i = document.getElementById('asst-input'); if (i && innerWidth > 640) i.focus(); }, 50); }
}

// Desde las lecciones: abre el asistente con la pregunta lista
function askAssistant(question) {
  if (!STATE.user) return;
  ensureAssistant(); syncAssistant();
  toggleAssistant(true);
  assistantSend(question);
}

async function assistantSend(preset) {
  const input = document.getElementById('asst-input');
  const text = String(preset || input.value).trim();
  if (text.length < 2) return;
  const log = document.getElementById('asst-log'), btn = document.getElementById('asst-send');
  input.value = ''; input.style.height = 'auto'; btn.disabled = true;
  document.getElementById('asst-ideas').innerHTML = '';
  if (!MEMBER.chat.length) log.innerHTML = '';
  log.insertAdjacentHTML('beforeend', '<div class="mb-msg is-user">' + coachFormat(text) + '</div><div class="mb-msg is-assistant is-typing"><span></span><span></span><span></span></div>');
  log.scrollTop = log.scrollHeight;
  try {
    const { data, error } = await sb.functions.invoke('coach', { body: { action: 'chat', message: text, lang: LANG, context: assistantContext() } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j.error) m = j.error; } catch (x) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    MEMBER.chat.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply });
    if (MEMBER.quota) MEMBER.quota.used++;
    const typing = log.querySelector('.is-typing');
    typing.outerHTML = '<div class="mb-msg is-assistant" id="asst-last">' + coachFormat(data.reply) + '</div>';
    const last = document.getElementById('asst-last'); last.removeAttribute('id');
    log.scrollTop = Math.max(0, last.offsetTop - log.offsetTop - 60);
  } catch (e) {
    log.querySelector('.is-typing').outerHTML = '<div class="mb-msg is-error">' + escapeHtml(t(friendlyPayError(e))) + '</div>';
    log.scrollTop = log.scrollHeight;
  } finally {
    const q = MEMBER.quota || { used: 0, limit: 0 };
    document.getElementById('asst-quota').textContent = Math.max(0, q.limit - q.used) + ' ' + t('de') + ' ' + q.limit + ' ' + t('consultas disponibles este mes');
    btn.disabled = q.limit > 0 && q.used >= q.limit;
  }
}

// Revisa la pantalla visible cada vez que cambia
document.addEventListener('DOMContentLoaded', () => {
  ensureAssistant();
  const obs = new MutationObserver(() => syncAssistant());
  ASSIST_SCREENS.concat(['landing-screen', 'auth-screen', 'admin-screen']).forEach(id => { const s = document.getElementById(id); if (s) obs.observe(s, { attributes: true, attributeFilter: ['style'] }); });
  syncAssistant();
  // La pantalla del programa de IA se crea después: también se observa
  new MutationObserver(() => { const s = document.getElementById('ai-screen'); if (s && !s.dataset.watched) { s.dataset.watched = '1'; obs.observe(s, { attributes: true, attributeFilter: ['style'] }); } }).observe(document.body, { childList: true });
});
