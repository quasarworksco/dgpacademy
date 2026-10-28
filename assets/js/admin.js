// =========================================================
// DGP Academy — panel admin: resumen, pagos, conciliación y configuración
// Todo pasa por funciones de la base de datos que comprueban is_admin();
// los secretos (token de Square, contraseña SMTP) solo se escriben, nunca se leen.
// =========================================================

let ADMIN_TAB = 'resumen';
let ADMIN_ORDERS = [];
let orderFilter = 'pending';
let WEEKLY = [];
let recWeek = null;

// Permisos del equipo: el dueño ve todo; cada administrador solo las secciones que se le asignaron
let MY_PERMS = { owner: false, admin: false, perms: [] };
const TAB_PERM = { resumen: 'pagos', estudiantes: 'estudiantes', pagos: 'pagos', conciliacion: 'pagos', membresias: 'membresias', config: 'configuracion' };
const PERM_LABELS = [['estudiantes', 'Estudiantes'], ['pagos', 'Pagos, resumen y conciliación'], ['membresias', 'Membresías y cortesías'], ['configuracion', 'Configuración del sitio']];
async function loadMyPerms() {
  const { data, error } = await sb.rpc('my_perms');
  MY_PERMS = (!error && data) ? data : { owner: false, admin: false, perms: [] };
  document.querySelectorAll('.adm-tab').forEach(b => { b.hidden = !canTab(b.dataset.tab); });
  return MY_PERMS;
}
function canTab(tab) { return !!(MY_PERMS.owner || (MY_PERMS.perms || []).includes(TAB_PERM[tab])); }
function firstAllowedTab() { return Object.keys(TAB_PERM).find(canTab) || null; }

function adminTab(tab) {
  if (!canTab(tab)) tab = firstAllowedTab();
  if (!tab) return;
  ADMIN_TAB = tab;
  document.querySelectorAll('.adm-tab').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on);
  });
  document.querySelectorAll('.adm-pane').forEach(p => p.classList.toggle('is-active', p.id === 'adm-' + tab));
  adminLoad(tab);
}

function adminRefresh() { adminLoad(ADMIN_TAB); }

function adminLoad(tab) {
  if (tab === 'resumen') loadDashboard();
  else if (tab === 'estudiantes') loadAdminData();
  else if (tab === 'pagos') loadOrders();
  else if (tab === 'conciliacion') loadWeekly();
  else if (tab === 'membresias') loadMembersAdmin();
  else if (tab === 'config') loadConfig();
}

function rpcError(e) { return (e && e.message) || String(e); }

// Muestra un mensaje breve junto al botón Guardar
function flash(id, text, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = t(text);
  el.classList.toggle('is-error', !!isError);
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, isError ? 6000 : 2500);
}

