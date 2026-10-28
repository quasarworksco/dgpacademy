// =========================================================
// DGP Academy — pagos del estudiante (Zelle y tarjeta con Square)
// Precios, datos de Zelle y credenciales públicas de Square vienen de
// la tabla settings; el cobro con tarjeta lo hace la función "payments"
// en el servidor, que es la única que conoce el access token.
// =========================================================

const SITE_CFG = { payments: null, contact: null, announcement: null, products: {} };
let MY_ORDERS = [];
let coProduct = 'web-dev';

// Dólares siempre como $97 o $97.50, en los dos idiomas
function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: v % 1 ? 2 : 0 });
}

// Ajustes públicos: se leen sin sesión (políticas de lectura pública)
async function loadSiteSettings() {
  const [st, pr] = await Promise.all([
    sb.from('settings').select('key, value').in('key', ['payments', 'contact', 'announcement']),
    sb.from('products').select('id, title, title_en, price_usd, regular_price_usd, status')
  ]);
  (st.data || []).forEach(r => { SITE_CFG[r.key] = r.value; });
  (pr.data || []).forEach(r => { SITE_CFG.products[r.id] = r; });
  const c = SITE_CFG.contact || {};
  if (c.email) CONTACT.email = c.email;
  CONTACT.whatsapp = String(c.whatsapp || '').replace(/\D/g, '');
  renderLandingPrice();
}

function productTitle(p) {
  const pr = SITE_CFG.products[p];
  if (!pr) return '';
  return LANG === 'en' ? (pr.title_en || pr.title) : pr.title;
}

// Precio en la landing (si el admin lo cambia, se ve sin tocar el código)
function renderLandingPrice() {
  const pr = SITE_CFG.products['web-dev'];
  if (!pr || pr.price_usd == null) return;
  const num = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.querySelectorAll('[data-price-num="web-dev"]').forEach(el => { el.textContent = num(pr.price_usd); });
  if (pr.regular_price_usd) document.querySelectorAll('[data-price-regular-num="web-dev"]').forEach(el => { el.textContent = num(pr.regular_price_usd); });
}

// ── Panel del estudiante ─────────────────────────────────────────────────────
async function loadMyOrders() {
  if (!STATE.user) { MY_ORDERS = []; return; }
  const { data } = await sb.from('orders')
    .select('id, product_id, amount, currency, method, status, reference, invoice_number, created_at, verified_at')
    .eq('user_id', STATE.user.id).order('created_at', { ascending: false });
  MY_ORDERS = data || [];
}

async function paymentsOnUser() {
  try { await loadMyOrders(); } catch (e) { MY_ORDERS = []; }
  renderAnnouncement();
  renderMyPayments();
  renderPendingNotice();
}

function renderAnnouncement() {
  const box = document.getElementById('dash-announce');
  if (!box) return;
  const a = SITE_CFG.announcement || {};
  const text = (LANG === 'en' ? (a.en || a.es) : (a.es || a.en)) || '';
  box.hidden = !(a.enabled && text.trim());
  document.getElementById('dash-announce-text').textContent = text;
}

const ORDER_STATUS = {
  pending:  ['En revisión', 'is-pending'],
  verified: ['Pagado', 'is-paid'],
  rejected: ['No verificado', 'is-rejected'],
  refunded: ['Reembolsado', 'is-rejected']
};
const METHOD_LABEL = { zelle: 'Zelle', square: 'Tarjeta', manual: 'Pago registrado' };

function renderMyPayments() {
  const sec = document.getElementById('dash-payments');
  const list = document.getElementById('dash-pay-list');
  if (!sec || !list) return;
  sec.hidden = !MY_ORDERS.length;
  list.innerHTML = MY_ORDERS.map(o => {
    const st = ORDER_STATUS[o.status] || [o.status, ''];
    return '<div class="dash-pay">' +
      '<div class="dash-pay-main"><div class="dash-pay-title">' + escapeHtml(productTitle(o.product_id) || o.product_id) + '</div>' +
      '<div class="dash-pay-meta">' + escapeHtml(fmtDate(o.created_at)) + ' · ' + escapeHtml(t(METHOD_LABEL[o.method] || o.method)) +
      (o.invoice_number ? ' · <span class="mono">' + escapeHtml(o.invoice_number) + '</span>' : '') + '</div></div>' +
      '<div class="dash-pay-amt">' + fmtMoney(o.amount) + '</div>' +
      '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span>' +
    '</div>';
  }).join('');
}

