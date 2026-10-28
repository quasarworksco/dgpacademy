// =========================================================
// Cuadernos de trabajo interactivos dentro de libros y cursos
//   .wb[data-ex]   → preguntas con respuesta escrita, autoguardado y análisis del coach IA
//   ul.checklist / ul.book-checklist → casillas que se guardan
// Las respuestas viven en exercise_answers (una fila por ejercicio).
// Las preguntas se guardan como "N. pregunta" para que la respuesta se conserve al cambiar de idioma.
// =========================================================
const _wbCache = {};   // product → { exercise_id: { answers, feedback } }
const _wbTimers = {};

async function loadExerciseAnswers(product) {
  if (_wbCache[product]) return _wbCache[product];
  const map = {};
  if (STATE.user) {
    const { data, error } = await sb.from('exercise_answers').select('exercise_id, answers, feedback')
      .eq('user_id', STATE.user.id).eq('product_id', product);
    if (error) console.warn('ejercicios', error.message);
    (data || []).forEach(r => { map[r.exercise_id] = { answers: r.answers || {}, feedback: r.feedback || '' }; });
  }
  _wbCache[product] = map;
  return map;
}
function clearExerciseCache() { Object.keys(_wbCache).forEach(k => delete _wbCache[k]); }

// Busca la respuesta por número de pregunta (sirve en ES y EN)
function wbAnswerFor(answers, n) {
  const k = Object.keys(answers || {}).find(x => x.split('.')[0].trim() === String(n));
  return k ? String(answers[k] ?? '') : '';
}

async function initWorkbooks(root, product) {
  const books = root.querySelectorAll('.wb[data-ex]');
  const lists = root.querySelectorAll('ul.checklist, ul.book-checklist');
  if (!books.length && !lists.length) return;
  const saved = await loadExerciseAnswers(product);
  books.forEach(wb => buildWorkbook(wb, product, saved[wb.dataset.ex]));
  lists.forEach((ul, i) => buildChecklist(ul, product, (root.id || 'x') + '-' + i, saved));
}

function buildWorkbook(wb, product, row) {
  if (wb.dataset.ready) return;
  wb.dataset.ready = '1';
  const ex = wb.dataset.ex;
  const items = [...wb.querySelectorAll('.wb-list > li')];
  const answers = (row && row.answers) || {};
  const qs = items.map((li, i) => {
    const q = li.textContent.trim(), n = i + 1;
    li.innerHTML = '<label class="wb-q" for="wb-' + ex + '-' + n + '"><span class="wb-n">' + n + '</span><span>' + escapeHtml(q) + '</span></label>' +
      '<textarea class="wb-a" id="wb-' + ex + '-' + n + '" rows="3" maxlength="1500" placeholder="' + escapeHtml(t('Escribe tu respuesta…')) + '"></textarea>';
    const ta = li.querySelector('textarea');
    ta.value = wbAnswerFor(answers, n);
    wbGrow(ta);
    ta.addEventListener('input', () => { wbGrow(ta); wbQueueSave(wb, product); });
    return { n, q, ta };
  });
  wb._qs = qs;
  wb.insertAdjacentHTML('beforeend',
    '<div class="wb-foot"><div class="wb-progress"><div class="wb-bar"><span></span></div><small class="wb-status"></small></div>' +
    '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm wb-analyze"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg><span>' + escapeHtml(t('Analizar con el coach IA')) + '</span></button></div>' +
    '<div class="wb-feedback" hidden></div>');
  wb.querySelector('.wb-analyze').addEventListener('click', () => wbAnalyze(wb, product));
  // Vista previa: se puede leer y escribir, pero guardar y analizar requiere el programa
  if (!STATE.user || !hasAccess(product)) {
    wb.dataset.preview = '1';
    const b = wb.querySelector('.wb-analyze');
    b.innerHTML = '<span>' + escapeHtml(t('Desbloquea para guardar y analizar')) + priceTag(product) + '</span>';
    b.replaceWith(b.cloneNode(true));
    wb.querySelector('.wb-analyze').addEventListener('click', () => previewBuy(product));
  }
  if (row && row.feedback) wbShowFeedback(wb, row.feedback);
  wbUpdate(wb, row ? 'saved' : '');
}

function wbGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 420) + 'px'; }

