// =========================================================
// DGP Academy — membresía mensual y blog
// Planes, encuesta del negocio, flyers, asesorías, sorteo del mes,
// contenido exclusivo y las guías de dgpglobalgroup.com.
// Los límites del mes los comprueba el servidor (request_flyer / request_meeting).
// =========================================================

const MEMBER = { info: null, survey: null, flyers: [], meetings: [], raffle: null, posts: [], chat: [], quota: null };
let svStep = 1, svAfter = null;

const pick = (es, en) => (LANG === 'en' ? (en || es) : (es || en));
function planList() { return SITE_CFG.planList || []; }

// ── Tarjetas de planes (landing y panel) ─────────────────────────────────────
function planCardsHTML(ctx) {
  const plans = planList();
  if (!plans.length) return '';
  const current = MEMBER.info && MEMBER.info.active ? MEMBER.info.plan_id : null;
  return plans.map((p, i) => {
    const perks = (LANG === 'en' ? p.perks_en : p.perks) || [];
    const featured = i === 1;
    const isCurrent = current === p.id;
    const btn = isCurrent
      ? '<button class="ui-btn ui-btn--ghost ui-btn--block" disabled>' + escapeHtml(t('Tu plan actual')) + '</button>'
      : '<button class="ui-btn ' + (featured ? 'ui-btn--primary' : 'ui-btn--dark') + ' ui-btn--block" onclick="choosePlan(\'' + p.id + '\')">' +
        escapeHtml(t(current ? 'Cambiar a este plan' : (ctx === 'landing' ? 'Empezar' : 'Elegir plan'))) + '</button>';
    return '<article class="mb-plan' + (featured ? ' is-featured' : '') + (isCurrent ? ' is-current' : '') + ' reveal" data-d="' + (i + 1) + '">' +
      (featured ? '<span class="mb-badge">' + escapeHtml(t('Más elegido')) + '</span>' : '') +
      '<div class="mb-plan-name">' + escapeHtml(pick(p.name, p.name_en)) + '</div>' +
      '<div class="mb-plan-price"><span class="cur">$</span>' + Number(p.price_usd).toLocaleString('en-US') + '<span class="per">' + escapeHtml(t('/mes')) + '</span></div>' +
      '<div class="mb-plan-kpis"><div><b>' + p.flyers + '</b><span>' + escapeHtml(t('flyers al mes')) + '</span></div><div><b>' + p.meetings + '</b><span>' + escapeHtml(t('asesorías al mes')) + '</span></div></div>' +
      '<ul class="mb-plan-perks">' + perks.map(x => '<li><svg><use href="#i-check"/></svg>' + escapeHtml(x) + '</li>').join('') + '</ul>' +
      btn + '</article>';
  }).join('');
}

function renderLandingPlans() {
  const box = document.getElementById('lp-plans');
  if (!box) return;
  box.innerHTML = planCardsHTML('landing');
  box.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}

