// =========================================================
// DGP Academy — panel admin: membresías
// Miembros y su encuesta, cola de flyers (subir archivo y entregar),
// asesorías (agendar con enlace), sorteo mensual, contenido exclusivo y planes.
// =========================================================

let MK = { subscriptions: [], flyers: [], meetings: [], raffles: [], posts: [] };
let mkCurrent = 'miembros', mkUploadId = null;

const SV_LABEL = {
  mas_clientes: 'Más clientes', redes: 'Crecer en redes', marca: 'Imagen profesional', ventas_online: 'Vender en línea',
  lanzar: 'Lanzar algo nuevo', organizar: 'Organizarse', idea: 'Idea', nuevo: 'Empezando', creciendo: 'Creciendo', establecido: 'Establecido'
};

async function loadMembersAdmin() {
  if (!allAdminUsers.length) { const r = await sb.rpc('admin_students'); allAdminUsers = r.data || []; }
  const dl = document.getElementById('mp-user-list');
  if (dl && !dl.options.length) dl.innerHTML = allAdminUsers.filter(u => !u.is_admin).map(u => '<option value="' + escapeHtml(u.email) + '">' + escapeHtml(u.full_name || '') + '</option>').join('');
  const [{ data, error }, plans, court, slots] = await Promise.all([sb.rpc('admin_members'), sb.from('plans').select('*').order('position'), sb.from('courtesy').select('*').order('created_at', { ascending: false }),
    sb.from('meeting_slots').select('id, starts_at, minutes, booked_by').gte('starts_at', new Date().toISOString()).order('starts_at').limit(200)]);
  if (error) { document.getElementById('mk-body').innerHTML = '<div class="admin-empty is-error">' + escapeHtml(rpcError(error)) + '</div>'; return; }
  MK = data;
  MK.plans = plans.data || [];
  MK.courtesy = court.data || [];
  MK.slots = slots.data || [];
  const now = Date.now();
  const active = MK.subscriptions.filter(s => ['active', 'past_due'].includes(s.status) && new Date(s.current_period_end).getTime() > now);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('mk-mrr', fmtMoney(active.filter(s => !s.cancel_at_period_end).reduce((a, s) => a + Number(s.price_usd), 0)));
  set('mk-mrr-foot', active.filter(s => s.method === 'square' && !s.cancel_at_period_end).length + ' ' + t('con cobro automático'));
  set('mk-active', active.length);
  set('mk-by-plan', MK.plans.map(p => p.name + ' ' + active.filter(s => s.plan_id === p.id).length).join(' · '));
  const fPend = MK.flyers.filter(f => f.status !== 'delivered'), mPend = MK.meetings.filter(m => m.status === 'requested');
  set('mk-flyers', fPend.length);
  set('mk-flyers-foot', MK.flyers.filter(f => f.status === 'revision').length + ' ' + t('con cambios pedidos'));
  set('mk-meetings', mPend.length);
  set('mk-meetings-foot', MK.meetings.filter(m => m.status === 'scheduled').length + ' ' + t('agendadas'));
  const badge = document.getElementById('adm-member-badge');
  if (badge) { badge.hidden = !(fPend.length + mPend.length); badge.textContent = fPend.length + mPend.length; }
  mkView(mkCurrent);
}

function mkView(v) {
  mkCurrent = v;
  document.querySelectorAll('#mk-sub button').forEach(b => b.classList.toggle('is-active', b.dataset.v === v));
  const body = document.getElementById('mk-body');
  body.innerHTML = ({ miembros: mkMembers, flyers: mkFlyers, asesorias: mkMeetings, sorteos: mkRaffles, contenido: mkPosts, planes: mkPlans, cortesia: mkCourtesy }[v])();
}

const cleanId = id => String(id).replace(/[^a-f0-9-]/g, '');