// Aviso dentro del panel de activación cuando hay un pago de Zelle en revisión
function renderPendingNotice() {
  const box = document.getElementById('dash-pending-pay');
  const btn = document.getElementById('dash-activate-pay');
  if (!box) return;
  const pending = MY_ORDERS.find(o => o.status === 'pending');
  const rejected = !pending && MY_ORDERS.find(o => o.status === 'rejected');
  if (pending) {
    box.hidden = false;
    box.className = 'dash-pending-pay';
    box.innerHTML = '<svg><use href="#i-clock"/></svg><span>' + escapeHtml(t('Recibimos tu pago por Zelle y lo estamos verificando. Te avisaremos por correo.')) + '</span>';
  } else if (rejected) {
    box.hidden = false;
    box.className = 'dash-pending-pay is-error';
    box.innerHTML = '<span>' + escapeHtml(t('No pudimos verificar tu último pago. Revisa el número de confirmación o escríbenos.')) + '</span>';
  } else {
    box.hidden = true;
  }
  if (btn) btn.innerHTML = '<svg><use href="#i-lock"/></svg>' + escapeHtml(t(pending ? 'Corregir datos del pago' : 'Activar ahora'));
}

// ── Checkout ─────────────────────────────────────────────────────────────────
function openCheckout(product) {
  if (!STATE.user) { goToRegister(); return; }
  coProduct = product || 'web-dev';
  const pr = SITE_CFG.products[coProduct] || {};
  const pay = SITE_CFG.payments || {};
  const z = pay.zelle || {};
  const sq = pay.square || {};
  const price = pr.price_usd != null ? fmtMoney(pr.price_usd) : '—';

  document.getElementById('co-product').textContent = productTitle(coProduct);
  document.getElementById('co-price').textContent = price;
  document.getElementById('co-regular').textContent = pr.regular_price_usd ? fmtMoney(pr.regular_price_usd) : '';
  document.getElementById('co-zelle-amount').textContent = price;
  document.getElementById('co-zelle-email').textContent = z.email || CONTACT.email;
  document.getElementById('co-zelle-phone').textContent = z.phone || '';
  document.getElementById('co-zelle-phone-row').hidden = !z.phone;
  document.getElementById('co-zelle-holder').textContent = z.holder || 'DGP Global Group';
  document.getElementById('co-zelle-ins').textContent = (LANG === 'en' ? (z.instructions_en || z.instructions_es) : (z.instructions_es || z.instructions_en)) || '';
  document.getElementById('co-card-btn').textContent = t('Pagar') + ' ' + price;

  const pending = MY_ORDERS.find(o => o.status === 'pending' && o.product_id === coProduct);
  document.getElementById('co-ref').value = pending ? pending.reference : '';
  document.getElementById('co-payer').value = pending ? '' : (STATE.profile && STATE.profile.full_name) || '';

  const zelleOn = z.enabled !== false, squareOn = !!(sq.enabled && sq.app_id && sq.location_id);
  document.querySelector('.co-method[data-m="zelle"]').hidden = !zelleOn;
  document.getElementById('co-square-off').hidden = squareOn;
  document.getElementById('co-square-on').hidden = !squareOn;

  document.getElementById('co-body').hidden = false;
  document.getElementById('co-done').hidden = true;
  coError('');
  coMethod(zelleOn ? 'zelle' : 'square');
  document.getElementById('checkout-overlay').style.display = 'flex';
}

function closeCheckout() {
  document.getElementById('checkout-overlay').style.display = 'none';
}