// Elegir plan: sesión → encuesta → pago
function choosePlan(planId) {
  if (!STATE.user) { try { sessionStorage.setItem('dgp-plan', planId); } catch (e) {} goToRegister(); return; }
  const go = () => openPlanCheckout(planId);
  if (!MEMBER.survey) openSurvey(go); else go();
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function loadMembership() {
  if (!STATE.user) return;
  const uid = STATE.user.id;
  const [info, sv, fl, mt, rf, po, ch, qt] = await Promise.all([
    sb.rpc('my_membership'),
    sb.from('business_profiles').select('*').eq('user_id', uid).maybeSingle(),
    sb.from('flyer_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('meetings').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('raffles').select('month, prize, prize_en, winner_name, drawn_at').order('month', { ascending: false }).limit(1),
    sb.from('member_posts').select('*').order('published_at', { ascending: false }).limit(12),
    sb.from('coach_messages').select('role, content, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
    sb.rpc('my_ai_quota')
  ]);
  MEMBER.chat = (ch.data || []).reverse();
  MEMBER.quota = qt.data || null;
  MEMBER.info = info.data || null;
  MEMBER.survey = sv.data || null;
  MEMBER.flyers = fl.data || [];
  MEMBER.meetings = mt.data || [];
  MEMBER.raffle = (rf.data || [])[0] || null;
  MEMBER.posts = po.data || [];
  renderMember();
  // Si eligió un plan antes de crear su cuenta, se lo mostramos al entrar
  let pending = null;
  try { pending = sessionStorage.getItem('dgp-plan'); sessionStorage.removeItem('dgp-plan'); } catch (e) {}
  if (pending && !(MEMBER.info && MEMBER.info.active) && SITE_CFG.plans && SITE_CFG.plans[pending]) choosePlan(pending);
}

function fmtDay(d) {
  return d ? new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

// ── Panel del miembro ────────────────────────────────────────────────────────
function renderMember() {
  const root = document.getElementById('member-root');
  if (!root) return;
  const m = MEMBER.info;
  if (!m || !m.active) {
    const lapsed = m && !m.active;
    const pendingOrder = MY_ORDERS.find(o => o.kind === 'subscription' && o.status === 'pending');
    root.innerHTML =
      (pendingOrder ? '<div class="dash-pending-pay"><svg><use href="#i-clock"/></svg><span>' + escapeHtml(t('Recibimos tu pago de la membresía y lo estamos verificando. Te avisaremos por correo.')) + '</span></div>' : '') +
      (lapsed && !pendingOrder ? '<div class="dash-pending-pay is-error"><span>' + escapeHtml(t('Tu membresía venció. Renueva para seguir recibiendo tus flyers y asesorías.')) + '</span></div>' : '') +
      '<div class="mb-plans mb-plans--dash">' + planCardsHTML('dash') + '</div>';
    root.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    return;
  }
  const plan = (SITE_CFG.plans || {})[m.plan_id] || {};
  const fLeft = Math.max(0, m.flyers_total - m.flyers_used), mLeft = Math.max(0, m.meetings_total - m.meetings_used);
  const statusTxt = m.courtesy ? t('Cortesía de DGP') : m.status === 'past_due' ? t('Pago pendiente') : (m.cancel_at_period_end ? t('No se renovará') : t('Activa'));
  const renewTxt = m.courtesy ? t('Tus flyers y asesorías se renuevan el') : m.cancel_at_period_end ? t('Activa hasta el') : (m.method === 'square' ? t('Se renueva el') : t('Vence el'));
  const methodTxt = m.courtesy ? 'Acceso de cortesía' : (m.method === 'square' ? 'Tarjeta (automático)' : 'Zelle (mes a mes)');
  const pct = (u, tot) => Math.min(100, Math.round(u / Math.max(1, tot) * 100));
  const raffle = MEMBER.raffle;
  const ring = (u, tot, color) => '<div class="mb-ring" style="--p:' + pct(u, tot) + ';--c:' + color + '"><span>' + u + '<small>/' + tot + '</small></span></div>';

  root.innerHTML =
    '<div class="mb-hero">' +
      '<div class="mb-hero-main">' +
        '<div class="mb-hero-kicker"><span class="mb-dot' + (m.status === 'past_due' ? ' is-warn' : '') + '"></span>' + escapeHtml(statusTxt) + '</div>' +
        '<h3>' + escapeHtml(t('Membresía')) + ' ' + escapeHtml(pick(plan.name, plan.name_en)) + '</h3>' +
        '<p>' + escapeHtml(renewTxt) + ' <b>' + escapeHtml(fmtDay(m.period_end)) + '</b> · ' + escapeHtml(t(m.method === 'square' ? 'Tarjeta (automático)' : 'Zelle (mes a mes)')) + '</p>' +
        '<div class="mb-hero-actions">' +
          (!m.courtesy && (m.method !== 'square' || m.cancel_at_period_end) ? '<button class="ui-btn ui-btn--light ui-btn--sm" onclick="openPlanCheckout(\'' + m.plan_id + '\')">' + escapeHtml(t('Renovar un mes')) + '</button>' : '') +
          '<button class="ui-btn ui-btn--glass ui-btn--sm" onclick="openSurvey()">' + escapeHtml(t('Editar datos de mi negocio')) + '</button>' +
          (!m.courtesy && !m.cancel_at_period_end && m.method === 'square' ? '<button class="ui-btn ui-btn--glass ui-btn--sm" onclick="cancelMembership()">' + escapeHtml(t('Cancelar renovación')) + '</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="mb-hero-stats">' +
        '<div class="mb-stat">' + ring(m.flyers_used, m.flyers_total, '#7fe3ff') + '<div><b>' + escapeHtml(t('Flyers del mes')) + '</b><span>' + fLeft + ' ' + escapeHtml(t('disponibles')) + '</span></div></div>' +
        '<div class="mb-stat">' + ring(m.meetings_used, m.meetings_total, '#ffd27a') + '<div><b>' + escapeHtml(t('Asesorías del mes')) + '</b><span>' + mLeft + ' ' + escapeHtml(t('disponibles')) + '</span></div></div>' +
      '</div>' +
    '</div>' +
    (!MEMBER.survey ? '<div class="dash-pending-pay"><svg><use href="#i-clock"/></svg><span>' + escapeHtml(t('Completa la encuesta de tu negocio para que podamos diseñar tus flyers.')) + '</span><button class="ui-btn ui-btn--primary ui-btn--sm" onclick="openSurvey()">' + escapeHtml(t('Completar ahora')) + '</button></div>' : '') +
    '<div class="mb-grid">' +
      '<div class="mb-card">' +
        '<div class="mb-card-head"><h4>' + escapeHtml(t('Mis flyers')) + '</h4><button class="ui-btn ui-btn--primary ui-btn--sm" ' + (fLeft ? '' : 'disabled ') + 'onclick="openRequest(\'flyer\')"><svg><use href="#i-plus"/></svg>' + escapeHtml(t('Pedir flyer')) + '</button></div>' +
        (MEMBER.flyers.length ? '<ul class="mb-list">' + MEMBER.flyers.map(flyerItem).join('') + '</ul>' : '<p class="mb-empty">' + escapeHtml(t('Aún no has pedido flyers este mes. Cuéntanos qué necesitas y nuestro equipo lo diseña.')) + '</p>') +
      '</div>' +
      '<div class="mb-card">' +
        '<div class="mb-card-head"><h4>' + escapeHtml(t('Mis asesorías')) + '</h4><button class="ui-btn ui-btn--primary ui-btn--sm" ' + (mLeft ? '' : 'disabled ') + 'onclick="openRequest(\'meeting\')"><svg><use href="#i-plus"/></svg>' + escapeHtml(t('Agendar')) + '</button></div>' +
        (MEMBER.meetings.length ? '<ul class="mb-list">' + MEMBER.meetings.map(meetingItem).join('') + '</ul>' : '<p class="mb-empty">' + escapeHtml(t('Agenda tu primera sesión de seguimiento con el equipo de DGP.')) + '</p>') +
      '</div>' +
      '<div class="mb-card mb-card--raffle">' +
        '<div class="mb-card-head"><h4>' + escapeHtml(t('Sorteo del mes')) + '</h4><span class="chip chip--gold">' + escapeHtml(t('Participas automáticamente')) + '</span></div>' +
        (raffle ? '<div class="mb-raffle"><svg><use href="#i-award"/></svg><div><b>' + escapeHtml(pick(raffle.prize, raffle.prize_en)) + '</b><span>' +
          escapeHtml(raffle.winner_name ? t('Ganador') + ': ' + raffle.winner_name : new Date(raffle.month + 'T12:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' })) + '</span></div></div>'
          : '<p class="mb-empty">' + escapeHtml(t('Muy pronto anunciamos el premio de este mes.')) + '</p>') +
      '</div>' +
      coachCard() +
      '<div class="mb-card mb-card--wide">' +
        '<div class="mb-card-head"><h4>' + escapeHtml(t('Contenido exclusivo')) + '</h4><span class="mb-card-sub">' + escapeHtml(t('Los miembros lo ven primero')) + '</span></div>' +
        (MEMBER.posts.length ? '<div class="mb-posts">' + MEMBER.posts.map(postItem).join('') + '</div>' : '<p class="mb-empty">' + escapeHtml(t('Pronto publicaremos aquí plantillas, clases y guías exclusivas para miembros.')) + '</p>') +
      '</div>' +
    '</div>';
}

// ── Coach IA de negocio ──
function coachCard() {
  const q = MEMBER.quota || { used: 0, limit: 0 };
  const left = Math.max(0, q.limit - q.used);
  const intro = MEMBER.survey
    ? t('Pregúntame lo que necesites sobre tu negocio: ideas de publicaciones, cómo conseguir clientes, precios, textos para vender o cómo organizarte.')
    : t('Completa la encuesta de tu negocio para que mis respuestas se adapten a ti.');
  const msgs = MEMBER.chat.length ? MEMBER.chat : [{ role: 'assistant', content: intro }];
  const ideas = LANG === 'en'
    ? ['Give me 5 post ideas for this week', 'How can I get more customers on WhatsApp?', 'Write a caption for my promotion']
    : ['Dame 5 ideas de publicaciones para esta semana', '¿Cómo consigo más clientes por WhatsApp?', 'Escribe un texto para mi promoción'];
  return '<div class="mb-card mb-card--wide mb-coach">' +
    '<div class="mb-card-head"><h4><span class="mb-coach-ic">AI</span>' + escapeHtml(t('Coach IA de negocio')) + '</h4>' +
    '<span class="mb-card-sub">' + left + ' ' + escapeHtml(t('de')) + ' ' + q.limit + ' ' + escapeHtml(t('consultas disponibles este mes')) + '</span></div>' +
    '<div class="mb-coach-log" id="coach-log">' + msgs.map(m => '<div class="mb-msg is-' + m.role + '">' + coachFormat(m.content) + '</div>').join('') + '</div>' +
    (MEMBER.chat.length ? '' : '<div class="mb-coach-ideas">' + ideas.map(i => '<button type="button" onclick="coachAsk(this.textContent)">' + escapeHtml(i) + '</button>').join('') + '</div>') +
    '<form class="mb-coach-form" onsubmit="event.preventDefault();coachAsk()"><textarea id="coach-input" rows="1" maxlength="2000" placeholder="' + escapeHtml(t('Escribe tu pregunta…')) + '" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();coachAsk()}"></textarea>' +
    '<button class="ui-btn ui-btn--primary ui-btn--sm" id="coach-btn"' + (left ? '' : ' disabled') + '>' + escapeHtml(t('Enviar')) + '</button></form>' +
    '<p class="mb-coach-note">' + escapeHtml(t('Respuestas generadas con IA. Para decisiones importantes, agenda una asesoría con el equipo.')) + '</p></div>';
}
// Texto de la IA: escapado, con negritas y saltos de línea
function coachFormat(txt) {
  return escapeHtml(txt).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s*(.+)$/gm, '<b>$1</b>').replace(/\n/g, '<br>');
}
async function coachAsk(preset) {
  const input = document.getElementById('coach-input');
  const text = (preset || input.value).trim();
  if (text.length < 2) return;
  const log = document.getElementById('coach-log'), btn = document.getElementById('coach-btn');
  input.value = ''; btn.disabled = true;
  const ideas = document.querySelector('.mb-coach-ideas'); if (ideas) ideas.remove();
  log.insertAdjacentHTML('beforeend', '<div class="mb-msg is-user">' + coachFormat(text) + '</div><div class="mb-msg is-assistant is-typing"><span></span><span></span><span></span></div>');
  log.scrollTop = log.scrollHeight;
  try {
    const { data, error } = await sb.functions.invoke('coach', { body: { action: 'chat', message: text, lang: LANG } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j.error) m = j.error; } catch (x) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    MEMBER.chat.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply });
    if (MEMBER.quota) MEMBER.quota.used++;
    log.querySelector('.is-typing').outerHTML = '<div class="mb-msg is-assistant">' + coachFormat(data.reply) + '</div>';
    const sub = document.querySelector('.mb-coach .mb-card-sub');
    if (sub && MEMBER.quota) sub.textContent = Math.max(0, MEMBER.quota.limit - MEMBER.quota.used) + ' ' + t('de') + ' ' + MEMBER.quota.limit + ' ' + t('consultas disponibles este mes');
  } catch (e) {
    log.querySelector('.is-typing').outerHTML = '<div class="mb-msg is-error">' + escapeHtml(t(friendlyPayError(e))) + '</div>';
  } finally {
    btn.disabled = !!(MEMBER.quota && MEMBER.quota.used >= MEMBER.quota.limit);
    log.scrollTop = log.scrollHeight;
  }
}

const FLYER_STATUS = { requested: ['Recibido', 'is-pending'], in_progress: ['En diseño', 'is-pending'], delivered: ['Listo', 'is-paid'], revision: ['En cambios', 'is-pending'] };
const FORMAT_LABEL = { post: 'Post', story: 'Historia', flyer: 'Flyer impreso', banner: 'Banner' };
function flyerItem(f) {
  const st = FLYER_STATUS[f.status] || [f.status, ''];
  const id = String(f.id).replace(/[^a-f0-9-]/g, '');
  return '<li class="mb-item"><div class="mb-item-main"><b>' + escapeHtml(f.title) + '</b><span>' + escapeHtml(t(FORMAT_LABEL[f.format] || f.format)) + ' · ' + escapeHtml(fmtDate(f.created_at)) + '</span>' +
    (f.admin_note && f.status !== 'delivered' ? '<em>' + escapeHtml(f.admin_note) + '</em>' : '') + '</div>' +
    '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span>' +
    (f.status === 'delivered' && f.file_path ? '<div class="mb-item-actions"><button class="ui-btn ui-btn--primary ui-btn--sm" onclick="downloadFlyer(\'' + id + '\')">' + escapeHtml(t('Descargar')) + '</button>' +
      '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="askRevision(\'' + id + '\')">' + escapeHtml(t('Pedir cambios')) + '</button></div>' : '') +
    (f.status === 'delivered' && f.caption ? '<p class="mb-caption">' + escapeHtml(f.caption) + '</p>' : '') + '</li>';
}
const MEETING_STATUS = { requested: ['Por agendar', 'is-pending'], scheduled: ['Agendada', 'is-paid'], done: ['Realizada', ''], canceled: ['Cancelada', 'is-rejected'] };
function meetingItem(mt) {
  const st = MEETING_STATUS[mt.status] || [mt.status, ''];
  const when = mt.scheduled_at ? new Date(mt.scheduled_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return '<li class="mb-item"><div class="mb-item-main"><b>' + escapeHtml(mt.topic) + '</b><span>' + escapeHtml(when || mt.preferred_times || fmtDate(mt.created_at)) + '</span>' +
    (mt.admin_note ? '<em>' + escapeHtml(mt.admin_note) + '</em>' : '') + '</div>' +
    '<span class="pay-status ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span>' +
    (mt.status === 'scheduled' && /^https:\/\//.test(mt.meet_url || '') ? '<div class="mb-item-actions"><a class="ui-btn ui-btn--primary ui-btn--sm" href="' + escapeHtml(mt.meet_url) + '" target="_blank" rel="noopener">' + escapeHtml(t('Entrar a la reunión')) + '</a></div>' : '') + '</li>';
}
const POST_KIND = { article: 'Artículo', video: 'Video', template: 'Plantilla', live: 'Clase en vivo' };
function postItem(p) {
  const id = String(p.id).replace(/[^a-f0-9-]/g, '');
  const early = p.public_at && new Date(p.public_at) > new Date();
  return '<button class="mb-post" onclick="openPost(\'' + id + '\')"><span class="mb-post-kind">' + escapeHtml(t(POST_KIND[p.kind] || p.kind)) + (early ? ' · ' + escapeHtml(t('Acceso anticipado')) : '') + '</span>' +
    '<b>' + escapeHtml(pick(p.title, p.title_en)) + '</b><span>' + escapeHtml(pick(p.summary, p.summary_en)) + '</span></button>';
}

// ── Encuesta ─────────────────────────────────────────────────────────────────
function openSurvey(after) {
  svAfter = typeof after === 'function' ? after : null;
  const f = document.getElementById('sv-form');
  f.reset();
  const s = MEMBER.survey;
  if (s) {
    ['business_name', 'industry', 'description', 'city', 'stage', 'audience', 'brand_colors', 'tone', 'website', 'social', 'notes'].forEach(k => { if (f[k]) f[k].value = s[k] || ''; });
    f.querySelectorAll('input[name=kind]').forEach(r => { r.checked = r.value === s.kind; });
    f.querySelectorAll('input[name=has_logo]').forEach(r => { r.checked = (r.value === 'yes') === !!s.has_logo; });
    f.querySelectorAll('input[name=goals]').forEach(c => { c.checked = (s.goals || []).includes(c.value); });
    f.querySelectorAll('input[name=channels]').forEach(c => { c.checked = (s.channels || []).includes(c.value); });
  }
  svGo(1);
  document.getElementById('survey-overlay').style.display = 'flex';
}
function closeSurvey() { document.getElementById('survey-overlay').style.display = 'none'; }
function svGo(n) {
  svStep = n;
  document.querySelectorAll('.sv-step').forEach(el => el.classList.toggle('is-on', +el.dataset.s === n));
  document.querySelectorAll('#sv-steps span').forEach((el, i) => el.classList.toggle('is-on', i < n));
  document.getElementById('sv-back').hidden = n === 1;
  document.getElementById('sv-next').textContent = t(n === 3 ? 'Guardar y continuar' : 'Siguiente');
  svError('');
}
function svError(msg) { const e = document.getElementById('sv-error'); e.textContent = msg ? t(msg) : ''; e.hidden = !msg; }
function surveyBack() { if (svStep > 1) svGo(svStep - 1); }
async function surveyNext() {
  const f = document.getElementById('sv-form');
  if (svStep === 1 && !f.industry.value) { svError('Elige a qué te dedicas'); return; }
  if (svStep === 1 && f.querySelector('input[name=kind]:checked').value === 'business' && f.business_name.value.trim().length < 2) { svError('Escribe el nombre de tu negocio'); return; }
  if (svStep < 3) { svGo(svStep + 1); return; }
  const checked = name => [...f.querySelectorAll('input[name=' + name + ']:checked')].map(c => c.value);
  const row = {
    user_id: STATE.user.id, kind: f.querySelector('input[name=kind]:checked').value,
    business_name: f.business_name.value.trim(), industry: f.industry.value, description: f.description.value.trim(),
    city: f.city.value.trim(), stage: f.stage.value, audience: f.audience.value.trim(), goals: checked('goals'), channels: checked('channels'),
    has_logo: f.querySelector('input[name=has_logo]:checked').value === 'yes', brand_colors: f.brand_colors.value.trim(), tone: f.tone.value,
    website: f.website.value.trim(), social: f.social.value.trim(), notes: f.notes.value.trim(), updated_at: new Date().toISOString()
  };
  const btn = document.getElementById('sv-next');
  btn.disabled = true;
  const { data, error } = await sb.from('business_profiles').upsert(row, { onConflict: 'user_id' }).select().single();
  btn.disabled = false;
  if (error) { svError(error.message); return; }
  MEMBER.survey = data;
  closeSurvey();
  toast(t('Datos guardados'));
  renderMember();
  if (svAfter) { const fn = svAfter; svAfter = null; fn(); }
}

// ── Solicitudes ──────────────────────────────────────────────────────────────
function openRequest(type) {
  if (type === 'flyer' && !MEMBER.survey) { openSurvey(() => openRequest('flyer')); return; }
  document.getElementById('req-title').textContent = t(type === 'flyer' ? 'Pedir un flyer' : 'Agendar una asesoría');
  document.getElementById('req-flyer').hidden = type !== 'flyer';
  document.getElementById('req-meeting').hidden = type !== 'meeting';
  document.getElementById('req-flyer').reset();
  document.getElementById('req-meeting').reset();
  ['req-flyer-error', 'req-meeting-error'].forEach(id => { document.getElementById(id).hidden = true; });
  const booking = ((SITE_CFG.membership || {}).booking_url || '').trim();
  const bk = document.getElementById('req-booking');
  bk.hidden = !/^https:\/\//.test(booking);
  if (!bk.hidden) bk.innerHTML = escapeHtml(t('¿Prefieres elegir tú la hora?')) + ' <a href="' + escapeHtml(booking) + '" target="_blank" rel="noopener">' + escapeHtml(t('Abre nuestro calendario')) + '</a>.';
  document.getElementById('req-overlay').style.display = 'flex';
}
function closeRequest() { document.getElementById('req-overlay').style.display = 'none'; }
function reqError(id, msg) { const e = document.getElementById(id); e.textContent = msg ? t(msg) : ''; e.hidden = !msg; }

async function submitFlyer() {
  const f = document.getElementById('req-flyer'), btn = document.getElementById('req-flyer-btn');
  btn.disabled = true;
  const { data, error } = await sb.rpc('request_flyer', {
    title: f.title.value.trim(), purpose: f.purpose.value.trim(), format: f.format.value,
    headline: f.headline.value.trim(), details: f.details.value.trim(), deadline: f.deadline.value || null
  });
  btn.disabled = false;
  if (error) { reqError('req-flyer-error', friendlyPayError(error)); return; }
  sb.functions.invoke('payments', { body: { action: 'member_request', type: 'flyer', id: data.id } }).catch(() => {});
  closeRequest();
  toast(t('¡Listo! Nuestro equipo ya está trabajando en tu flyer.'));
  loadMembership();
}

async function submitMeeting() {
  const f = document.getElementById('req-meeting'), btn = document.getElementById('req-meeting-btn');
  btn.disabled = true;
  const { data, error } = await sb.rpc('request_meeting', { topic: f.topic.value.trim(), preferred_times: f.preferred_times.value.trim() });
  btn.disabled = false;
  if (error) { reqError('req-meeting-error', friendlyPayError(error)); return; }
  sb.functions.invoke('payments', { body: { action: 'member_request', type: 'meeting', id: data.id } }).catch(() => {});
  closeRequest();
  toast(t('Solicitud enviada. Te confirmamos la fecha por correo.'));
  loadMembership();
}

async function downloadFlyer(id) {
  const f = MEMBER.flyers.find(x => x.id === id);
  if (!f || !f.file_path) return;
  const { data, error } = await sb.storage.from('flyers').createSignedUrl(f.file_path, 300, { download: true });
  if (error) { toast(error.message); return; }
  location.href = data.signedUrl;
}

async function askRevision(id) {
  const note = prompt(t('¿Qué cambios necesitas?'), '');
  if (!note) return;
  const { error } = await sb.rpc('flyer_revision', { flyer_id: id, note });
  if (error) { toast(friendlyPayError(error)); return; }
  sb.functions.invoke('payments', { body: { action: 'member_request', type: 'flyer', id } }).catch(() => {});
  toast(t('Enviamos tus cambios al equipo'));
  loadMembership();
}

async function cancelMembership() {
  if (!confirm(t('¿Cancelar la renovación? Tu membresía sigue activa hasta el final del mes que ya pagaste.'))) return;
  try {
    const { data, error } = await sb.functions.invoke('payments', { body: { action: 'cancel_membership' } });
    if (error || (data && data.error)) throw new Error((data && data.error) || error.message);
    toast(t('Renovación cancelada'));
    loadMembership();
  } catch (e) { toast(e.message); }
}

// ── Lector (blog y contenido exclusivo) ──────────────────────────────────────
function openReader(o) {
  const img = document.getElementById('art-img');
  img.hidden = !o.image; if (o.image) img.src = o.image;
  document.getElementById('art-kicker').textContent = o.kicker || '';
  document.getElementById('art-title').textContent = o.title || '';
  document.getElementById('art-lead').textContent = o.lead || '';
  document.getElementById('art-body').innerHTML = o.html || '';
  const src = document.getElementById('art-source');
  src.hidden = !o.url; if (o.url) src.href = o.url;
  const ov = document.getElementById('article-overlay');
  ov.style.display = 'block'; ov.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeArticle() {
  document.getElementById('article-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

// Texto de los miembros: párrafos y enlaces simples, sin HTML del exterior
function plainToHtml(txt) {
  return String(txt || '').split(/\n{2,}/).map(par => '<p>' + escapeHtml(par).replace(/\n/g, '<br>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') + '</p>').join('');
}
function openPost(id) {
  const p = MEMBER.posts.find(x => x.id === id);
  if (!p) return;
  openReader({ kicker: t(POST_KIND[p.kind] || p.kind), title: pick(p.title, p.title_en), lead: pick(p.summary, p.summary_en),
    html: plainToHtml(pick(p.body, p.body_en)) + (/^https:\/\//.test(p.url) ? '<p><a class="ui-btn ui-btn--primary" href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(t('Abrir recurso')) + '</a></p>' : '') });
}

// ── Blog: guías de dgpglobalgroup.com ────────────────────────────────────────
const BLOG_URL = 'https://dgpglobalgroup.com/api/guias.json';
let BLOG = [];
async function loadBlog() {
  try {
    const r = await fetch(BLOG_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    BLOG = await r.json();
  } catch (e) { BLOG = []; }
  renderBlog();
}

// Limpia el HTML de las guías: solo etiquetas de texto, enlaces absolutos
function cleanArticle(html) {
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const ok = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'A', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BR', 'HR', 'CODE', 'DIV', 'SPAN']);
  const walk = el => [...el.children].forEach(c => {
    if (!ok.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
    [...c.attributes].forEach(a => { if (!(c.tagName === 'A' && a.name === 'href')) c.removeAttribute(a.name); });
    if (c.tagName === 'A') {
      const h = c.getAttribute('href') || '';
      const abs = h.startsWith('/') ? 'https://dgpglobalgroup.com' + h : h;
      if (!/^https:\/\//.test(abs)) c.removeAttribute('href'); else { c.setAttribute('href', abs); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
    }
    walk(c);
  });
  walk(doc.body.firstChild);
  return doc.body.firstChild.innerHTML;
}

function blogCards(list) {
  return list.map(g => '<button class="blog-card" onclick="openGuide(\'' + escapeHtml(g.ref) + '\')">' +
    '<span class="blog-img"><img src="' + escapeHtml(g.image) + '" alt="" loading="lazy" width="1200" height="630"></span>' +
    '<span class="blog-body"><span class="blog-cat">' + escapeHtml(g.category || '') + ' · ' + g.minutes + ' min</span>' +
    '<span class="blog-title">' + escapeHtml(g.title) + '</span><span class="blog-lead">' + escapeHtml(g.lead || '') + '</span></span></button>').join('');
}
function renderBlog() {
  const mine = BLOG.filter(g => g.lang === LANG);
  const list = mine.length ? mine : BLOG.filter(g => g.lang === 'es');
  [['lp-blog', 'lp-blog-grid', 3], ['dash-blog', 'dash-blog-grid', 6]].forEach(([sec, grid, n]) => {
    const s = document.getElementById(sec), g = document.getElementById(grid);
    if (!s || !g) return;
    s.hidden = !list.length;
    g.innerHTML = blogCards(list.slice(0, n));
  });
}
function openGuide(ref) {
  const g = BLOG.find(x => x.ref === ref && x.lang === LANG) || BLOG.find(x => x.ref === ref);
  if (!g) return;
  openReader({ image: g.image, kicker: (g.category || '') + ' · ' + g.minutes + ' min', title: g.title, lead: g.lead, html: cleanArticle(g.html), url: g.url });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('article-overlay').style.display === 'block') closeArticle();
  if (document.getElementById('req-overlay').style.display === 'flex') closeRequest();
});

loadBlog();
