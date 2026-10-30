// =========================================================
// DGP Academy — pagos del estudiante (Zelle y tarjeta con Square)
// Precios, datos de Zelle y credenciales públicas de Square vienen de
// la tabla settings; el cobro con tarjeta lo hace la función "payments"
// en el servidor, que es la única que conoce el access token.
// =========================================================

const SITE_CFG = { payments: null, contact: null, announcement: null, products: {} };
let MY_ORDERS = [];
let coProduct = 'web-dev';
let coPlan = null;   // id del plan cuando se paga una membresía

// Dólares siempre como $97 o $97.50, en los dos idiomas
function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: v % 1 ? 2 : 0 });
}

// Ajustes públicos: se leen sin sesión (políticas de lectura pública)
async function loadSiteSettings() {
  const [st, pr, pl] = await Promise.all([
    sb.from('settings').select('key, value').in('key', ['payments', 'contact', 'announcement', 'membership']),
    sb.from('products').select('id, title, title_en, price_usd, regular_price_usd, status'),
    sb.from('plans').select('*').eq('active', true).order('position')
  ]);
  SITE_CFG.plans = {}; SITE_CFG.planList = pl.data || [];
  SITE_CFG.planList.forEach(p => { SITE_CFG.plans[p.id] = p; });
  (st.data || []).forEach(r => { SITE_CFG[r.key] = r.value; });
  (pr.data || []).forEach(r => { SITE_CFG.products[r.id] = r; });
  const c = SITE_CFG.contact || {};
  if (c.email) CONTACT.email = c.email;
  CONTACT.whatsapp = String(c.whatsapp || '').replace(/\D/g, '');
  renderLandingPrice();
  if (typeof renderLandingPlans === 'function') renderLandingPlans();
}

function productTitle(p) {
  const pr = SITE_CFG.products[p];
  if (!pr) return '';
  return LANG === 'en' ? (pr.title_en || pr.title) : pr.title;
}

// Precio en la landing (si el admin lo cambia, se ve sin tocar el código)
function renderLandingPrice() {
  const num = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.querySelectorAll('[data-price-num]').forEach(el => { const pr = SITE_CFG.products[el.dataset.priceNum]; if (pr && pr.price_usd != null) el.textContent = num(pr.price_usd); });
  document.querySelectorAll('[data-price-regular-num]').forEach(el => { const pr = SITE_CFG.products[el.dataset.priceRegularNum]; if (pr && pr.regular_price_usd) el.textContent = num(pr.regular_price_usd); });
  // Promoción Venezuela (pase completo a precio especial con Pago Móvil o Binance Pay)
  const vp = vePromo(), box = document.getElementById('lp-ve-promo');
  if (box) { box.hidden = !vp; if (vp) document.getElementById('lp-ve-promo-num').textContent = num(vp); }
}

// Precio promocional del pase para Venezuela, o null si no hay promoción activa
function vePromo() {
  const pay = SITE_CFG.payments || {}, vp = pay.ve_promo || {}, pm = pay.pago_movil || {}, bn = pay.binance || {};
  const methodOn = (pm.enabled && Number(pm.rate) > 0 && pm.phone) || (bn.enabled && bn.pay_id);
  return vp.enabled && Number(vp.price) > 0 && methodOn ? Number(vp.price) : null;
}

// Comprar desde la portada: sin sesión, se guarda la intención y se abre el pago al entrar
function buyProduct(product) {
  if (STATE.user) { showDashboard(); setTimeout(() => openCheckout(product), 300); return; }
  try { sessionStorage.setItem('dgp-buy', product); } catch (e) {}
  goToRegister();
}
function resumePendingBuy() {
  let p = null;
  try { p = sessionStorage.getItem('dgp-buy'); sessionStorage.removeItem('dgp-buy'); } catch (e) {}
  if (p && SITE_CFG.products[p] && !hasAccess(p)) setTimeout(() => openCheckout(p), 900);
}

// ── Panel del estudiante ─────────────────────────────────────────────────────
async function loadMyOrders() {
  if (!STATE.user) { MY_ORDERS = []; return; }
  const { data } = await sb.from('orders')
    .select('id, kind, product_id, plan_id, amount, currency, method, status, reference, invoice_number, created_at, verified_at')
    .eq('user_id', STATE.user.id).order('created_at', { ascending: false });
  MY_ORDERS = data || [];
}