async function invokePayments(body) {
  const { data, error } = await sb.functions.invoke('payments', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (x) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ── Resumen ──────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const { data: d, error } = await sb.rpc('admin_dashboard');
  if (error) { toast(t('No se pudo cargar el resumen: ') + rpcError(error)); return; }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-rev-month', fmtMoney(d.revenue_month));
  set('kpi-rev-total', t('Total histórico') + ' ' + fmtMoney(d.revenue_total));
  set('kpi-pending', d.pending_orders);
  set('kpi-pending-amt', fmtMoney(d.pending_amount) + ' ' + t('en revisión'));
  set('kpi-students', d.students);
  set('kpi-new', '+' + d.new_30d + ' ' + t('en 30 días'));
  set('kpi-active', d.active_7d);
  set('kpi-access', d.with_access + ' ' + t('con acceso activo'));
  set('kpi-certs', d.certificates);
  set('kpi-lessons', d.lessons_done + ' ' + t('lecciones completadas'));
  setPendingBadge(d.pending_orders);
  renderChart(d.months || []);
  renderByProduct(d.by_product || {});
  renderRecent(d.recent || []);
  renderHealth();
}

function setPendingBadge(n) {
  const b = document.getElementById('adm-pending-badge');
  if (!b) return;
  b.hidden = !n;
  b.textContent = n;
}

// Barras de ingresos con línea de registros (SVG propio, sin librerías)
function renderChart(months) {
  const box = document.getElementById('adm-chart');
  if (!box || !months.length) return;
  // El viewBox usa el ancho real de la tarjeta para que el texto no se escale
  const W = Math.max(320, Math.round(box.clientWidth || 640)), H = W < 560 ? 200 : 240, padL = 52, padB = 30, padT = 22, padR = 16;
  const maxRev = Math.max(100, ...months.map(m => Number(m.revenue)));
  const maxSign = Math.max(4, ...months.map(m => Number(m.signups)));
  const mag = Math.pow(10, Math.floor(Math.log10(maxRev)));
  const niceMax = mag * Math.ceil(maxRev / mag);
  const cw = (W - padL - padR) / months.length, bw = Math.min(46, cw * 0.5);
  const y = v => H - padB - (v / niceMax) * (H - padB - padT);
  const ys = v => H - padB - (v / maxSign) * (H - padB - padT);
  const mName = ym => new Date(ym + '-15').toLocaleDateString(locale(), { month: 'short' });
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = niceMax * i / 4, yy = y(v);
    g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" class="ch-grid"/>' +
         '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" class="ch-axis" text-anchor="end">$' + Math.round(v).toLocaleString('en-US') + '</text>';
  }
  const pts = [];
  months.forEach((m, i) => {
    const cx = padL + cw * i + cw / 2, rv = Number(m.revenue);
    const top = y(rv);
    g += '<rect x="' + (cx - bw / 2) + '" y="' + top + '" width="' + bw + '" height="' + Math.max(0, H - padB - top) + '" rx="6" class="ch-bar' + (i === months.length - 1 ? ' is-now' : '') + '"><title>' + escapeHtml(fmtMoney(rv)) + '</title></rect>' +
         '<text x="' + cx + '" y="' + (H - 8) + '" class="ch-axis" text-anchor="middle">' + escapeHtml(mName(m.month)) + '</text>';
    if (rv > 0) g += '<text x="' + cx + '" y="' + (top - 6) + '" class="ch-val" text-anchor="middle">' + escapeHtml(fmtMoney(rv)) + '</text>';
    pts.push([cx, ys(Number(m.signups)), m.signups]);
  });
  g += '<polyline points="' + pts.map(p => p[0] + ',' + p[1]).join(' ') + '" class="ch-line"/>';
  pts.forEach(p => {
    g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" class="ch-dot"><title>' + p[2] + '</title></circle>';
    if (p[2] > 0) g += '<text x="' + (p[0] + 8) + '" y="' + (p[1] - 8) + '" class="ch-sign">' + p[2] + '</text>';
  });
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escapeHtml(t('Ingresos y registros')) + '">' + g + '</svg>';
}

function renderByProduct(bp) {
  const box = document.getElementById('adm-by-product');
  if (!box) return;
  const order = ['web-dev', '7st', 'semilla', 'ia', 'marketing'];
  box.innerHTML = order.filter(k => bp[k]).map(k => {
    const p = bp[k];
    return '<div class="adm-row"><span class="adm-row-name">' + escapeHtml(productTitle(k) || p.title) + '</span>' +
      '<span class="adm-row-val">' + p.students + ' <small>' + escapeHtml(t('estudiantes')) + '</small></span>' +
      '<span class="adm-row-val mono">' + fmtMoney(p.revenue) + '</span></div>';
  }).join('');
}

const FEED_ICON = { signup: 'i-plus', order: 'i-shield', certificate: 'i-award' };
function renderRecent(items) {
  const ul = document.getElementById('adm-recent');
  if (!ul) return;
  if (!items.length) { ul.innerHTML = '<li class="adm-feed-empty">' + escapeHtml(t('Todavía no hay actividad.')) + '</li>'; return; }
  ul.innerHTML = items.slice(0, 10).map(e => {
    let what;
    if (e.type === 'signup') what = t('Nuevo registro');
    else if (e.type === 'certificate') what = t('Certificado emitido') + ' · ' + (productTitle(e.product) || e.product);
    else what = t('Pago') + ' ' + fmtMoney(e.amount) + ' · ' + t((ORDER_STATUS[e.status] || [e.status])[0]);
    return '<li class="adm-feed-item is-' + e.type + '"><span class="adm-feed-ic"><svg><use href="#' + FEED_ICON[e.type] + '"/></svg></span>' +
      '<div><div class="adm-feed-title">' + escapeHtml(e.name || e.email || '—') + '</div><div class="adm-feed-sub">' + escapeHtml(what) + '</div></div>' +
      '<time>' + escapeHtml(timeAgo(e.at)) + '</time></li>';
  }).join('');
}