function wbCollect(wb) {
  const out = {};
  wb._qs.forEach(({ n, q, ta }) => { const v = ta.value.trim(); if (v) out[n + '. ' + q] = v; });
  return out;
}
function wbUpdate(wb, state) {
  const total = wb._qs.length, done = wb._qs.filter(x => x.ta.value.trim().length > 0).length;
  wb.querySelector('.wb-bar span').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  const st = state === 'saving' ? t('Guardando…') : state === 'saved' ? t('Guardado') : state === 'error' ? t('No se pudo guardar') : '';
  wb.querySelector('.wb-status').textContent = done + ' ' + t('de') + ' ' + total + ' ' + t('respondidas') + (st ? ' · ' + st : '');
  wb.classList.toggle('is-complete', done === total && total > 0);
  // Pide al menos la mitad de las respuestas antes de analizar
  wb.querySelector('.wb-analyze').disabled = !wb.dataset.preview && done < Math.ceil(total / 2);
  if (wb.dataset.preview) wb.querySelector('.wb-status').textContent = t('Vista previa: tus respuestas no se guardan');
}
function wbQueueSave(wb, product) {
  if (wb.dataset.preview) { wbUpdate(wb, ''); return; }
  wbUpdate(wb, 'saving');
  clearTimeout(_wbTimers[wb.dataset.ex]);
  _wbTimers[wb.dataset.ex] = setTimeout(() => wbSave(wb, product), 900);
}
async function wbSave(wb, product) {
  clearTimeout(_wbTimers[wb.dataset.ex]);
  if (!STATE.user) return false;
  const answers = wbCollect(wb);
  const { error } = await sb.from('exercise_answers').upsert(
    { user_id: STATE.user.id, product_id: product, exercise_id: wb.dataset.ex, answers, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id,exercise_id' });
  if (error) { console.warn('guardar ejercicio', error.message); wbUpdate(wb, 'error'); return false; }
  const c = (_wbCache[product] = _wbCache[product] || {});
  c[wb.dataset.ex] = Object.assign(c[wb.dataset.ex] || {}, { answers });
  wbUpdate(wb, 'saved');
  return true;
}

async function wbAnalyze(wb, product) {
  const btn = wb.querySelector('.wb-analyze'), box = wb.querySelector('.wb-feedback');
  btn.disabled = true;
  box.hidden = false;
  box.innerHTML = '<div class="wb-fb-head">' + escapeHtml(t('El coach está leyendo tus respuestas…')) + '</div><div class="mb-msg is-assistant is-typing"><span></span><span></span><span></span></div>';
  try {
    if (!(await wbSave(wb, product))) throw new Error(t('No se pudo guardar'));
    const { data, error } = await sb.functions.invoke('coach', {
      body: { action: 'analyze', product_id: product, exercise_id: wb.dataset.ex, title: wb.dataset.title || '', lang: LANG } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j.error) m = j.error; } catch (x) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    _wbCache[product][wb.dataset.ex].feedback = data.feedback;
    wbShowFeedback(wb, data.feedback);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    box.innerHTML = '<div class="mb-msg is-error">' + escapeHtml(t(friendlyPayError(e))) + '</div>';
  } finally {
    wbUpdate(wb, 'saved');
  }
}
function wbShowFeedback(wb, text) {
  const box = wb.querySelector('.wb-feedback');
  box.hidden = false;
  box.innerHTML = '<div class="wb-fb-head"><span class="wb-fb-ic">AI</span><b>' + escapeHtml(t('Análisis de tu coach')) + '</b></div>' +
    '<div class="wb-fb-body">' + coachFormat(text) + '</div>' +
    '<p class="wb-fb-note">' + escapeHtml(t('Puedes editar tus respuestas y volver a analizarlas cuando quieras.')) + '</p>';
}

// Listas de verificación: cada punto se puede marcar y queda guardado
function buildChecklist(ul, product, key, saved) {
  if (ul.dataset.ready) return;
  ul.dataset.ready = '1';
  const ex = 'cl-' + key;
  const row = saved[ex];
  ul.classList.add('is-interactive');
  [...ul.children].forEach((li, i) => {
    if (li.tagName !== 'LI') return;
    li.setAttribute('role', 'checkbox');
    li.tabIndex = 0;
    const on = !!(row && row.answers && row.answers[String(i + 1)]);
    li.classList.toggle('is-checked', on);
    li.setAttribute('aria-checked', on);
    const toggle = () => {
      const v = !li.classList.contains('is-checked');
      li.classList.toggle('is-checked', v);
      li.setAttribute('aria-checked', v);
      clearTimeout(_wbTimers[ex]);
      _wbTimers[ex] = setTimeout(() => saveChecklist(ul, product, ex), 600);
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
  });
}
async function saveChecklist(ul, product, ex) {
  if (!STATE.user) return;
  const answers = {};
  [...ul.children].forEach((li, i) => { if (li.classList.contains('is-checked')) answers[String(i + 1)] = true; });
  const { error } = await sb.from('exercise_answers').upsert(
    { user_id: STATE.user.id, product_id: product, exercise_id: ex, answers, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id,exercise_id' });
  if (error) { console.warn('guardar lista', error.message); return; }
  const c = (_wbCache[product] = _wbCache[product] || {});
  c[ex] = { answers, feedback: '' };
}