async function paymentsOnUser() {
  try { await loadMyOrders(); } catch (e) { MY_ORDERS = []; }
  renderAnnouncement();
  renderMyPayments();
  renderPendingNotice();
  if (typeof loadMembership === 'function') loadMembership().catch(() => {});
  resumePendingBuy();
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
const METHOD_LABEL = { zelle: 'Zelle', square: 'Tarjeta', manual: 'Pago registrado', pago_movil: 'Pago Móvil', binance: 'Binance Pay' };

function renderMyPayments() {
  const sec = document.getElementById('dash-payments');
  const list = document.getElementById('dash-pay-list');
  if (!sec || !list) return;
  sec.hidden = !MY_ORDERS.length;
  list.innerHTML = MY_ORDERS.map(o => {
    const st = ORDER_STATUS[o.status] || [o.status, ''];
    return '<div class="dash-pay">' +
      '<div class="dash-pay-main"><div class="dash-pay-title">' + escapeHtml(o.kind === 'subscription' ? planTitle(o.plan_id) : (productTitle(o.product_id) || o.product_id)) + '</div>' +
      '<div class="dash-pay-meta">' + escapeHtml(fmtDate(o.created_at)) + ' · ' + escapeHtml(t(METHOD_LABEL[o.method] || o.method)) +
      (o.invoice_number ? ' · <span class="mono">' + escapeHtml(o.invoice_number) + '</span>' : '') + '</div></div>' +
      '<div class="dash-pay-amt">' + fmtMoney(o.amount) + '</div>' +
      '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span>' +
    '</div>';
  }).join('');
}

// Aviso dentro del panel de activación cuando hay un pago manual (Zelle, Pago Móvil, Binance) en revisión
function renderPendingNotice() {
  const box = document.getElementById('dash-pending-pay');
  const btn = document.getElementById('dash-activate-pay');
  if (!box) return;
  const pending = MY_ORDERS.find(o => o.status === 'pending');
  const rejected = !pending && MY_ORDERS.find(o => o.status === 'rejected');
  if (pending) {
    box.hidden = false;
    box.className = 'dash-pending-pay';
    box.innerHTML = '<svg><use href="#i-clock"/></svg><span>' + escapeHtml(t('Recibimos tu pago por') + ' ' + t(METHOD_LABEL[pending.method] || pending.method) + ' ' + t('y lo estamos verificando. Te avisaremos por correo.')) + '</span>';
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
function planTitle(id) {
  const p = (SITE_CFG.plans || {})[id];
  return p ? (LANG === 'en' ? p.name_en + ' membership' : 'Membresía ' + p.name) : id;
}

// Membresía: misma ventana de pago, con monto mensual del plan
function openPlanCheckout(planId) {
  coPlan = planId;
  openCheckout(null);
}

function openCheckout(product) {
  if (!STATE.user) { goToRegister(); return; }
  if (product) { coPlan = null; coProduct = product; }
  const plan = coPlan ? (SITE_CFG.plans || {})[coPlan] : null;
  const pr = plan ? { price_usd: plan.price_usd } : (SITE_CFG.products[coProduct] || {});
  const pay = SITE_CFG.payments || {};
  const z = pay.zelle || {};
  const sq = pay.square || {};
  const price = pr.price_usd != null ? fmtMoney(pr.price_usd) : '—';

  document.getElementById('co-product').textContent = plan ? planTitle(coPlan) : productTitle(coProduct);
  document.getElementById('co-price').textContent = plan ? price + t('/mes') : price;
  document.getElementById('co-kicker').textContent = t(plan ? 'Membresía mensual · cancela cuando quieras' : 'Pago único · acceso de por vida');
  const IMG = { 'web-dev': 'curso-web.webp', ia: 'curso-ia.webp', '7st': 'biblioteca.webp', semilla: 'biblioteca.webp', pase: 'plataforma.webp' };
  document.getElementById('co-img').src = 'assets/img/' + (plan ? 'perfil-emprendedores.webp' : (IMG[coProduct] || 'curso-web.webp'));
  // Sugerencia del pase completo cuando se compra una sola cosa
  const pase = SITE_CFG.products.pase;
  const up = document.getElementById('co-upsell');
  if (up) {
    const show = !plan && coProduct !== 'pase' && pase && pase.price_usd != null && !hasAccess('pase');
    up.hidden = !show;
    if (show) up.innerHTML = '<div><b>' + escapeHtml(t('¿Y si te llevas todo?')) + '</b><span>' + escapeHtml(t('El pase completo incluye todos los programas y libros por')) + ' ' + fmtMoney(pase.price_usd) + '.</span></div>' +
      '<button type="button" class="ui-btn ui-btn--dark ui-btn--sm" onclick="openCheckout(\'pase\')">' + escapeHtml(t('Ver pase completo')) + '</button>';
  }
  document.getElementById('co-regular').textContent = pr.regular_price_usd ? fmtMoney(pr.regular_price_usd) : '';
  document.getElementById('co-zelle-amount').textContent = price;
  document.getElementById('co-zelle-email').textContent = z.email || CONTACT.email;
  document.getElementById('co-zelle-phone').textContent = z.phone || '';
  document.getElementById('co-zelle-phone-row').hidden = !z.phone;
  document.getElementById('co-zelle-holder').textContent = z.holder || 'DGP Global Group';
  document.getElementById('co-zelle-ins').textContent = (LANG === 'en' ? (z.instructions_en || z.instructions_es) : (z.instructions_es || z.instructions_en)) || '';
  document.getElementById('co-card-btn').textContent = plan ? t('Suscribirme por') + ' ' + price + t('/mes') : t('Pagar') + ' ' + price;
  document.getElementById('co-card-note').textContent = t(plan
    ? 'Se cobra automáticamente cada mes con Square. Cancelas cuando quieras desde tu panel.'
    : 'Pago seguro procesado por Square. No guardamos los datos de tu tarjeta.');
  document.getElementById('co-zelle-foot').textContent = t(plan
    ? 'Con Zelle la membresía se paga mes a mes: te avisamos antes de que venza. Verificamos el pago en menos de 24 horas.'
    : 'Verificamos los pagos de Zelle a mano, normalmente en menos de 24 horas. Te avisamos por correo.');

  const pending = MY_ORDERS.find(o => o.status === 'pending' && (plan ? o.kind === 'subscription' : o.product_id === coProduct));
  document.getElementById('co-ref').value = pending ? pending.reference : '';
  document.getElementById('co-payer').value = pending ? '' : (STATE.profile && STATE.profile.full_name) || '';

  const zelleOn = z.enabled !== false, squareOn = !!(sq.enabled && sq.app_id && sq.location_id);
  document.getElementById('co-square-off').hidden = squareOn;
  document.getElementById('co-square-on').hidden = !squareOn;

  // Venezuela: Pago Móvil (en bolívares a la tasa configurada) y Binance Pay (USDT)
  const pm = pay.pago_movil || {}, bn = pay.binance || {};
  const rate = Number(pm.rate) || 0;
  CO_ON = { zelle: zelleOn, square: true, pago_movil: !!(pm.enabled && rate > 0 && pm.phone), binance: !!(bn.enabled && bn.pay_id) };
  CO_BASE = { usd: Number(pr.price_usd) || 0, regular: pr.regular_price_usd, plan: !!plan };
  document.getElementById('co-pm-bank').textContent = pm.bank || '—';
  document.getElementById('co-pm-phone').textContent = pm.phone || '—';
  document.getElementById('co-pm-doc').textContent = pm.id_doc || '—';
  document.getElementById('co-pm-holder').textContent = pm.holder || 'DGP Global Group';
  document.getElementById('co-bn-id').textContent = bn.pay_id || '—';
  document.getElementById('co-bn-holder').textContent = bn.holder || 'DGP Global Group';
  ['pm', 'bn'].forEach(k => { document.getElementById('co-' + k + '-ref').value = ''; document.getElementById('co-' + k + '-payer').value = (STATE.profile && STATE.profile.full_name) || ''; });
  const veOn = CO_ON.pago_movil || CO_ON.binance;
  document.getElementById('co-country').hidden = !veOn;

  document.getElementById('co-body').hidden = false;
  document.getElementById('co-done').hidden = true;
  coError('');
  coCountry(pending && (pending.method === 'pago_movil' || pending.method === 'binance') ? 'VE' : (veOn ? coGuessCountry() : 'US'));
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

// País del pago: cada país muestra sus propios métodos
let CO_ON = {}, CO_COUNTRY = 'US';
function coGuessCountry() {
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  try { const saved = localStorage.getItem('dgp-pay-country'); if (saved === 'US' || saved === 'VE') return saved; } catch (e) {}
  return tz === 'America/Caracas' || /-VE$/i.test(navigator.language || '') ? 'VE' : 'US';
}
let CO_BASE = { usd: 0 };
// Montos según el país: en Venezuela el pase completo puede tener precio promocional
function coAmounts() {
  const pm = (SITE_CFG.payments || {}).pago_movil || {}, rate = Number(pm.rate) || 0;
  const promo = CO_COUNTRY === 'VE' && !CO_BASE.plan && coProduct === 'pase' ? vePromo() : null;
  const usd = promo || CO_BASE.usd;
  const bs = n => 'Bs ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('co-price').textContent = CO_BASE.plan ? fmtMoney(usd) + t('/mes') : fmtMoney(usd);
  document.getElementById('co-regular').textContent = promo ? fmtMoney(CO_BASE.usd) : (CO_BASE.regular ? fmtMoney(CO_BASE.regular) : '');
  const tag = document.getElementById('co-promo');
  tag.hidden = !promo;
  if (promo) tag.innerHTML = '<b>' + escapeHtml(t('Promoción Venezuela')) + '</b><span>' + escapeHtml(t('Acceso completo a todo el contenido por')) + ' ' + fmtMoney(promo) + ' ' + escapeHtml(t('pagando con Pago Móvil o Binance Pay.')) + '</span>';
  document.getElementById('co-pm-amount').textContent = rate ? bs(usd * rate) : 'Bs —';
  document.getElementById('co-pm-rate').textContent = rate ? t('Tasa del día:') + ' ' + bs(rate) + ' ' + t('por dólar') + ' (' + fmtMoney(usd) + ' USD).' : '';
  document.getElementById('co-bn-amount').textContent = usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';
}

function coCountry(c) {
  CO_COUNTRY = c;
  coAmounts();
  try { localStorage.setItem('dgp-pay-country', c); } catch (e) {}
  document.querySelectorAll('.co-cty').forEach(b => b.classList.toggle('is-active', b.dataset.c === c));
  const list = [...document.querySelectorAll('.co-method')];
  list.forEach(b => { b.hidden = b.dataset.c !== c || !CO_ON[b.dataset.m]; });
  const first = list.find(b => !b.hidden);
  coMethod(first ? first.dataset.m : (c === 'US' ? 'square' : 'pago_movil'));
}

function coMethod(m) {
  document.querySelectorAll('.co-method').forEach(b => b.classList.toggle('is-active', b.dataset.m === m));
  ['zelle', 'square', 'pago_movil', 'binance'].forEach(k => document.getElementById('co-' + k).classList.toggle('is-active', m === k));
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

// Pago Móvil y Binance Pay: igual que Zelle, se registra y lo verificamos a mano
async function submitManual(method) {
  const k = method === 'binance' ? 'bn' : 'pm';
  const btn = document.getElementById('co-' + k + '-btn');
  const ref = document.getElementById('co-' + k + '-ref').value.trim();
  const payer = document.getElementById('co-' + k + '-payer').value.trim();
  if (ref.length < 3) { coError('Escribe el número de confirmación del pago'); return; }
  btn.disabled = true; coError('');
  try {
    const { data, error } = coPlan
      ? await sb.rpc('create_subscription_order', { plan: coPlan, reference: ref, payer: payer, method })
      : await sb.rpc('create_order', { p: coProduct, method, reference: ref, payer: payer });
    if (error) throw error;
    sb.functions.invoke('payments', { body: { action: 'order_placed', order_id: data.id } }).catch(() => {});
    await paymentsOnUser();
    coDone('¡Pago registrado!', 'Lo verificaremos en menos de 24 horas y activaremos tu acceso. Te avisaremos por correo.');
  } catch (e) {
    coError(friendlyPayError(e));
  } finally {
    btn.disabled = false;
  }
}

async function submitZelle() {
  const btn = document.getElementById('co-zelle-btn');
  const ref = document.getElementById('co-ref').value.trim();
  const payer = document.getElementById('co-payer').value.trim();
  if (ref.length < 3) { coError('Escribe el número de confirmación del pago'); return; }
  btn.disabled = true; coError('');
  try {
    const { data, error } = coPlan
      ? await sb.rpc('create_subscription_order', { plan: coPlan, reference: ref, payer: payer })
      : await sb.rpc('create_order', { p: coProduct, method: 'zelle', reference: ref, payer: payer });
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
    const body = coPlan
      ? { action: 'square_subscribe', plan_id: coPlan, source_id: r.token }
      : { action: 'square_pay', product_id: coProduct, source_id: r.token };
    const { data, error } = await sb.functions.invoke('payments', { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (x) {}
      throw new Error(msg);
    }
    if (!data || !data.ok) throw new Error((data && data.error) || 'El pago fue rechazado');
    await loadUserData();
    applyUserData();
    if (coPlan) { await loadMembership(); coDone('¡' + welcomeWord() + ' ' + t('a la membresía') + '!', 'Tu membresía ya está activa. Ya puedes pedir tus flyers y agendar tus asesorías.'); }
    else coDone('¡Pago aprobado!', 'Tu programa ya está activo. Te enviamos la factura por correo.');
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