// ── Miembros ──
function mkMembers() {
  if (!MK.subscriptions.length) return '<div class="admin-empty">' + escapeHtml(t('Todavía no hay miembros. Cuando alguien se suscriba aparecerá aquí con su encuesta.')) + '</div>';
  return '<div class="mk-list">' + MK.subscriptions.map(s => {
    const sv = s.survey || {};
    const live = ['active', 'past_due'].includes(s.status) && new Date(s.current_period_end) > new Date();
    const st = !live ? ['Vencida', 'is-rejected'] : s.status === 'past_due' ? ['Pago pendiente', 'is-pending'] : s.cancel_at_period_end ? ['No renueva', 'is-pending'] : ['Activa', 'is-paid'];
    const goals = (sv.goals || []).map(g => t(SV_LABEL[g] || g)).join(', ');
    return '<details class="mk-member"><summary>' +
      '<div class="adm-order-who"><div class="adm-order-name">' + escapeHtml(s.full_name || '—') + '</div><div class="adm-order-mail">' + escapeHtml(s.email) + (s.phone ? ' · ' + escapeHtml(s.phone) : '') + '</div></div>' +
      '<div><b>' + escapeHtml(s.plan_name) + '</b> · ' + fmtMoney(s.price_usd) + '<div class="adm-order-mail">' + escapeHtml(t(METHOD_LABEL[s.method] || s.method)) + ' · ' + escapeHtml(t('hasta')) + ' ' + escapeHtml(fmtDate(s.current_period_end)) + '</div></div>' +
      '<div class="mk-usage"><span>' + escapeHtml(t('Flyers')) + ' <b>' + s.flyers_used + '/' + s.flyers + '</b></span><span>' + escapeHtml(t('Asesorías')) + ' <b>' + s.meetings_used + '/' + s.meetings + '</b></span></div>' +
      '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span></summary>' +
      (s.survey ? '<div class="mk-survey">' +
        mkRow('Tipo', sv.kind === 'business' ? t('Negocio') : t('Personal')) + mkRow('Negocio', sv.business_name) + mkRow('Rubro', sv.industry) +
        mkRow('Qué ofrece', sv.description) + mkRow('Ciudad', sv.city) + mkRow('Etapa', t(SV_LABEL[sv.stage] || sv.stage)) + mkRow('Cliente ideal', sv.audience) +
        mkRow('Objetivos', goals) + mkRow('Canales', (sv.channels || []).join(', ')) + mkRow('Logo', sv.has_logo ? t('Sí') : t('No')) +
        mkRow('Colores', sv.brand_colors) + mkRow('Estilo', sv.tone) + mkRow('Web', sv.website) + mkRow('Redes', sv.social) + mkRow('Notas', sv.notes) +
        '</div>' : '<p class="mb-empty">' + escapeHtml(t('Aún no completa la encuesta.')) + '</p>') +
      '</details>';
  }).join('') + '</div>';
}
function mkRow(k, v) { return v ? '<div class="mk-row"><span>' + escapeHtml(t(k)) + '</span><b>' + escapeHtml(v) + '</b></div>' : ''; }

// ── Flyers ──
const FMT = { post: 'Post 1080×1080', story: 'Historia 1080×1920', flyer: 'Flyer carta', banner: 'Banner' };
function mkFlyers() {
  if (!MK.flyers.length) return '<div class="admin-empty">' + escapeHtml(t('No hay flyers solicitados.')) + '</div>';
  const order = { revision: 0, requested: 1, in_progress: 2, delivered: 3 };
  return '<div class="mk-list">' + MK.flyers.slice().sort((a, b) => order[a.status] - order[b.status]).map(f => {
    const st = FLYER_STATUS[f.status] || [f.status, ''];
    const id = cleanId(f.id);
    return '<article class="mk-card">' +
      '<div class="mk-card-top"><div><b>' + escapeHtml(f.title) + '</b><div class="adm-order-mail">' + escapeHtml(f.business_name || f.full_name || f.email) + ' · ' + escapeHtml(f.industry || '') + '</div></div>' +
      '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span></div>' +
      '<div class="mk-survey">' + mkRow('Formato', t(FMT[f.format] || f.format)) + mkRow('Objetivo', f.purpose) + mkRow('Texto principal', f.headline) + mkRow('Detalles', f.details) +
        mkRow('Para', f.deadline ? fmtDate(f.deadline + 'T12:00:00') : '') + mkRow('Pedido', fmtDate(f.created_at)) + mkRow('Nota', f.admin_note) + '</div>' +
      '<label class="adm-field"><span>' + escapeHtml(t('Texto sugerido para publicar (opcional)')) + '</span><textarea class="form-input" id="cap-' + id + '" rows="2">' + escapeHtml(f.caption || '') + '</textarea></label>' +
      '<div class="adm-form-actions">' +
        (f.file_path ? '<span class="admin-ok">' + escapeHtml(t('Archivo subido')) + '</span>' : '') +
        (f.status === 'requested' || f.status === 'revision' ? '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="setFlyer(\'' + id + '\',\'in_progress\')">' + escapeHtml(t('Marcar en diseño')) + '</button>' : '') +
        '<button class="ui-btn ui-btn--primary ui-btn--sm" onclick="pickFlyerFile(\'' + id + '\')">' + escapeHtml(t(f.status === 'delivered' ? 'Reemplazar archivo' : 'Subir y entregar')) + '</button>' +
      '</div></article>';
  }).join('') + '</div>';
}

