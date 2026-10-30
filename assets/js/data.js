// =========================================================
// DGP Academy — conexión con Supabase
// La clave publicable es pública por diseño: la seguridad la
// ponen las políticas de la base de datos (ver supabase/README.md).
// =========================================================
const SUPABASE_URL = 'https://qiwqrnsedzfluvllryka.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O-K3QtrH6tGl8qy_ajcxbw_ZroiePrd';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Estado del usuario con sesión
const STATE = {
  user: null,          // usuario de Supabase Auth
  profile: null,       // { email, full_name, phone, is_admin }
  access: {},          // producto → { active, paid }
  reading: {},         // producto → { last_item, quiz_score, quiz_passed }
  certificates: {},    // producto → { number, full_name, issued_at }
  progress: {},        // producto → Set de lecciones / capítulos completados
  courtesy: false      // acceso de cortesía a todo (empleados e invitados)
};

function resetState() {
  STATE.user = null; STATE.profile = null; STATE.access = {}; STATE.reading = {};
  STATE.certificates = {}; STATE.progress = {}; STATE.courtesy = false;
}

function hasAccess(product) {
  const own = p => !!(STATE.access[p] && STATE.access[p].active);
  // El pase completo desbloquea todos los programas y libros
  return !!(STATE.profile && STATE.profile.is_admin) || STATE.courtesy || own(product) || own('pase');
}

function displayName() {
  if (!STATE.user) return '';
  const n = STATE.profile && STATE.profile.full_name;
  return (n && n.trim()) || STATE.user.email.split('@')[0];
}

// Carga todo lo del estudiante en paralelo
async function loadUserData() {
  const uid = STATE.user.id;
  const [prof, acc, prog, read, certs, court] = await Promise.all([
    sb.from('profiles').select('email, full_name, phone, is_admin, lang, gender').eq('id', uid).maybeSingle(),
    sb.from('access').select('product_id, active, paid').eq('user_id', uid),
    sb.from('progress').select('product_id, item_id').eq('user_id', uid),
    sb.from('reading_state').select('product_id, last_item, quiz_score, quiz_passed, updated_at').eq('user_id', uid),
    sb.from('certificates').select('product_id, number, full_name, issued_at').eq('user_id', uid),
    sb.rpc('is_courtesy')
  ]);
  STATE.courtesy = !!court.data;
  const err = prof.error || acc.error || prog.error || read.error || certs.error;
  if (err) throw err;
  STATE.profile = prof.data || { email: STATE.user.email, full_name: '', phone: '', is_admin: false };
  // Si la persona no eligió idioma en este navegador, se usa el de su perfil
  let chosen = null; try { chosen = localStorage.getItem(LANG_KEY); } catch (e) {}
  if (!chosen && (STATE.profile.lang === 'es' || STATE.profile.lang === 'en') && STATE.profile.lang !== LANG && typeof setLang === 'function') setLang(STATE.profile.lang);
  STATE.access = {};
  (acc.data || []).forEach(r => { STATE.access[r.product_id] = { active: r.active, paid: r.paid }; });
  STATE.progress = {};
  (prog.data || []).forEach(r => { (STATE.progress[r.product_id] = STATE.progress[r.product_id] || new Set()).add(r.item_id); });
  STATE.reading = {};
  (read.data || []).forEach(r => { STATE.reading[r.product_id] = r; });
  STATE.certificates = {};
  (certs.data || []).forEach(r => { STATE.certificates[r.product_id] = r; });
  sb.rpc('touch_last_seen').then(() => {}, () => {});
}

// Guarda una lección / capítulo completado
function saveProgress(product, item) {
  if (!STATE.user || !hasAccess(product)) return;
  (STATE.progress[product] = STATE.progress[product] || new Set()).add(item);
  sb.from('progress')
    .upsert({ user_id: STATE.user.id, product_id: product, item_id: item }, { onConflict: 'user_id,product_id,item_id', ignoreDuplicates: true })
    .then(({ error }) => { if (error) console.warn('progreso', error.message); });
}

function clearProgress(product) {
  STATE.progress[product] = new Set();
  if (!STATE.user) return Promise.resolve();
  return sb.from('progress').delete().eq('user_id', STATE.user.id).eq('product_id', product);
}

// Guarda en qué capítulo va el lector
const _posTimers = {};
function savePosition(product, item) {
  if (!STATE.user || !hasAccess(product)) return;
  STATE.reading[product] = Object.assign({}, STATE.reading[product], { last_item: item, updated_at: new Date().toISOString() });
  clearTimeout(_posTimers[product]);
  _posTimers[product] = setTimeout(() => {
    sb.from('reading_state')
      .upsert({ user_id: STATE.user.id, product_id: product, last_item: item, updated_at: new Date().toISOString() }, { onConflict: 'user_id,product_id' })
      .then(({ error }) => { if (error) console.warn('posición', error.message); });
  }, 600);
}