function timeAgo(at) {
  const s = (Date.now() - new Date(at).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return fmtDate(at);
}

async function renderHealth() {
  const ul = document.getElementById('adm-health');
  if (!ul) return;
  const [sec, es, en] = await Promise.all([
    sb.rpc('admin_secret_status'),
    sb.from('content').select('item_id', { count: 'exact', head: true }).eq('lang', 'es'),
    sb.from('content').select('item_id', { count: 'exact', head: true }).eq('lang', 'en')
  ]);
  const s = sec.data || {};
  const pay = SITE_CFG.payments || {};
  const sq = pay.square || {};
  const items = [
    [!!s.smtp_password, 'Correo de facturas', s.smtp_password ? 'Configurado' : 'Falta la contraseña de aplicación'],
    [pay.zelle && pay.zelle.enabled !== false && !!pay.zelle.email, 'Zelle', pay.zelle && pay.zelle.enabled !== false ? 'Activo' : 'Desactivado'],
    [!!(sq.enabled && s.square_access_token && sq.app_id && sq.location_id), 'Square', sq.enabled ? (s.square_access_token ? (sq.env === 'production' ? 'Producción' : 'Sandbox (pruebas)') : 'Faltan credenciales') : 'Desactivado'],
    [(es.count || 0) > 0 && es.count === en.count, 'Contenido ES / EN', (es.count || 0) + ' / ' + (en.count || 0) + ' ' + t('secciones')]
  ];
  ul.innerHTML = items.map(([ok, name, note]) =>
    '<li class="' + (ok ? 'is-ok' : 'is-warn') + '"><span class="adm-dot"></span><b>' + escapeHtml(t(name)) + '</b><span>' + escapeHtml(t(note)) + '</span></li>'
  ).join('');
}

// ── Pagos ────────────────────────────────────────────────────────────────────
async function loadOrders() {
  const { data, error } = await sb.rpc('admin_orders');
  if (error) { document.getElementById('adm-orders').innerHTML = '<div class="admin-empty is-error">' + escapeHtml(rpcError(error)) + '</div>'; return; }
  ADMIN_ORDERS = data || [];
  setPendingBadge(ADMIN_ORDERS.filter(o => o.status === 'pending').length);
  renderOrders();
  if (!allAdminUsers.length) sb.rpc('admin_students').then(r => { allAdminUsers = r.data || []; });
}

function setOrderFilter(f) {
  orderFilter = f;
  document.querySelectorAll('#adm-order-filter button').forEach(b => b.classList.toggle('is-active', b.dataset.f === f));
  renderOrders();
}

function renderOrders() {
  const box = document.getElementById('adm-orders');
  const q = (document.getElementById('adm-order-search').value || '').toLowerCase().trim();
  const rows = ADMIN_ORDERS.filter(o => (orderFilter === 'all' || o.status === orderFilter) &&
    (!q || [o.full_name, o.email, o.reference, o.payer_name, o.invoice_number].some(v => String(v || '').toLowerCase().includes(q))));
  if (!rows.length) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(t(orderFilter === 'pending' ? 'No hay pagos por verificar. ¡Todo al día!' : 'No hay pagos en esta vista.')) + '</div>';
    return;
  }
  box.innerHTML = rows.map(o => {
    const st = ORDER_STATUS[o.status] || [o.status, ''];
    const id = String(o.id).replace(/[^a-f0-9-]/g, '');
    let actions = '';
    if (o.status === 'pending') {
      actions = '<button class="ui-btn ui-btn--primary ui-btn--sm" onclick="verifyOrder(\'' + id + '\', this)">' + escapeHtml(t('Verificar y activar')) + '</button>' +
                '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="rejectOrder(\'' + id + '\', this)">' + escapeHtml(t('Rechazar')) + '</button>';
    } else if (o.status === 'verified') {
      actions = '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="resendInvoice(\'' + id + '\', this)">' + escapeHtml(t(o.invoice_sent_at ? 'Reenviar factura' : 'Enviar factura')) + '</button>';
    }
    return '<article class="adm-order is-' + o.status + '">' +
      '<div class="adm-order-who"><div class="adm-order-name">' + escapeHtml(o.full_name || '—') + '</div><div class="adm-order-mail">' + escapeHtml(o.email) + '</div></div>' +
      '<div class="adm-order-what"><div>' + escapeHtml(LANG === 'en' ? (o.product_title_en || o.product_title) : o.product_title) + '</div>' +
        '<div class="adm-order-meta">' + escapeHtml(t(METHOD_LABEL[o.method] || o.method)) + ' · ' + escapeHtml(fmtDate(o.created_at)) +
        (o.payer_name ? ' · ' + escapeHtml(t('Titular')) + ': ' + escapeHtml(o.payer_name) : '') + '</div></div>' +
      '<div class="adm-order-ref"><span>' + escapeHtml(t('Confirmación')) + '</span><code>' + escapeHtml(o.reference || '—') + '</code>' +
        (o.invoice_number ? '<span class="adm-order-inv">' + escapeHtml(o.invoice_number) + (o.invoice_sent_at ? ' · ' + escapeHtml(t('enviada')) : '') + '</span>' : '') + '</div>' +
      '<div class="adm-order-amt">' + fmtMoney(o.amount) + '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span></div>' +
      '<div class="adm-order-actions">' + actions + '</div>' +
    '</article>';
  }).join('');
}

