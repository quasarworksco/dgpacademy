// =========================================================
// DGP Academy — idiomas (español / inglés)
// El HTML está escrito en español. En inglés, cada texto que
// aparece en pantalla se traduce con el diccionario I18N_EN,
// incluidos los que el JavaScript inserta después.
// El contenido de lecciones y libros viene ya traducido de Supabase.
// =========================================================
const LANG_KEY = 'dgp-lang';
let LANG = (function () {
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'es' || s === 'en') return s; } catch (e) {}
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'es' || q === 'en') return q;
  return /^es\b/i.test(navigator.language || 'es') ? 'es' : 'en';
})();

const I18N_ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
// Zonas cuyo contenido llega traducido desde la base de datos
const I18N_SKIP = '.lesson, .book-chapter, script, style, pre, .c-name, #dash-username, #dash-useremail, #dash-welcome-name, .admin-user-name, .admin-user-email';
// Excepciones dentro de esas zonas que sí genera la interfaz
const I18N_ALLOW = '#quiz-result, #btn-finish-course, #btn-restart';

const originalText = new WeakMap();   // nodo de texto → texto original en español
const originalAttr = new WeakMap();   // elemento → { atributo: texto original }

function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

// Traduce un texto suelto (también se usa desde el código)
function t(es) {
  if (LANG !== 'en' || es == null) return es;
  const key = norm(String(es));
  if (!key) return es;
  const dict = window.I18N_EN || {};
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  let out = key, hit = false;
  (window.I18N_EN_PATTERNS || []).forEach(([re, rep]) => {
    if (re.test(out)) { out = out.replace(re, rep); hit = true; }
  });
  return hit ? out : es;
}

function skipped(el) {
  if (!el || !el.closest) return false;
  if (el.closest(I18N_ALLOW)) return false;
  return !!el.closest(I18N_SKIP);
}

function translateTextNode(node) {
  if (skipped(node.parentElement)) return;
  const current = node.nodeValue;
  let es = originalText.get(node);
  // Si el código cambió el texto, el nuevo texto es la nueva versión en español
  if (es === undefined || (current !== es && current !== node.__dgpEn)) { es = current; originalText.set(node, es); }
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(es)) return;
  let value = es;
  if (LANG === 'en') {
    const tr = t(es);
    if (tr !== es) {
      const lead = es.match(/^\s*/)[0], trail = es.match(/\s*$/)[0];
      value = lead + tr + trail;
    }
  }
  node.__dgpEn = value;
  if (node.nodeValue !== value) node.nodeValue = value;
}

function translateAttrs(el) {
  if (skipped(el)) return;
  let store = originalAttr.get(el);
  I18N_ATTRS.forEach(a => {
    if (!el.hasAttribute(a)) return;
    const cur = el.getAttribute(a);
    store = store || {};
    if (store[a] === undefined || (cur !== store[a] && cur !== store['__en_' + a])) store[a] = cur;
    const value = LANG === 'en' ? t(store[a]) : store[a];
    store['__en_' + a] = value;
    if (cur !== value) el.setAttribute(a, value);
  });
  if (store) originalAttr.set(el, store);
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) { translateTextNode(root); return; }
  if (root.nodeType !== 1) return;
  if (skipped(root) && !root.querySelector(I18N_ALLOW)) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) translateTextNode(n);
    else translateAttrs(n);
  }
}

// Traduce lo que el código va insertando en la página
let i18nBusy = false;
const i18nObserver = new MutationObserver(muts => {
  if (i18nBusy) return;
  i18nBusy = true;
  try {
    muts.forEach(m => {
      if (m.type === 'characterData') translateTextNode(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    });
  } finally { i18nBusy = false; }
});

const META = {
  es: { title: 'DGP Academy — Plataforma de Cursos', desc: 'Aprende desarrollo web, IA aplicada y marketing digital con los mismos profesionales de DGP Global Group. Cursos interactivos, acceso inmediato, sin suscripción.' },
  en: { title: 'DGP Academy — Online Learning Platform', desc: 'Learn web development, applied AI and digital marketing from the DGP Global Group team. Interactive courses, instant access, no subscription.' }
};

function applyLang() {
  document.documentElement.lang = LANG;
  document.title = META[LANG].title;
  const d = document.querySelector('meta[name="description"]');
  if (d) d.setAttribute('content', META[LANG].desc);
  i18nBusy = true;
  try { translateTree(document.body); } finally { i18nBusy = false; }
  document.querySelectorAll('.lang-switch button').forEach(b => {
    const on = b.dataset.lang === LANG;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on);
  });
}

// Cambia de idioma y vuelve a pintar lo dinámico
function setLang(lang) {
  if (lang === LANG) return;
  LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyLang();
  if (typeof onLangChange === 'function') onLangChange();
}

function langSwitchHTML(extra) {
  return '<div class="lang-switch' + (extra ? ' ' + extra : '') + '" role="group" aria-label="Idioma / Language">' +
    '<button type="button" data-lang="es" onclick="setLang(\'es\')">ES</button>' +
    '<button type="button" data-lang="en" onclick="setLang(\'en\')">EN</button></div>';
}

function locale() { return LANG === 'en' ? 'en-US' : 'es'; }

(function initI18n() {
  document.querySelectorAll('[data-lang-slot]').forEach(el => { el.outerHTML = langSwitchHTML(el.getAttribute('data-lang-slot')); });
  applyLang();
  i18nObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
})();