async function setFlyer(id, status, filePath) {
  const cap = document.getElementById('cap-' + id);
  const { error } = await sb.rpc('admin_update_flyer', { flyer_id: id, status, file_path: filePath || null, note: null, caption: cap ? cap.value.trim() : null });
  if (error) { toast(rpcError(error)); return false; }
  return true;
}
function pickFlyerFile(id) { mkUploadId = id; const i = document.getElementById('mk-file'); i.value = ''; i.click(); }
async function uploadFlyerFile(input) {
  const file = input.files[0], id = mkUploadId;
  if (!file || !id) return;
  const f = MK.flyers.find(x => x.id === id);
  if (file.size > 25 * 1024 * 1024) { toast(t('El archivo pesa más de 25 MB')); return; }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = f.user_id + '/' + id + '-' + Date.now() + '.' + ext;
  toast(t('Subiendo…'));
  const { error } = await sb.storage.from('flyers').upload(path, file, { contentType: file.type, upsert: false });
  if (error) { toast(error.message); return; }
  if (!(await setFlyer(id, 'delivered', path))) return;
  invokePayments({ action: 'member_notify', type: 'flyer', id }).then(() => toast(t('Flyer entregado. Avisamos al miembro.')), e => toast(t('Flyer entregado, pero el correo no salió: ') + e.message));
  loadMembersAdmin();
}

// ── Asesorías ──
// ── Horarios de asesoría: el equipo los publica y el estudiante elige ──
function mkSlots() {
  const today = new Date(); const iso = d => d.toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5);
  const days = (LANG === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D']).map((l, i) => [String(i + 1), l]);
  const tzs = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/Bogota', 'America/Lima'];
  const who = id => { const u = allAdminUsers.find(x => x.id === id); return u ? (u.full_name || u.email) : t('Reservado'); };
  const byDay = {};
  MK.slots.forEach(sl => { const k = new Date(sl.starts_at).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }); (byDay[k] = byDay[k] || []).push(sl); });
  return '<form class="adm-card" onsubmit="event.preventDefault();addSlots()">' +
      '<div class="adm-card-head"><h2>' + escapeHtml(t('Horarios disponibles')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Publica tus horarios y cada estudiante elige día y hora desde su panel.')) + '</span></div>' +
      '<div class="adm-form-grid">' +
        '<label class="adm-field"><span>' + escapeHtml(t('Desde')) + '</span><input class="form-input" type="date" id="sl-from" value="' + iso(today) + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Hasta')) + '</span><input class="form-input" type="date" id="sl-to" value="' + iso(in30) + '"></label>' +
        '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Días')) + '</span><div class="sl-days">' + days.map(([v, l]) => '<label><input type="checkbox" value="' + v + '"' + (Number(v) <= 5 ? ' checked' : '') + '><span>' + escapeHtml(l) + '</span></label>').join('') + '</div></div>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Horas (separadas por coma)')) + '</span><input class="form-input" id="sl-times" value="10:00, 11:00, 16:00" placeholder="10:00, 11:30, 16:00"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Duración')) + '</span><select class="form-input" id="sl-min"><option value="30">30 min</option><option value="45" selected>45 min</option><option value="60">60 min</option></select></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Zona horaria')) + '</span><select class="form-input" id="sl-tz">' + tzs.map(z => '<option>' + z + '</option>').join('') + '</select></label>' +
      '</div>' +
      '<div class="adm-form-actions"><span class="admin-ok" id="sl-msg"></span><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Publicar horarios')) + '</button></div>' +
      '<div class="sl-list">' + (MK.slots.length ? Object.entries(byDay).map(([d, list]) =>
        '<div class="sl-day"><b>' + escapeHtml(d) + '</b><div>' + list.map(sl => {
          const tm = new Date(sl.starts_at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
          return sl.booked_by
            ? '<span class="sl-chip is-booked" title="' + escapeHtml(who(sl.booked_by)) + '">' + tm + ' · ' + escapeHtml(who(sl.booked_by)) + '</span>'
            : '<span class="sl-chip">' + tm + '<button type="button" onclick="deleteSlot(\'' + cleanId(sl.id) + '\')" aria-label="' + escapeHtml(t('Quitar')) + '">×</button></span>';
        }).join('') + '</div></div>').join('') : '<div class="admin-empty">' + escapeHtml(t('Todavía no publicaste horarios.')) + '</div>') + '</div>' +
    '</form>';
}
async function addSlots() {
  const weekdays = [...document.querySelectorAll('.sl-days input:checked')].map(i => Number(i.value));
  const times = document.getElementById('sl-times').value.split(',').map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x));
  if (!weekdays.length || !times.length) { flash('sl-msg', t('Elige al menos un día y una hora válida (ej. 10:00)'), true); return; }
  const { data, error } = await sb.rpc('admin_add_slots', { from_date: document.getElementById('sl-from').value, to_date: document.getElementById('sl-to').value, weekdays, times, minutes: Number(document.getElementById('sl-min').value), tz: document.getElementById('sl-tz').value });
  if (error) { flash('sl-msg', rpcError(error), true); return; }
  toast(data + ' ' + t('horarios publicados'));
  await loadMembersAdmin(); mkView('asesorias');
}
async function deleteSlot(id) {
  const { error } = await sb.rpc('admin_delete_slot', { slot: id });
  if (error) { toast(rpcError(error)); return; }
  MK.slots = MK.slots.filter(x => x.id !== id); mkView('asesorias');
}

