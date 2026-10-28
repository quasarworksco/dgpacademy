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
  return !!(STATE.profile && STATE.profile.is_admin) || STATE.courtesy || !!(STATE.access[product] && STATE.access[product].active);
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
    sb.from('profiles').select('email, full_name, phone, is_admin, lang').eq('id', uid).maybeSingle(),
    sb.from('access').select('product_id, active, paid').eq('user_id', uid),
    sb.from('progress').select('product_id, item_id').eq('user_id', uid),
    sb.from('reading_state').select('product_id, last_item, quiz_score, quiz_passed').eq('user_id', uid),
    sb.from('certificates').select('product_id, number, full_name, issued_at').eq('user_id', uid),
    sb.rpc('is_courtesy')
  ]);
  STATE.courtesy = !!court.data;
  const err = prof.error || acc.error || prog.error || read.error || certs.error;
  if (err) throw err;
  STATE.profile = prof.data || { email: STATE.user.email, full_name: '', phone: '', is_admin: false };
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
  STATE.reading[product] = Object.assign({}, STATE.reading[product], { last_item: item });
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
  if (_contentLoaded[product] === LANG) return true;
  let { data, error } = await sb.from('content').select('item_id, html').eq('product_id', product).eq('lang', LANG).order('position');
  if (!error && (!data || !data.length) && LANG !== 'es') {
    ({ data, error } = await sb.from('content').select('item_id, html').eq('product_id', product).eq('lang', 'es').order('position'));
  }
  if (error) throw error;
  if (!data || !data.length) return false;
  const root = document.querySelector(rootSelector);
  data.forEach(row => {
    const el = root.querySelector('#' + CSS.escape(row.item_id));
    if (el) el.innerHTML = row.html;
  });
  _contentLoaded[product] = LANG;
  return true;
}
function clearContent() {
  Object.keys(_contentLoaded).forEach(k => delete _contentLoaded[k]);
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
  if (product === '7st') return !!(STATE.reading['7st'] && STATE.reading['7st'].quiz_passed);
  return false;
}

// Emite en silencio los certificados que ya se ganaron
async function syncCertificates() {
  for (const p of ['web-dev', '7st']) {
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