function coError(msg) {
  const el = document.getElementById('co-error');
  el.textContent = msg ? t(msg) : '';
  el.hidden = !msg;
}

function coMethod(m) {
  document.querySelectorAll('.co-method').forEach(b => b.classList.toggle('is-active', b.dataset.m === m));
  document.getElementById('co-zelle').classList.toggle('is-active', m === 'zelle');
  document.getElementById('co-square').classList.toggle('is-active', m === 'square');
  coError('');
  if (m === 'square' && !document.getElementById('co-square-on').hidden) initSquareCard();
}

function copyText(id) {
  const v = document.getElementById(id).textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(
    () => toast(t('Copiado')),
    () => toast(v)
  );
}

function coDone(title, text) {
  document.getElementById('co-body').hidden = true;
  document.getElementById('co-done').hidden = false;
  document.getElementById('co-done-title').textContent = t(title);
  document.getElementById('co-done-text').textContent = t(text);
}

function friendlyPayError(e) {
  const m = (e && (e.message || e.error)) || String(e);
  return m.replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ¿])/, '');
}

async function submitZelle() {
  const btn = document.getElementById('co-zelle-btn');
  const ref = document.getElementById('co-ref').value.trim();
  const payer = document.getElementById('co-payer').value.trim();
  if (ref.length < 3) { coError('Escribe el número de confirmación del pago'); return; }
  btn.disabled = true; coError('');
  try {
    const { data, error } = await sb.rpc('create_order', { p: coProduct, method: 'zelle', reference: ref, payer: payer });
    if (error) throw error;
    // Los correos son un extra: si fallan, el pedido ya quedó registrado
    sb.functions.invoke('payments', { body: { action: 'order_placed', order_id: data.id } }).catch(() => {});
    await paymentsOnUser();
    coDone('¡Pago registrado!', 'Lo verificaremos en menos de 24 horas y activaremos tu acceso. Te avisaremos por correo.');
  } catch (e) {
    coError(friendlyPayError(e));
  } finally {
    btn.disabled = false;
  }
}

// Square Web Payments SDK: se carga solo cuando el estudiante elige tarjeta
let sqCard = null, sqEnvLoaded = '';
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar Square'));
    document.head.appendChild(s);
  });
}
async function initSquareCard() {
  const sq = (SITE_CFG.payments || {}).square || {};
  const env = sq.env === 'production' ? 'production' : 'sandbox';
  if (sqCard && sqEnvLoaded === env) return;
  const btn = document.getElementById('co-card-btn');
  btn.disabled = true;
  try {
    if (!window.Square) await loadScript(env === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js');
    const payments = window.Square.payments(sq.app_id, sq.location_id);
    sqCard = await payments.card({ style: { input: { fontSize: '15px' }, '.input-container.is-focus': { borderColor: '#1a56e8' } } });
    await sqCard.attach('#co-card');
    sqEnvLoaded = env;
    btn.disabled = false;
  } catch (e) {
    sqCard = null;
    coError('El pago con tarjeta no está disponible en este momento. Puedes pagar con Zelle.');
  }
}

async function submitSquare() {
  if (!sqCard) return;
  const btn = document.getElementById('co-card-btn');
  btn.disabled = true; coError('');
  try {
    const r = await sqCard.tokenize();
    if (r.status !== 'OK') throw new Error((r.errors && r.errors[0] && r.errors[0].message) || 'Revisa los datos de la tarjeta');
    const { data, error } = await sb.functions.invoke('payments', { body: { action: 'square_pay', product_id: coProduct, source_id: r.token } });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (x) {}
      throw new Error(msg);
    }
    if (!data || !data.ok) throw new Error((data && data.error) || 'El pago fue rechazado');
    await loadUserData();
    applyUserData();
    coDone('¡Pago aprobado!', 'Tu programa ya está activo. Te enviamos la factura por correo.');
  } catch (e) {
    coError(friendlyPayError(e));
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('checkout-overlay').style.display === 'flex') closeCheckout();
});

loadSiteSettings().catch(() => {});
