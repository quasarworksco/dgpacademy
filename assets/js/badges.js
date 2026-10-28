// =========================================================
// Logros: racha de estudio (días seguidos) e insignias por módulo, programa y hábito.
// Los días de estudio se guardan en el servidor (study_days, una fila por día);
// las insignias se calculan aquí con el avance que ya está cargado.
// =========================================================
const STUDY = { days: [], loaded: false, ex: 0, coach: 0, uid: null, at: 0 };

function localDay(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function loadStudyDays() {
  if (!STATE.user) return;
  const since = localDay(new Date(Date.now() - 120 * 864e5));
  const [days, ex] = await Promise.all([
    sb.from('study_days').select('day').eq('user_id', STATE.user.id).gte('day', since).order('day', { ascending: false }),
    sb.from('exercise_answers').select('feedback_at').eq('user_id', STATE.user.id)
  ]);
  STUDY.days = (days.data || []).map(r => r.day);
  STUDY.ex = (ex.data || []).length;
  STUDY.coach = (ex.data || []).filter(r => r.feedback_at).length;
  STUDY.loaded = true; STUDY.uid = STATE.user.id; STUDY.at = Date.now();
}

// Marca hoy como día de estudio (una vez al día por persona)
function recordStudy() {
  if (!STATE.user) return;
  const today = localDay(), key = 'dgp-study-' + STATE.user.id;
  let last = null;
  try { last = localStorage.getItem(key); } catch (e) {}
  if (last === today && STUDY.days.includes(today)) return;
  try { localStorage.setItem(key, today); } catch (e) {}
  if (!STUDY.days.includes(today)) STUDY.days.unshift(today);
  sb.rpc('touch_study_day', { local_day: today }).then(({ data, error }) => {
    if (error) { console.warn('racha', error.message); return; }
    if (Array.isArray(data)) STUDY.days = data.map(d => String(d).slice(0, 10)).sort().reverse();
  });
}

// Días seguidos hasta hoy (o hasta ayer, si hoy aún no estudió)
function computeStreak() {
  const set = new Set(STUDY.days);
  const d = new Date();
  if (!set.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestStreak() {
  const sorted = [...new Set(STUDY.days)].sort();
  let best = 0, run = 0, prev = null;
  sorted.forEach(s => {
    const cur = new Date(s + 'T12:00:00');
    run = prev && Math.round((cur - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = cur;
  });
  return best;
}

const BADGE_IC = {
  start: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  mod: '<path d="M12 2l3 6 6.5 1-4.7 4.6 1.1 6.4L12 17l-5.9 3 1.1-6.4L2.5 9 9 8z"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  fire: '<path d="M12 22c4 0 7-2.8 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4.2 3 7 7 7z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  spark: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>'
};

function badgeList() {
  const web = readSet('web-dev'), ia = readSet('ia');
  const webMods = [1, 2, 3, 4, 5].map(m => Object.keys(LESSON_MODULE).filter(id => LESSON_MODULE[id] === m));
  const iaMods = AI_COURSE.modules.map((_, mi) => AI_COURSE.lessons.filter(l => l.mod === mi).map(l => l.id));
  const all = (set, ids) => ids.length > 0 && ids.every(id => set.has(id));
  const anyLesson = web.size + ia.size + readSet('7st').size + readSet('semilla').size > 0;
  const streakBest = Math.max(bestStreak(), computeStreak());
  const list = [
    { id: 'first', ic: 'start', t: 'Primer paso', h: 'Completa tu primera lección o capítulo', ok: anyLesson, g: 'h' },
    { id: 'streak3', ic: 'fire', t: 'Racha de 3 días', h: 'Estudia 3 días seguidos', ok: streakBest >= 3, g: 'h' },
    { id: 'streak7', ic: 'fire', t: 'Semana imparable', h: 'Estudia 7 días seguidos', ok: streakBest >= 7, g: 'h' },
    { id: 'streak30', ic: 'fire', t: 'Hábito de campeón', h: 'Estudia 30 días seguidos', ok: streakBest >= 30, g: 'h' },
    { id: 'wb5', ic: 'pen', t: 'Manos a la obra', h: 'Responde 5 cuadernos de trabajo', ok: STUDY.ex >= 5, g: 'h' },
    { id: 'coach', ic: 'spark', t: 'Mentoría IA', h: 'Pide tu primer análisis al coach IA', ok: STUDY.coach >= 1, g: 'h' }
  ];
  if (hasAccess('web-dev') || web.size) {
    webMods.forEach((ids, i) => list.push({ id: 'web-m' + (i + 1), ic: 'mod', t: t('Web') + ' · ' + t('Módulo') + ' ' + (i + 1), h: 'Termina el módulo en Desarrollo Web', ok: all(web, ids), g: 'w', raw: true }));
    list.push({ id: 'web-all', ic: 'cap', t: 'Desarrollador web', h: 'Termina las 16 lecciones de Desarrollo Web', ok: all(web, Object.keys(LESSON_MODULE)), g: 'w' });
  }
  if (hasAccess('ia') || ia.size) {
    iaMods.forEach((ids, i) => list.push({ id: 'ia-m' + (i + 1), ic: 'mod', t: t('IA') + ' · ' + t('Módulo') + ' ' + (i + 1), h: LANG === 'en' ? AI_COURSE.modules[i].en : AI_COURSE.modules[i].es, ok: all(ia, ids), g: 'i', raw: true, rawH: true }));
    list.push({ id: 'ia-all', ic: 'cap', t: 'Emprendedor IA', h: 'Termina las 16 lecciones de IA aplicada a los negocios', ok: all(ia, AI_COUNTED), g: 'i' });
  }
  if (hasAccess('7st') || readSet('7st').size) list.push({ id: '7st', ic: 'book', t: 'Lector 7ST', h: 'Aprueba la evaluación final del libro 7ST', ok: !!STATE.certificates['7st'] || isEligible('7st'), g: 'b' });
  if (hasAccess('semilla') || readSet('semilla').size) list.push({ id: 'semilla', ic: 'book', t: 'De la semilla al árbol', h: 'Lee todos los capítulos del libro', ok: BOOK2_CHAPTERS.every(c => readSet('semilla').has(c)), g: 'b' });
  return list;
}

function renderBadges() {
  const root = document.getElementById('badges-root');
  if (!root || !STATE.user) return;
  // Se recarga al cambiar de cuenta o cada minuto (cuadernos y análisis nuevos)
  if (!STUDY.loaded || STUDY.uid !== STATE.user.id) { STUDY.loaded = false; STUDY.days = []; loadStudyDays().then(renderBadges).catch(() => {}); return; }
  if (Date.now() - STUDY.at > 60000) { STUDY.at = Date.now(); loadStudyDays().then(renderBadges).catch(() => {}); }
  const streak = computeStreak(), best = Math.max(bestStreak(), streak);
  const studiedToday = STUDY.days.includes(localDay());
  const set = new Set(STUDY.days);
  const dots = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = localDay(d);
    dots.push('<span class="st-dot' + (set.has(k) ? ' is-on' : '') + (i === 0 ? ' is-today' : '') + '" title="' + escapeHtml(d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' })) + '"><i>' + escapeHtml(d.toLocaleDateString(locale(), { weekday: 'narrow' })) + '</i></span>');
  }
  const list = badgeList();
  const earned = list.filter(b => b.ok).length;
  root.innerHTML =
    '<div class="ach">' +
      '<div class="st-card' + (streak ? ' is-hot' : '') + '">' +
        '<div class="st-flame"><svg viewBox="0 0 24 24">' + BADGE_IC.fire + '</svg></div>' +
        '<div class="st-main"><b class="st-num">' + streak + '</b><span>' + escapeHtml(t(streak === 1 ? 'día seguido estudiando' : 'días seguidos estudiando')) + '</span>' +
          '<small>' + escapeHtml(studiedToday ? t('¡Ya estudiaste hoy! Vuelve mañana para mantener tu racha.') : (streak ? t('Estudia hoy para no perder tu racha.') : t('Abre una lección hoy para empezar tu racha.'))) + '</small></div>' +
        '<div class="st-week">' + dots.join('') + '</div>' +
        '<div class="st-best">' + escapeHtml(t('Mejor racha')) + ': <b>' + best + '</b></div>' +
      '</div>' +
      '<div class="bd-wrap"><div class="bd-head"><b>' + earned + ' / ' + list.length + '</b> ' + escapeHtml(t('insignias ganadas')) + '</div>' +
        '<div class="bd-grid">' + list.map(b =>
          '<div class="bd' + (b.ok ? ' is-on' : '') + ' bd--' + b.g + '" title="' + escapeHtml(b.rawH ? b.h : t(b.h)) + '">' +
            '<span class="bd-ic"><svg viewBox="0 0 24 24">' + BADGE_IC[b.ic] + '</svg></span>' +
            '<b>' + escapeHtml(b.raw ? b.t : t(b.t)) + '</b><small>' + escapeHtml(b.ok ? t('¡Conseguida!') : (b.rawH ? b.h : t(b.h))) + '</small></div>').join('') +
        '</div></div>' +
    '</div>';
  announceNewBadges(list);
}

// Aviso cuando se gana una insignia nueva (se recuerdan las ya vistas en este navegador)
function announceNewBadges(list) {
  const key = 'dgp-badges-' + STATE.user.id;
  let seen = null;
  try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  const now = list.filter(b => b.ok).map(b => b.id);
  try { localStorage.setItem(key, JSON.stringify(now)); } catch (e) {}
  if (!seen) return; // primera vez en este navegador: no se anuncian las antiguas
  const fresh = list.filter(b => b.ok && !seen.includes(b.id));
  if (fresh.length) toast('🏅 ' + t('Nueva insignia') + ': ' + fresh.map(b => b.raw ? b.t : t(b.t)).join(', '));
}

// Cada lección abierta o completada cuenta como día de estudio
(function hookStudy() {
  const wrap = name => {
    const fn = window[name];
    if (typeof fn !== 'function') return;
    window[name] = function (product) {
      const r = fn.apply(this, arguments);
      if (STATE.user && (name === 'goTo' ? hasAccess('web-dev') : hasAccess(product))) recordStudy();
      return r;
    };
  };
  ['savePosition', 'saveProgress', 'goTo'].forEach(wrap);
})();