async function verifyOrder(id, btn) {
  const o = ADMIN_ORDERS.find(x => x.id === id);
  if (!o) return;
  const msg = t('¿Confirmas que recibiste') + ' ' + fmtMoney(o.amount) + ' — ' + (o.payer_name || o.full_name || o.email) +
    ' (' + t('confirmación') + ' ' + o.reference + ')? ' + t('Se activará el acceso y se enviará la factura.');
  if (!confirm(msg)) return;
  btn.disabled = true;
  const { error } = await sb.rpc('admin_verify_order', { order_id: id });
  if (error) { btn.disabled = false; toast(rpcError(error)); return; }
  try { await invokePayments({ action: 'send_invoice', order_id: id }); toast(t('Pago verificado. Factura enviada.')); }
  catch (e) { toast(t('Pago verificado, pero la factura no se envió: ') + e.message); }
  loadOrders();
}

async function rejectOrder(id, btn) {
  const reason = prompt(t('Motivo (se le enviará al estudiante, opcional):'), '');
  if (reason === null) return;
  btn.disabled = true;
  const { error } = await sb.rpc('admin_reject_order', { order_id: id, reason });
  if (error) { btn.disabled = false; toast(rpcError(error)); return; }
  invokePayments({ action: 'order_rejected', order_id: id }).catch(() => {});
  toast(t('Pago rechazado. Avisamos al estudiante.'));
  loadOrders();
}

async function resendInvoice(id, btn) {
  btn.disabled = true;
  try { await invokePayments({ action: 'send_invoice', order_id: id }); toast(t('Factura enviada')); loadOrders(); }
  catch (e) { btn.disabled = false; toast(e.message); }
}

// Registrar un pago recibido fuera de la web (o un Zelle sin pedido)
function toggleManualPay(on) {
  const f = document.getElementById('adm-manual');
  f.hidden = !on;
  if (!on) return;
  const dl = document.getElementById('mp-user-list');
  dl.innerHTML = allAdminUsers.filter(u => !u.is_admin).map(u => '<option value="' + escapeHtml(u.email) + '">' + escapeHtml(u.full_name || '') + '</option>').join('');
  const sel = document.getElementById('mp-product');
  sel.innerHTML = Object.values(SITE_CFG.products).filter(p => p.status === 'available')
    .map(p => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(productTitle(p.id)) + '</option>').join('');
  const fill = () => { const p = SITE_CFG.products[sel.value]; document.getElementById('mp-amount').value = p && p.price_usd != null ? p.price_usd : ''; };
  sel.onchange = fill; fill();
  document.getElementById('mp-user').focus();
}

async function saveManualPay() {
  const email = document.getElementById('mp-user').value.trim().toLowerCase();
  const u = allAdminUsers.find(x => (x.email || '').toLowerCase() === email);
  if (!u) { toast(t('No hay ningún estudiante con ese correo.')); return; }
  const btn = document.getElementById('mp-save');
  btn.disabled = true;
  const { data, error } = await sb.rpc('admin_record_payment', {
    uid: u.id, p: document.getElementById('mp-product').value, method: document.getElementById('mp-method').value,
    amount: Number(document.getElementById('mp-amount').value) || 0, reference: document.getElementById('mp-ref').value.trim()
  });
  btn.disabled = false;
  if (error) { toast(rpcError(error)); return; }
  if (document.getElementById('mp-invoice').checked) {
    invokePayments({ action: 'send_invoice', order_id: data.id }).then(() => toast(t('Factura enviada')), e => toast(e.message));
  }
  toast(t('Pago registrado y acceso activado'));
  document.getElementById('adm-manual').reset();
  toggleManualPay(false);
  setOrderFilter('verified');
  loadOrders();
}