function mkMeetings() {
  if (!MK.meetings.length) return mkSlots() + '<div class="admin-empty">' + escapeHtml(t('No hay asesorías solicitadas.')) + '</div>';
  const defUrl = ((SITE_CFG.membership || {}).meet_url || '');
  const toLocal = d => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  return mkSlots() + '<div class="mk-list">' + MK.meetings.map(m => {
    const st = MEETING_STATUS[m.status] || [m.status, ''];
    const id = cleanId(m.id);
    return '<article class="mk-card">' +
      '<div class="mk-card-top"><div><b>' + escapeHtml(m.topic) + '</b><div class="adm-order-mail">' + escapeHtml(m.full_name || m.email) + (m.business_name ? ' · ' + escapeHtml(m.business_name) : '') + (m.phone ? ' · ' + escapeHtml(m.phone) : '') + '</div></div>' +
      '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span></div>' +
      (m.preferred_times ? '<p class="mb-caption">' + escapeHtml(t('Prefiere')) + ': ' + escapeHtml(m.preferred_times) + '</p>' : '') +
      '<div class="adm-form-grid">' +
        '<label class="adm-field"><span>' + escapeHtml(t('Fecha y hora')) + '</span><input class="form-input" type="datetime-local" id="mt-at-' + id + '" value="' + toLocal(m.scheduled_at) + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Enlace de la reunión')) + '</span><input class="form-input" id="mt-url-' + id + '" value="' + escapeHtml(m.meet_url || defUrl) + '" placeholder="https://meet.google.com/…"></label>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Nota para el miembro')) + '</span><input class="form-input" id="mt-note-' + id + '" value="' + escapeHtml(m.admin_note || '') + '"></label>' +
      '</div>' +
      '<div class="adm-form-actions">' +
        (m.status !== 'done' ? '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="setMeeting(\'' + id + '\',\'done\')">' + escapeHtml(t('Marcar realizada')) + '</button>' : '') +
        (m.status !== 'canceled' ? '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="setMeeting(\'' + id + '\',\'canceled\')">' + escapeHtml(t('Cancelar')) + '</button>' : '') +
        '<button class="ui-btn ui-btn--primary ui-btn--sm" onclick="setMeeting(\'' + id + '\',\'scheduled\')">' + escapeHtml(t(m.status === 'scheduled' ? 'Actualizar y avisar' : 'Agendar y avisar')) + '</button>' +
      '</div></article>';
  }).join('') + '</div>';
}
async function setMeeting(id, status) {
  const at = document.getElementById('mt-at-' + id).value;
  const url = document.getElementById('mt-url-' + id).value.trim();
  if (status === 'scheduled' && !at) { toast(t('Elige la fecha y hora')); return; }
  if (url && !/^https:\/\//.test(url)) { toast(t('El enlace debe empezar por https://')); return; }
  const { error } = await sb.rpc('admin_update_meeting', { meeting_id: id, status, scheduled_at: at ? new Date(at).toISOString() : null, meet_url: url, note: document.getElementById('mt-note-' + id).value.trim() });
  if (error) { toast(rpcError(error)); return; }
  if (status === 'scheduled') invokePayments({ action: 'member_notify', type: 'meeting', id }).then(() => toast(t('Asesoría agendada. Avisamos al miembro.')), e => toast(t('Guardado, pero el correo no salió: ') + e.message));
  else toast(t('Guardado'));
  loadMembersAdmin();
}

// ── Sorteos ──
function mkRaffles() {
  const month = new Date(); month.setDate(1);
  const ym = month.toISOString().slice(0, 7);
  return '<form class="adm-card" onsubmit="event.preventDefault();saveRaffle()">' +
      '<div class="adm-card-head"><h2>' + escapeHtml(t('Premio del mes')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Participan todos los miembros activos: Esencial 1 vez, Crecimiento 2 y Élite 3.')) + '</span></div>' +
      '<div class="adm-form-grid">' +
        '<label class="adm-field"><span>' + escapeHtml(t('Mes')) + '</span><input class="form-input" type="month" id="rf-month" value="' + ym + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Premio (español)')) + '</span><input class="form-input" id="rf-prize" placeholder="' + escapeHtml(t('Ej.: Página web de una sección gratis')) + '"></label>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Premio (inglés)')) + '</span><input class="form-input" id="rf-prize-en"></label>' +
      '</div><div class="adm-form-actions"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar premio')) + '</button></div></form>' +
    '<div class="mk-list">' + (MK.raffles.length ? MK.raffles.map(r => '<article class="mk-card mk-card--row"><div><b>' +
      escapeHtml(new Date(r.month + 'T12:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' })) + '</b> · ' + escapeHtml(r.prize) +
      '<div class="adm-order-mail">' + escapeHtml(r.winner_name ? t('Ganador') + ': ' + r.winner_name + ' · ' + fmtDate(r.drawn_at) : t('Sin sortear')) + '</div></div>' +
      (r.winner_id ? '<span class="pay-status is-paid">' + escapeHtml(t('Sorteado')) + '</span>' : '<button class="ui-btn ui-btn--dark ui-btn--sm" onclick="drawRaffle(\'' + cleanId(r.id) + '\')">' + escapeHtml(t('Sortear ahora')) + '</button>') +
      '</article>').join('') : '<div class="admin-empty">' + escapeHtml(t('Aún no hay sorteos.')) + '</div>') + '</div>';
}
async function saveRaffle() {
  const m = document.getElementById('rf-month').value, prize = document.getElementById('rf-prize').value.trim();
  if (!m || prize.length < 3) { toast(t('Escribe el premio')); return; }
  const { error } = await sb.rpc('admin_save_raffle', { month: m + '-01', prize, prize_en: document.getElementById('rf-prize-en').value.trim() });
  if (error) { toast(rpcError(error)); return; }
  toast(t('Premio guardado'));
  loadMembersAdmin();
}
async function drawRaffle(id) {
  if (!confirm(t('¿Sortear ahora? El resultado es definitivo.'))) return;
  const { data, error } = await sb.rpc('admin_draw_raffle', { raffle_id: id });
  if (error) { toast(rpcError(error)); return; }
  toast(t('Ganador') + ': ' + data.winner_name);
  loadMembersAdmin();
}