// Contenido protegido: solo se descarga si el usuario tiene acceso
// Se descarga en el idioma activo; si aún no existe la traducción, en español
const _contentLoaded = {};
async function loadContent(product, rootSelector) {
  // Sin acceso solo llegan las lecciones gratis (vista previa); al comprar se vuelve a cargar todo
  const key = LANG + (hasAccess(product) ? '' : ':preview');
  if (_contentLoaded[product] === key) return true;
  let { data, error } = await sb.from('content').select('item_id, html').eq('product_id', product).eq('lang', LANG).order('position');
  if (!error && (!data || !data.length) && LANG !== 'es') {
    ({ data, error } = await sb.from('content').select('item_id, html').eq('product_id', product).eq('lang', 'es').order('position'));
  }
  if (error) throw error;
  if (!data || !data.length) return false;
  const root = document.querySelector(rootSelector);
  data.forEach(row => {
    const el = root.querySelector('#' + CSS.escape(row.item_id));
    if (el) {
      el.innerHTML = row.html; useRealLogos(el);
      if (typeof addReadingTime === 'function') addReadingTime(el);
      if (typeof initWorkbooks === 'function') initWorkbooks(el, product).catch(e => console.warn('cuaderno', e.message));
    }
  });
  _contentLoaded[product] = key;
  if (typeof applyPreview === 'function') applyPreview(product, root);
  return true;
}
// Logos oficiales de las herramientas (en lugar de los dibujos genéricos del contenido)
const TOOL_LOGOS = {
  'claude code': 'claude.svg', 'claude': 'claude.svg', 'github': 'github.svg', 'github pages': 'github.svg', 'firebase': 'firebase.svg',
  'supabase': 'supabase.svg', 'godaddy': 'godaddy.svg', 'cloudinary': 'cloudinary.svg', 'formspree': 'formspree.svg', 'emailjs': 'emailjs.png',
  'databuddy': 'databuddy.png', 'canva': 'canva.png', 'unsplash': 'unsplash.svg', 'gemini': 'googlegemini.svg', 'gemini pro': 'googlegemini.svg',
  'reactbits': 'reactbits.png', 'react bits': 'reactbits.png'
};
function useRealLogos(root) {
  root.querySelectorAll('svg.pill-logo').forEach(svg => {
    const name = (svg.parentElement.textContent || '').trim().toLowerCase();
    const file = TOOL_LOGOS[name];
    if (!file) return;
    const img = document.createElement('img');
    img.className = 'pill-logo'; img.src = 'assets/img/tools/' + file; img.alt = ''; img.width = 22; img.height = 22;
    svg.replaceWith(img);
  });
}

function clearContent() {
  Object.keys(_contentLoaded).forEach(k => delete _contentLoaded[k]);
  if (typeof clearExerciseCache === 'function') clearExerciseCache();
  document.querySelectorAll('#course-screen .lesson, .book-chapter').forEach(el => { el.innerHTML = ''; });
}

// Certificados (los emite el servidor tras validar)
async function issueCertificate(product) {
  if (STATE.certificates[product]) return STATE.certificates[product];
  const { data, error } = await sb.rpc('issue_certificate', { p: product });
  if (error) throw error;
  STATE.certificates[product] = data;
  return data;
}

function isEligible(product) {
  if (product === 'web-dev') {
    const s = STATE.progress['web-dev'] || new Set();
    return hasAccess('web-dev') && [...s].filter(i => /^l\d+$/.test(i)).length >= 16;
  }
  if (product === 'ia') {
    const s = STATE.progress['ia'] || new Set();
    return hasAccess('ia') && [...s].filter(i => /^ai[1-9]\d*$/.test(i)).length >= 16;
  }
  if (product === '7st') return !!(STATE.reading['7st'] && STATE.reading['7st'].quiz_passed);
  return false;
}

// Emite en silencio los certificados que ya se ganaron
async function syncCertificates() {
  for (const p of ['web-dev', 'ia', '7st']) {
    if (!STATE.certificates[p] && isEligible(p)) {
      try { await issueCertificate(p); } catch (e) { /* se reintenta al abrirlo */ }
    }
  }
}

async function loadCuposPublic() {
  // Los cupos ocupados se cuentan en el servidor desde los estudiantes que ya pagaron
  const { data, error } = await sb.rpc('public_cupos');
  if (error || !data) return { disponibles: 20, total: 20, taken: 0 };
  return data;
}
