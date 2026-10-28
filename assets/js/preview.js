// =========================================================
// Vista previa gratis: la primera lección de cada programa y libro se lee sin pagar (y sin cuenta).
// El servidor solo entrega las filas marcadas como gratis (content.is_free); el resto muestra un aviso para desbloquear.
// =========================================================
const FREE_ITEMS = { 'web-dev': ['home', 'l1'], ia: ['ai0', 'ai1'], '7st': ['ch-intro', 'ch-1'], semilla: ['s2-nota', 's2-1'] };
const FREE_FIRST = { 'web-dev': 'l1', ia: 'ai1', '7st': 'ch-1', semilla: 's2-1' };
const PREVIEW_ROOT = { 'web-dev': '#course-screen', ia: '#ai-screen', '7st': '#book-screen', semilla: '#book-screen-2' };
const PREVIEW_NAME = { 'web-dev': 'Diseño y Desarrollo Web con IA', ia: 'IA aplicada a los negocios', '7st': '7ST: emprende en redes', semilla: 'De la semilla al árbol' };

function isFreeItem(product, id) { return (FREE_ITEMS[product] || []).includes(id); }
function isBookProduct(product) { return product === '7st' || product === 'semilla'; }

// Abre directamente la primera lección gratis
function tryFree(product) {
  const first = FREE_FIRST[product];
  if (product === 'web-dev') openProtected('web-dev', '#course-screen', () => { showCourse(); updateProgress(); goTo(first); });
  else if (product === 'ia') { ensureAIScreen(); openProtected('ia', '#ai-screen', () => { showScreen('ai-screen'); goToAI(first); updateAIProgress(); }); }
  else if (product === '7st') openProtected('7st', '#book-screen', () => { showScreen('book-screen'); goToChapter(first); });
  else if (product === 'semilla') openProtected('semilla', '#book-screen-2', () => { showScreen('book-screen-2'); goToChapter2(first); });
}

function previewPaywall(product) {
  const book = isBookProduct(product);
  return '<div class="pw">' +
    '<div class="pw-ic"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>' +
    '<span class="pw-kicker">' + escapeHtml(t(book ? 'Capítulo bloqueado' : 'Lección bloqueada')) + '</span>' +
    '<h2>' + escapeHtml(t(book ? 'Sigue leyendo el libro completo' : 'Desbloquea el programa completo')) + '</h2>' +
    '<p>' + escapeHtml(t(book
      ? 'Ya leíste la muestra gratis. Desbloquea el libro para leer todos los capítulos, responder los cuadernos de trabajo y recibir el análisis del coach IA.'
      : 'Ya viste la lección gratis. Desbloquea el programa para ver todas las lecciones, guardar tu avance, usar el coach IA y obtener tu certificado.')) + '</p>' +
    '<ul class="pw-perks"><li>' + escapeHtml(t('Acceso de por vida')) + '</li><li>' + escapeHtml(t(book ? 'Cuadernos de trabajo' : 'Certificado al terminar')) + '</li><li>' + escapeHtml(t('Pago único, sin suscripción')) + '</li></ul>' +
    '<div class="pw-btns">' +
      '<button type="button" class="ui-btn ui-btn--primary" onclick="previewBuy(\'' + product + '\')">' + escapeHtml(t(book ? 'Desbloquear libro' : 'Desbloquear programa')) + priceTag(product) + '</button>' +
      '<button type="button" class="ui-btn ui-btn--ghost" onclick="previewBuy(\'pase\')">' + escapeHtml(t('Pase completo: todo incluido')) + priceTag('pase') + '</button>' +
    '</div>' +
    '<button type="button" class="pw-back" onclick="tryFree(\'' + product + '\')">' + escapeHtml(t('Volver a la lección gratis')) + '</button>' +
  '</div>';
}

// Compra desde el lector: cierra la vista previa y abre el pago (o el registro si no hay sesión)
function previewBuy(product) {
  ['course-screen', 'ai-screen', 'book-screen', 'book-screen-2'].forEach(id => { const s = document.getElementById(id); if (s) s.style.display = 'none'; });
  if (STATE.user) { showDashboard(); setTimeout(() => openCheckout(product), 300); }
  else buyProduct(product);
}

function previewCta(product) {
  const book = isBookProduct(product);
  return '<aside class="pw-cta" data-preview-cta>' +
    '<div><b>' + escapeHtml(t(book ? '¿Te gustó? Este es un capítulo de muestra.' : '¿Te gustó? Esta es una lección gratis.')) + '</b>' +
    '<span>' + escapeHtml(t(book ? 'Desbloquea el libro completo y sigue leyendo.' : 'Desbloquea las 16 lecciones, el coach IA y tu certificado.')) + '</span></div>' +
    '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="previewBuy(\'' + product + '\')">' + escapeHtml(t('Desbloquear')) + priceTag(product) + '</button>' +
  '</aside>';
}

function applyPreview(product, root) {
  if (!root) return;
  const locked = !hasAccess(product);
  root.classList.toggle('is-preview', locked);
  root.querySelectorAll('[data-id], [data-ch]').forEach(el => {
    const id = el.dataset.id || el.dataset.ch;
    el.classList.toggle('is-locked', locked && !isFreeItem(product, id));
  });
  root.querySelectorAll('[data-preview-cta]').forEach(el => el.remove());
  if (!locked) return;
  root.querySelectorAll('.lesson, .book-chapter').forEach(el => {
    if (!el.id) return;
    if (isFreeItem(product, el.id)) {
      if (el.id === FREE_FIRST[product] && el.innerHTML.trim()) el.insertAdjacentHTML('beforeend', previewCta(product));
    } else if (!el.innerHTML.trim() || el.querySelector('.pw')) {
      el.innerHTML = previewPaywall(product);
    }
  });
}

// Panel: "Ver lección gratis" debajo de cada programa o libro sin desbloquear
function syncTryFree() {
  [['btn-web-dev', 'web-dev'], ['btn-ia', 'ia'], ['btn-7st', '7st'], ['btn-semilla', 'semilla']].forEach(([id, p]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    let link = btn.parentElement.querySelector('.try-free[data-p="' + p + '"]');
    if (hasAccess(p)) { if (link) link.remove(); return; }
    if (!link) {
      link = document.createElement('button');
      link.type = 'button'; link.className = 'try-free'; link.dataset.p = p;
      link.onclick = () => tryFree(p);
      btn.insertAdjacentElement('afterend', link);
    }
    link.textContent = t(isBookProduct(p) ? 'Leer un capítulo gratis' : 'Ver la lección gratis') + ' →';
  });
}