// ── Contenido exclusivo ──
let mkEditing = null;
function mkPosts() {
  const p = mkEditing || {};
  const local = d => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  return '<form class="adm-card" onsubmit="event.preventDefault();savePost()">' +
      '<div class="adm-card-head"><h2>' + escapeHtml(t(p.id ? 'Editar publicación' : 'Nueva publicación exclusiva')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Los miembros la ven desde la publicación; el resto, desde la fecha pública (si la pones).')) + '</span></div>' +
      '<div class="adm-form-grid">' +
        '<label class="adm-field"><span>' + escapeHtml(t('Título (español)')) + '</span><input class="form-input" id="po-title" value="' + escapeHtml(p.title || '') + '" required></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Título (inglés)')) + '</span><input class="form-input" id="po-title-en" value="' + escapeHtml(p.title_en || '') + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Resumen (español)')) + '</span><input class="form-input" id="po-sum" value="' + escapeHtml(p.summary || '') + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Resumen (inglés)')) + '</span><input class="form-input" id="po-sum-en" value="' + escapeHtml(p.summary_en || '') + '"></label>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Contenido (español)')) + '</span><textarea class="form-input" id="po-body" rows="6">' + escapeHtml(p.body || '') + '</textarea></label>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Contenido (inglés)')) + '</span><textarea class="form-input" id="po-body-en" rows="4">' + escapeHtml(p.body_en || '') + '</textarea></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Tipo')) + '</span><select class="form-input" id="po-kind">' + Object.keys(POST_KIND).map(k => '<option value="' + k + '"' + (p.kind === k ? ' selected' : '') + '>' + escapeHtml(t(POST_KIND[k])) + '</option>').join('') + '</select></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Enlace (video, plantilla, clase)')) + '</span><input class="form-input" id="po-url" value="' + escapeHtml(p.url || '') + '" placeholder="https://"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Publicar para miembros')) + '</span><input class="form-input" type="datetime-local" id="po-pub" value="' + local(p.published_at || new Date()) + '"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Abrir para todos (opcional)')) + '</span><input class="form-input" type="datetime-local" id="po-public" value="' + local(p.public_at) + '"></label>' +
      '</div><div class="adm-form-actions">' + (p.id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="mkEditing=null;mkView(\'contenido\')">' + escapeHtml(t('Cancelar')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>' +
    '<div class="mk-list">' + MK.posts.map(x => '<article class="mk-card mk-card--row"><div><b>' + escapeHtml(x.title) + '</b><div class="adm-order-mail">' +
      escapeHtml(t(POST_KIND[x.kind] || x.kind)) + ' · ' + escapeHtml(fmtDate(x.published_at)) + ' · ' + escapeHtml(x.public_at ? t('público desde') + ' ' + fmtDate(x.public_at) : t('solo miembros')) + '</div></div>' +
      '<div class="adm-card-tools"><button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="editPost(\'' + cleanId(x.id) + '\')">' + escapeHtml(t('Editar')) + '</button>' +
      '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="deletePost(\'' + cleanId(x.id) + '\')">' + escapeHtml(t('Borrar')) + '</button></div></article>').join('') + '</div>';
}
function editPost(id) { mkEditing = MK.posts.find(p => p.id === id) || null; mkView('contenido'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function savePost() {
  const g = id => document.getElementById(id).value.trim();
  const iso = v => v ? new Date(v).toISOString() : null;
  if (g('po-title').length < 3) { toast(t('Escribe el título')); return; }
  if (g('po-url') && !/^https:\/\//.test(g('po-url'))) { toast(t('El enlace debe empezar por https://')); return; }
  const { error } = await sb.rpc('admin_save_post', {
    post_id: mkEditing ? mkEditing.id : null, title: g('po-title'), title_en: g('po-title-en'), summary: g('po-sum'), summary_en: g('po-sum-en'),
    body: g('po-body'), body_en: g('po-body-en'), kind: g('po-kind'), url: g('po-url'), published_at: iso(g('po-pub')), public_at: iso(g('po-public'))
  });
  if (error) { toast(rpcError(error)); return; }
  mkEditing = null;
  toast(t('Guardado'));
  loadMembersAdmin();
}
async function deletePost(id) {
  if (!confirm(t('¿Borrar esta publicación?'))) return;
  const { error } = await sb.rpc('admin_delete_post', { post_id: id });
  if (error) { toast(rpcError(error)); return; }
  loadMembersAdmin();
}

// ── Planes ──
function mkPlans() {
  const ms = SITE_CFG.membership || {};
  return '<form class="adm-card" onsubmit="event.preventDefault();savePlans()">' +
      '<div class="adm-card-head"><h2>' + escapeHtml(t('Precios e incluidos')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Si cambias un precio, vuelve a crear los planes en Square.')) + '</span></div>' +
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>' + escapeHtml(t('Plan')) + '</th><th>' + escapeHtml(t('Precio/mes')) + '</th><th>' + escapeHtml(t('Flyers')) + '</th><th>' + escapeHtml(t('Asesorías')) + '</th><th>' + escapeHtml(t('Coach IA')) + '</th><th>' + escapeHtml(t('Activo')) + '</th><th>Square</th></tr></thead><tbody>' +
      MK.plans.map(p => '<tr><td><b>' + escapeHtml(p.name) + '</b></td>' +
        '<td><input class="form-input form-input--sm" type="number" min="1" step="0.01" id="pl-price-' + p.id + '" value="' + p.price_usd + '"></td>' +
        '<td><input class="form-input form-input--sm" type="number" min="0" id="pl-fl-' + p.id + '" value="' + p.flyers + '"></td>' +
        '<td><input class="form-input form-input--sm" type="number" min="0" id="pl-mt-' + p.id + '" value="' + p.meetings + '"></td>' +
        '<td><input class="form-input form-input--sm" type="number" min="0" id="pl-ai-' + p.id + '" value="' + (p.ai_monthly || 0) + '"></td>' +
        '<td><input type="checkbox" id="pl-on-' + p.id + '"' + (p.active ? ' checked' : '') + '></td>' +
        '<td>' + (p.square_variation_id ? '<span class="pay-status is-paid">' + escapeHtml(t('Creado')) + '</span>' : '<span class="pay-status">' + escapeHtml(t('Pendiente')) + '</span>') + '</td></tr>').join('') +
      '</tbody></table></div><div class="adm-form-actions"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar planes')) + '</button></div></form>' +
    '<div class="adm-config">' +
      '<form class="adm-card" onsubmit="event.preventDefault();saveMembershipCfg()">' +
        '<div class="adm-card-head"><h2>' + escapeHtml(t('Asesorías')) + '</h2></div>' +
        '<div class="adm-form-grid">' +
          '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Enlace de reunión habitual (Google Meet, Zoom)')) + '</span><input class="form-input" id="ms-meet" value="' + escapeHtml(ms.meet_url || '') + '" placeholder="https://meet.google.com/…"></label>' +
          '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Calendario para que el miembro elija hora (opcional)')) + '</span><input class="form-input" id="ms-booking" value="' + escapeHtml(ms.booking_url || '') + '" placeholder="https://calendar.app.google/…"></label>' +
        '</div><div class="adm-form-actions"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>' +
      '<div class="adm-card">' +
        '<div class="adm-card-head"><h2>' + escapeHtml(t('Cobro automático con Square')) + '</h2></div>' +
        '<ol class="mk-steps">' +
          '<li>' + escapeHtml(t('Guarda tus credenciales en Configuración → Square y actívalo.')) + '</li>' +
          '<li>' + escapeHtml(t('Pulsa “Crear planes en Square” para dar de alta las 3 mensualidades.')) + '</li>' +
          '<li>' + escapeHtml(t('En Square Developer → Webhooks, añade esta URL con los eventos invoice.payment_made, invoice.scheduled_charge_failed y subscription.updated:')) + '<code>' + escapeHtml(SUPABASE_URL + '/functions/v1/square-webhook') + '</code></li>' +
          '<li>' + escapeHtml(t('Copia la “Signature key” del webhook y pégala en Configuración → Square.')) + '</li>' +
        '</ol>' +
        '<div class="adm-form-actions"><button class="ui-btn ui-btn--dark ui-btn--sm" onclick="setupSquarePlans(this)">' + escapeHtml(t('Crear planes en Square')) + '</button></div>' +
      '</div>' +
    '</div>';
}
async function savePlans() {
  for (const p of MK.plans) {
    const { error } = await sb.rpc('admin_set_plan', {
      plan: p.id, price: Number(document.getElementById('pl-price-' + p.id).value), flyers: parseInt(document.getElementById('pl-fl-' + p.id).value) || 0,
      meetings: parseInt(document.getElementById('pl-mt-' + p.id).value) || 0, ai_monthly: parseInt(document.getElementById('pl-ai-' + p.id).value) || 0, active: document.getElementById('pl-on-' + p.id).checked
    });
    if (error) { toast(rpcError(error)); return; }
  }
  toast(t('Planes guardados'));
  await loadSiteSettings();
  loadMembersAdmin();
}
async function saveMembershipCfg() {
  const meet = document.getElementById('ms-meet').value.trim(), booking = document.getElementById('ms-booking').value.trim();
  if ((meet && !/^https:\/\//.test(meet)) || (booking && !/^https:\/\//.test(booking))) { toast(t('El enlace debe empezar por https://')); return; }
  try {
    await saveSetting('membership', Object.assign({ enabled: true }, SITE_CFG.membership, { meet_url: meet, booking_url: booking }));
    toast(t('Guardado'));
  } catch (e) { toast(rpcError(e)); }
}
async function setupSquarePlans(btn) {
  btn.disabled = true;
  try { await invokePayments({ action: 'square_setup_plans' }); toast(t('Planes creados en Square')); loadMembersAdmin(); }
  catch (e) { toast(e.message); }
  finally { btn.disabled = false; }
}

// ── Cortesía: acceso gratis a todo para empleados e invitados ──
function mkCourtesy() {
  // Por defecto, acceso total: programas, libros y la membresía más completa
  const plans = MK.plans.slice().sort((a, b) => Number(b.price_usd) - Number(a.price_usd));
  const opts = plans.map((p, i) => '<option value="' + p.id + '"' + (i === 0 ? ' selected' : '') + '>' +
      escapeHtml(i === 0 ? t('Acceso total (todo + membresía') + ' ' + p.name + ')' : t('Todo + membresía') + ' ' + p.name) + '</option>').join('') +
    '<option value="">' + escapeHtml(t('Sin membresía (solo programas y libros)')) + '</option>';
  const known = email => allAdminUsers.find(u => (u.email || '').toLowerCase() === email);
  return '<form class="adm-card" onsubmit="event.preventDefault();addCourtesy()">' +
      '<div class="adm-card-head"><h2>' + escapeHtml(t('Dar acceso de cortesía')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Acceso gratis a todo: programas, libros y membresía (flyers, asesorías, Coach IA y sorteos). Si la persona aún no tiene cuenta, se activa sola al registrarse con ese correo.')) + '</span></div>' +
      '<div class="adm-form-grid">' +
        '<label class="adm-field"><span>' + escapeHtml(t('Correo')) + '</span><input class="form-input" id="ct-email" type="email" list="mp-user-list" required placeholder="nombre@correo.com"></label>' +
        '<label class="adm-field"><span>' + escapeHtml(t('Incluye')) + '</span><select class="form-input" id="ct-plan">' + opts + '</select></label>' +
        '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('Nota (ej.: empleado, socio, invitado)')) + '</span><input class="form-input" id="ct-note" maxlength="200"></label>' +
      '</div><div class="adm-form-actions"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Dar cortesía')) + '</button></div></form>' +
    '<div class="mk-list">' + (MK.courtesy.length ? MK.courtesy.map(c => {
      const u = known(c.email), plan = MK.plans.find(p => p.id === c.plan_id);
      return '<article class="mk-card mk-card--row"><div><b>' + escapeHtml(u && u.full_name ? u.full_name : c.email) + '</b><div class="adm-order-mail">' + escapeHtml(c.email) + ' · ' +
        escapeHtml(plan ? t('Todo + membresía') + ' ' + plan.name : t('Programas y libros')) + (c.note ? ' · ' + escapeHtml(c.note) : '') + '</div></div>' +
        '<div class="adm-card-tools">' + (u ? '<span class="pay-status is-paid">' + escapeHtml(t('Con cuenta')) + '</span>' : '<span class="pay-status is-pending">' + escapeHtml(t('Aún sin registrarse')) + '</span>') +
        '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="removeCourtesy(\'' + escapeHtml(c.email) + '\')">' + escapeHtml(t('Quitar')) + '</button></div></article>';
    }).join('') : '<div class="admin-empty">' + escapeHtml(t('Nadie tiene acceso de cortesía todavía.')) + '</div>') + '</div>';
}
async function addCourtesy() {
  const email = document.getElementById('ct-email').value.trim().toLowerCase();
  const { error } = await sb.rpc('admin_set_courtesy', { email, plan: document.getElementById('ct-plan').value, note: document.getElementById('ct-note').value.trim(), enabled: true });
  if (error) { toast(rpcError(error)); return; }
  toast(t('Acceso de cortesía activado'));
  loadMembersAdmin();
}
async function removeCourtesy(email) {
  if (!confirm(t('¿Quitar el acceso de cortesía a') + ' ' + email + '?')) return;
  const { error } = await sb.rpc('admin_set_courtesy', { email, plan: '', note: '', enabled: false });
  if (error) { toast(rpcError(error)); return; }
  toast(t('Cortesía retirada'));
  loadMembersAdmin();
}