// ── Conciliación semanal ─────────────────────────────────────────────────────
function weekLabel(w) {
  const f = d => new Date(d + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return f(w.week_start) + ' – ' + f(w.week_end);
}

async function loadWeekly() {
  const weeks = Number(document.getElementById('rec-weeks').value) || 12;
  const [wk, od] = await Promise.all([sb.rpc('admin_weekly_income', { weeks }), sb.rpc('admin_orders')]);
  if (wk.error) { toast(rpcError(wk.error)); return; }
  WEEKLY = wk.data || [];
  ADMIN_ORDERS = od.data || ADMIN_ORDERS;
  const cur = WEEKLY[0] || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('rec-week-total', fmtMoney(cur.total));
  set('rec-week-range', cur.week_start ? weekLabel(cur) : '—');
  set('rec-week-zelle', fmtMoney(cur.zelle));
  const nPay = n => (n || 0) + ' ' + t(n === 1 ? 'pago' : 'pagos');
  set('rec-week-zelle-n', nPay(cur.count_zelle));
  set('rec-week-square', fmtMoney(cur.square));
  set('rec-week-square-n', nPay(cur.count_square));
  const unrec = ADMIN_ORDERS.filter(o => o.status === 'verified' && !o.reconciled_at);
  set('rec-unrec', unrec.length);
  set('rec-unrec-amt', fmtMoney(unrec.reduce((a, o) => a + Number(o.amount), 0)) + ' ' + t('por revisar'));

  const tb = document.querySelector('#rec-table tbody');
  tb.innerHTML = WEEKLY.map((w, i) => {
    const full = w.count && w.reconciled === w.count;
    return '<tr class="' + (w.count ? 'is-click' : 'is-empty') + (recWeek === w.week_start ? ' is-sel' : '') + '"' + (w.count ? ' onclick="openWeek(\'' + w.week_start + '\')"' : '') + '>' +
      '<td><b>' + escapeHtml(weekLabel(w)) + '</b>' + (i === 0 ? ' <span class="chip chip--accent">' + escapeHtml(t('Actual')) + '</span>' : '') + '</td>' +
      '<td class="num">' + fmtMoney(w.zelle) + '</td><td class="num">' + fmtMoney(w.square) + '</td><td class="num">' + fmtMoney(w.manual) + '</td>' +
      '<td class="num"><b>' + fmtMoney(w.total) + '</b></td><td class="num">' + w.count + '</td>' +
      '<td>' + (w.count ? '<span class="rec-pill ' + (full ? 'is-ok' : 'is-warn') + '">' + w.reconciled + ' / ' + w.count + '</span>' : '<span class="adm-muted">—</span>') + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="adm-td-empty">' + escapeHtml(t('Sin datos')) + '</td></tr>';
  const sum = k => WEEKLY.reduce((a, w) => a + Number(w[k] || 0), 0);
  tb.insertAdjacentHTML('beforeend', '<tr class="is-total"><td>' + escapeHtml(t('Total del periodo')) + '</td><td class="num">' + fmtMoney(sum('zelle')) + '</td><td class="num">' + fmtMoney(sum('square')) +
    '</td><td class="num">' + fmtMoney(sum('manual')) + '</td><td class="num"><b>' + fmtMoney(sum('total')) + '</b></td><td class="num">' + sum('count') + '</td><td>' + sum('reconciled') + ' / ' + sum('count') + '</td></tr>');
  if (recWeek) openWeek(recWeek, true);
}

// Día del pago en hora de Florida (igual que agrupa el servidor)
const flDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
function ordersOfWeek(ws) {
  const w = WEEKLY.find(x => x.week_start === ws);
  const end = w ? w.week_end : ws;
  return ADMIN_ORDERS.filter(o => o.status === 'verified' && o.verified_at && flDay(o.verified_at) >= ws && flDay(o.verified_at) <= end)
    .sort((a, b) => new Date(a.verified_at) - new Date(b.verified_at));
}

function openWeek(ws, keep) {
  recWeek = ws;
  const w = WEEKLY.find(x => x.week_start === ws);
  const box = document.getElementById('rec-detail');
  box.hidden = false;
  document.getElementById('rec-detail-title').textContent = t('Pagos de la semana') + ' · ' + (w ? weekLabel(w) : ws);
  document.querySelectorAll('#rec-table tbody tr').forEach(tr => tr.classList.remove('is-sel'));
  const rows = ordersOfWeek(ws);
  document.getElementById('rec-detail-body').innerHTML = rows.map(o => {
    const id = String(o.id).replace(/[^a-f0-9-]/g, '');
    return '<tr class="' + (o.reconciled_at ? 'is-rec' : '') + '">' +
      '<td><label class="rec-check"><input type="checkbox"' + (o.reconciled_at ? ' checked' : '') + ' onchange="reconcile(\'' + id + '\', this.checked, this)"><span></span></label></td>' +
      '<td>' + escapeHtml(new Date(o.verified_at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</td>' +
      '<td><div class="adm-order-name">' + escapeHtml(o.full_name || '—') + '</div><div class="adm-order-mail">' + escapeHtml(o.email) + '</div></td>' +
      '<td><span class="method-tag is-' + o.method + '">' + escapeHtml(t(METHOD_LABEL[o.method] || o.method)) + '</span></td>' +
      '<td><code>' + escapeHtml(o.reference || o.external_id || '—') + '</code>' + (o.payer_name ? '<div class="adm-order-mail">' + escapeHtml(o.payer_name) + '</div>' : '') + '</td>' +
      '<td class="num"><b>' + fmtMoney(o.amount) + '</b></td>' +
      '<td class="mono">' + escapeHtml(o.invoice_number || '—') + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="adm-td-empty">' + escapeHtml(t('Sin pagos esta semana')) + '</td></tr>';
  if (!keep) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function reconcile(id, done, input) {
  input.disabled = true;
  const { data, error } = await sb.rpc('admin_reconcile_order', { order_id: id, done, note: '' });
  input.disabled = false;
  if (error) { input.checked = !done; toast(rpcError(error)); return; }
  const o = ADMIN_ORDERS.find(x => x.id === id);
  if (o) o.reconciled_at = data.reconciled_at;
  loadWeekly();
}

async function reconcileWeek() {
  const rows = ordersOfWeek(recWeek).filter(o => !o.reconciled_at);
  if (!rows.length) { toast(t('Esta semana ya está conciliada')); return; }
  if (!confirm(t('¿Marcar') + ' ' + rows.length + ' ' + t('pagos como conciliados?'))) return;
  for (const o of rows) await sb.rpc('admin_reconcile_order', { order_id: o.id, done: true, note: '' });
  toast(t('Semana conciliada'));
  loadWeekly();
}

function csvDownload(name, headers, rows) {
  const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = [headers, ...rows].map(r => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Exporta cada pago verificado del periodo (para cruzarlo con el banco)
function exportWeeklyCSV() {
  const en = LANG === 'en';
  const from = WEEKLY.length ? WEEKLY[WEEKLY.length - 1].week_start : '';
  const rows = ADMIN_ORDERS.filter(o => o.status === 'verified' && o.verified_at && flDay(o.verified_at) >= from)
    .sort((a, b) => new Date(a.verified_at) - new Date(b.verified_at))
    .map(o => [flDay(o.verified_at), o.full_name, o.email, o.product_id, METHOD_LABEL[o.method] || o.method,
      o.reference || '', o.payer_name || '', o.external_id || '', Number(o.amount).toFixed(2), o.invoice_number || '',
      o.reconciled_at ? (en ? 'Yes' : 'Sí') : 'No']);
  csvDownload('dgp-academy-ingresos.csv',
    en ? ['Date', 'Name', 'Email', 'Product', 'Method', 'Reference', 'Payer', 'Square ID', 'Amount USD', 'Invoice', 'Reconciled']
       : ['Fecha', 'Nombre', 'Email', 'Producto', 'Método', 'Referencia', 'Titular', 'ID Square', 'Monto USD', 'Factura', 'Conciliado'], rows);
}

async function emailWeekly() {
  const weeks = Math.min(26, Number(document.getElementById('rec-weeks').value) || 12);
  try { await invokePayments({ action: 'weekly_report', weeks }); toast(t('Resumen enviado a tu correo')); }
  catch (e) { toast(e.message); }
}

// ── Configuración ────────────────────────────────────────────────────────────
const val = id => document.getElementById(id).value.trim();
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
const chk = id => document.getElementById(id).checked;
let CFG = {};

async function loadConfig() {
  const [st, sec, pr] = await Promise.all([
    sb.from('settings').select('key, value'),
    sb.rpc('admin_secret_status'),
    sb.from('products').select('id, price_usd, regular_price_usd')
  ]);
  CFG = {};
  (st.data || []).forEach(r => { CFG[r.key] = r.value; });
  const pay = CFG.payments || {}, z = pay.zelle || {}, sq = pay.square || {}, em = CFG.email || {}, bi = CFG.billing || {}, co = CFG.contact || {}, an = CFG.announcement || {}, cu = CFG.cupos || {};
  (pr.data || []).forEach(x => { setVal('cf-price-' + x.id, x.price_usd); if (x.id === 'pase') setVal('cf-regular-pase', x.regular_price_usd); });
  setVal('cf-cupos-total', cu.total || 20);
  loadCuposPublic().then(v => setVal('cf-cupos-taken', v.taken + ' / ' + v.total));
  setChk('cf-zelle-on', z.enabled !== false); setVal('cf-zelle-email', z.email); setVal('cf-zelle-phone', z.phone); setVal('cf-zelle-holder', z.holder);
  setVal('cf-zelle-ins-es', z.instructions_es); setVal('cf-zelle-ins-en', z.instructions_en);
  setChk('cf-sq-on', sq.enabled); setVal('cf-sq-env', sq.env || 'sandbox'); setVal('cf-sq-app', sq.app_id); setVal('cf-sq-loc', sq.location_id); setVal('cf-sq-token', '');
  setVal('cf-mail-from', em.from_email); setVal('cf-mail-name', em.from_name); setChk('cf-mail-notify', em.notify_admin !== false); setVal('cf-smtp-pass', '');
  setVal('cf-bill-company', bi.company); setVal('cf-bill-tax', bi.tax_id); setVal('cf-bill-address', bi.address); setVal('cf-bill-foot-es', bi.footer_es); setVal('cf-bill-foot-en', bi.footer_en);
  setVal('cf-contact-email', co.email); setVal('cf-contact-wa', co.whatsapp);
  setVal('cf-ann-es', an.es); setVal('cf-ann-en', an.en); setChk('cf-ann-on', an.enabled);
  const s = sec.data || {};
  const status = (id, k) => {
    const el = document.getElementById(id);
    el.textContent = s[k] ? t('guardado') + ' ' + s[k].hint : t('sin configurar');
    el.classList.toggle('is-set', !!s[k]);
  };
  status('cf-sq-token-status', 'square_access_token');
  status('cf-smtp-status', 'smtp_password');
  status('cf-sq-hook-status', 'square_webhook_key');
  status('cf-ai-status', 'groq_api_key');
  const ai = CFG.ai || {};
  setChk('cf-ai-on', ai.enabled !== false); setVal('cf-ai-model', ai.model || 'llama-3.3-70b-versatile'); setVal('cf-ai-free', ai.free_monthly != null ? ai.free_monthly : 3); setVal('cf-ai-key', '');
  setVal('cf-sq-hook', '');
}

async function saveSetting(key, value) {
  const { error } = await sb.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
  CFG[key] = value;
  if (['payments', 'contact', 'announcement', 'membership'].includes(key)) SITE_CFG[key] = value;
}

async function savePrices() {
  try {
    for (const id of ['pase', 'web-dev', 'ia', '7st', 'semilla']) {
      const price = Number(val('cf-price-' + id));
      if (!(price > 0)) throw new Error(t('Escribe un precio válido'));
      const regular = id === 'pase' && val('cf-regular-pase') ? Number(val('cf-regular-pase')) : null;
      const { error } = await sb.rpc('admin_set_price', { p: id, price, regular });
      if (error) throw error;
      SITE_CFG.products[id] = Object.assign({}, SITE_CFG.products[id], { price_usd: price, regular_price_usd: regular });
    }
    const total = Math.max(1, parseInt(val('cf-cupos-total')) || 20);
    await saveSetting('cupos', { total });
    const v = await loadCuposPublic();
    cuposTotal = v.total;
    updateLpCupos(v.disponibles, v.total);
    setVal('cf-cupos-taken', v.taken + ' / ' + v.total);
    renderLandingPrice();
    flash('cf-prices-msg', 'Guardado');
  } catch (e) { flash('cf-prices-msg', rpcError(e), true); }
}

async function saveZelle() {
  try {
    const pay = Object.assign({ currency: 'USD' }, CFG.payments);
    pay.zelle = { enabled: chk('cf-zelle-on'), email: val('cf-zelle-email'), phone: val('cf-zelle-phone'), holder: val('cf-zelle-holder'),
      instructions_es: val('cf-zelle-ins-es'), instructions_en: val('cf-zelle-ins-en') };
    await saveSetting('payments', pay);
    flash('cf-zelle-msg', 'Guardado');
  } catch (e) { flash('cf-zelle-msg', rpcError(e), true); }
}

async function saveSquare() {
  try {
    const token = document.getElementById('cf-sq-token').value.trim();
    const pay = Object.assign({ currency: 'USD' }, CFG.payments);
    pay.square = { enabled: chk('cf-sq-on'), env: val('cf-sq-env'), app_id: val('cf-sq-app'), location_id: val('cf-sq-loc') };
    if (pay.square.enabled && (!pay.square.app_id || !pay.square.location_id)) throw new Error(t('Para activar Square faltan el Application ID y el Location ID'));
    if (pay.square.app_id && pay.square.env === 'sandbox' && !/^sandbox-/.test(pay.square.app_id)) throw new Error(t('Ese Application ID es de producción: cambia el entorno a Producción'));
    if (token) {
      const { error } = await sb.rpc('admin_set_secret', { k: 'square_access_token', v: token });
      if (error) throw error;
    }
    const hook = document.getElementById('cf-sq-hook').value.trim();
    if (hook) {
      const { error } = await sb.rpc('admin_set_secret', { k: 'square_webhook_key', v: hook });
      if (error) throw error;
    }
    await saveSetting('payments', pay);
    flash('cf-sq-msg', 'Guardado');
    loadConfig();
  } catch (e) { flash('cf-sq-msg', rpcError(e), true); }
}

async function saveEmail() {
  try {
    const pass = document.getElementById('cf-smtp-pass').value.replace(/\s+/g, '');
    if (pass) {
      const { error } = await sb.rpc('admin_set_secret', { k: 'smtp_password', v: pass });
      if (error) throw error;
    }
    await saveSetting('email', Object.assign({}, CFG.email, { from_email: val('cf-mail-from'), from_name: val('cf-mail-name'), notify_admin: chk('cf-mail-notify') }));
    flash('cf-mail-msg', 'Guardado');
    loadConfig();
  } catch (e) { flash('cf-mail-msg', rpcError(e), true); }
}

async function testEmail() {
  flash('cf-mail-msg', 'Enviando…');
  try { await invokePayments({ action: 'test_email' }); flash('cf-mail-msg', 'Correo de prueba enviado. Revisa tu bandeja.'); }
  catch (e) { flash('cf-mail-msg', e.message, true); }
}

async function saveBilling() {
  try {
    await saveSetting('billing', Object.assign({}, CFG.billing, { company: val('cf-bill-company'), tax_id: val('cf-bill-tax'), address: val('cf-bill-address'),
      footer_es: val('cf-bill-foot-es'), footer_en: val('cf-bill-foot-en') }));
    flash('cf-bill-msg', 'Guardado');
  } catch (e) { flash('cf-bill-msg', rpcError(e), true); }
}

async function saveSite() {
  try {
    const wa = val('cf-contact-wa').replace(/\D/g, '');
    await saveSetting('contact', { email: val('cf-contact-email'), whatsapp: wa });
    await saveSetting('announcement', { es: val('cf-ann-es'), en: val('cf-ann-en'), enabled: chk('cf-ann-on') });
    CONTACT.email = val('cf-contact-email') || CONTACT.email; CONTACT.whatsapp = wa;
    renderAnnouncement(); renderActivation();
    flash('cf-site-msg', 'Guardado');
  } catch (e) { flash('cf-site-msg', rpcError(e), true); }
}

async function saveAI() {
  try {
    const key = document.getElementById('cf-ai-key').value.trim();
    if (key) {
      const { error } = await sb.rpc('admin_set_secret', { k: 'groq_api_key', v: key });
      if (error) throw error;
    }
    await saveSetting('ai', Object.assign({}, CFG.ai, { enabled: chk('cf-ai-on'), model: val('cf-ai-model'), free_monthly: Math.max(0, parseInt(val('cf-ai-free')) || 0) }));
    flash('cf-ai-msg', 'Guardado');
    loadConfig();
  } catch (e) { flash('cf-ai-msg', rpcError(e), true); }
}

async function testAI() {
  flash('cf-ai-msg', 'Probando…');
  try {
    const { data, error } = await sb.functions.invoke('coach', { body: { action: 'test' } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j.error) m = j.error; } catch (x) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    flash('cf-ai-msg', 'La IA responde correctamente');
  } catch (e) { flash('cf-ai-msg', e.message, true); }
}
