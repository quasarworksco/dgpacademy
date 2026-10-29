// =========================================================
// DGP Empresas — portal del empleado y vista del gerente (sección "Mi empresa" del campus)
// Cada persona ve su cargo y los SOPs / capacitaciones asignados a su nivel o cargo,
// y los confirma como leídos. El gerente ve además el cumplimiento de su equipo.
// =========================================================
const ORG = { me: null, org: null, levels: [], position: null, docs: [], acks: [], comp: [], certs: [], points: null, board: [], rewards: [], redemptions: [], sessions: [], bonus: [], tab: 'cap', loaded: false };

// Texto con formato simple: "# " título · "1. " paso · "- " punto · "> " nota · línea en blanco = párrafo
function orgFormat(text) {
  const out = []; let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map(i => '<li>' + i + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
  String(text || '').split('\n').forEach(raw => {
    const line = raw.trim(), safe = escapeHtml(line.replace(/^(#{1,2}|>|-|\d+[.)])\s*/, ''));
    if (!line) { flushPara(); flushList(); return; }
    if (/^#{1,2}\s/.test(line)) { flushPara(); flushList(); out.push('<h4>' + safe + '</h4>'); return; }
    if (/^>\s?/.test(line)) { flushPara(); flushList(); out.push('<div class="org-note">' + safe + '</div>'); return; }
    const num = /^\d+[.)]\s/.test(line), bul = /^-\s/.test(line);
    if (num || bul) {
      flushPara();
      const tag = num ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(safe); return;
    }
    flushList(); para.push(escapeHtml(line));
  });
  flushPara(); flushList();
  return out.join('');
}

function orgPct(c) {
  const total = Number(c.assigned || 0) + (c.position ? 1 : 0);
  const done = Number(c.done || 0) + (c.position && c.position_ok ? 1 : 0);
  return total ? Math.round(done / total * 100) : 100;
}

// Tabla de cumplimiento (admin DGP y gerente)
function orgComplianceTable(rows) {
  if (!rows || !rows.length) return '<div class="admin-empty">' + escapeHtml(t('Todavía no hay personas en el equipo.')) + '</div>';
  const active = rows.filter(r => r.active);
  const avg = active.length ? Math.round(active.reduce((a, r) => a + orgPct(r), 0) / active.length) : 0;
  const pend = active.filter(r => orgPct(r) < 100).length;
  return '<div class="org-kpis"><div><b>' + active.length + '</b><span>' + escapeHtml(t('personas activas')) + '</span></div><div><b>' + avg + '%</b><span>' + escapeHtml(t('cumplimiento promedio')) + '</span></div><div><b>' + pend + '</b><span>' + escapeHtml(t('con pendientes')) + '</span></div><div><b>' + active.filter(r => !r.registered).length + '</b><span>' + escapeHtml(t('sin registrarse')) + '</span></div></div>' +
    '<div class="oa-table-wrap"><table class="oa-table org-comp"><thead><tr><th>' + escapeHtml(t('Persona')) + '</th><th>' + escapeHtml(t('Nivel y cargo')) + '</th><th>' + escapeHtml(t('Documentos')) + '</th><th>' + escapeHtml(t('Cargo')) + '</th><th>' + escapeHtml(t('Certificaciones')) + '</th><th>' + escapeHtml(t('Puntos')) + '</th><th>' + escapeHtml(t('Cumplimiento')) + '</th></tr></thead><tbody>' +
    rows.map(r => {
      const pct = orgPct(r);
      return '<tr class="' + (r.active ? '' : 'is-off') + '"><td><b>' + escapeHtml(r.full_name || r.email) + '</b><small>' + escapeHtml(r.email) + (r.registered ? '' : ' · ' + t('falta registrarse')) + '</small></td>' +
        '<td>' + escapeHtml([r.level, r.position].filter(Boolean).join(' · ') || '—') + '</td>' +
        '<td>' + r.done + ' / ' + r.assigned + '</td>' +
        '<td>' + (r.position ? (r.position_ok ? '<span class="org-ok">✓</span>' : '<span class="org-pend">' + escapeHtml(t('Pendiente')) + '</span>') : '—') + '</td>' +
        '<td>' + (r.certs_assigned ? (r.certs_ok || 0) + ' / ' + r.certs_assigned + (r.next_expiry ? '<small>' + escapeHtml(t('vence') + ' ' + new Date(r.next_expiry).toLocaleDateString(locale())) + '</small>' : '') : '—') + '</td>' +
        '<td>' + (r.points || 0) + '</td>' +
        '<td><div class="org-pct"><span class="org-pct-bar"><i style="width:' + pct + '%" class="' + (pct === 100 ? 'is-done' : pct < 50 ? 'is-low' : '') + '"></i></span><b>' + pct + '%</b></div></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function orgExportCsv(rows, name) {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = [t('Nombre'), t('Correo'), t('Nivel'), t('Cargo'), t('Área'), t('Rol'), t('Documentos confirmados'), t('Documentos asignados'), t('Cargo confirmado'), t('Cumplimiento %'), t('Certificaciones vigentes'), t('Certificaciones asignadas'), t('Puntos'), t('Registrado'), t('Activo')];
  const lines = (rows || []).map(r => [r.full_name, r.email, r.level, r.position, r.area, r.role, r.done, r.assigned, r.position ? (r.position_ok ? t('Sí') : t('No')) : '', orgPct(r), r.certs_ok || 0, r.certs_assigned || 0, r.points || 0, r.registered ? t('Sí') : t('No'), r.active ? t('Sí') : t('No')].map(esc).join(','));
  const blob = new Blob(['﻿' + [head.map(esc).join(',')].concat(lines).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cumplimiento-' + String(name || 'empresa').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

// ── Carga del portal ──
async function loadOrgPortal() {
  const sec = document.getElementById('dash-org'), tab = document.querySelector('#campus-tabs [data-t="dash-org"]');
  const hide = () => { if (sec) sec.hidden = true; if (tab) tab.hidden = true; ORG.me = null; };
  if (!STATE.user || !sec) return hide();
  const email = (STATE.user.email || '').toLowerCase();
  const { data: me } = await sb.from('org_members').select('*').eq('email', email).maybeSingle();
  if (!me || !me.active) return hide();
  const { data: org } = await sb.from('orgs').select('*').eq('id', me.org_id).maybeSingle();
  if (!org) return hide();
  const [lv, pos, docs, acks] = await Promise.all([
    sb.from('org_levels').select('*').eq('org_id', org.id).order('rank'),
    me.position_id ? sb.from('org_positions').select('*').eq('id', me.position_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('org_docs').select('*').eq('org_id', org.id).eq('published', true).order('kind').order('title'),
    sb.from('org_acks').select('*').eq('email', email)
  ]);
  Object.assign(ORG, { me, org, levels: lv.data || [], position: pos.data || null, docs: docs.data || [], acks: acks.data || [], loaded: true });
  const mgr = me.role === 'gerente';
  const [certs, pts, board, rewards, reds, sess, bonus, comp] = await Promise.all([
    sb.rpc('my_org_certs'), sb.rpc('my_org_points'), sb.rpc('org_leaderboard'),
    sb.from('org_rewards').select('*').eq('org_id', org.id).order('cost'),
    sb.from('org_redemptions').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(200),
    sb.from('org_sessions').select('*').eq('org_id', org.id).order('starts_at', { ascending: false }).limit(200),
    sb.from('org_points').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100),
    mgr ? sb.rpc('org_compliance', { o: org.id }) : Promise.resolve({ data: [] })
  ]);
  Object.assign(ORG, { certs: certs.data || [], points: pts.data || null, board: board.data || [], rewards: rewards.data || [], redemptions: reds.data || [],
    sessions: sess.data || [], bonus: bonus.data || [], comp: comp.data || [] });
  if ((ORG.tab === 'team' && !mgr) || (ORG.tab === 'conf' && !(mgr && org.self_manage))) ORG.tab = 'cap';
  sec.hidden = false; if (tab) tab.hidden = false;
  renderOrgPortal();
}

const orgMine = d => (!d.level_ids.length && !d.position_ids.length) || d.level_ids.includes(ORG.me.level_id) || d.position_ids.includes(ORG.me.position_id);
function orgAck(type, id) { return ORG.acks.find(a => a.item_type === type && a.item_id === id); }
// estado: ok (confirmado), update (cambió desde que lo confirmó) o pending
function orgState(type, item) { const a = orgAck(type, item.id); return !a ? 'pending' : a.version === item.version ? 'ok' : 'update'; }
const ORG_STATE = { ok: ['Confirmado', 'is-ok'], update: ['Actualizado: confírmalo otra vez', 'is-update'], pending: ['Por leer y confirmar', 'is-pending'] };

function renderOrgPortal() {
  const root = document.getElementById('org-root');
  if (!root || !ORG.me) return;
  const o = ORG.org, me = ORG.me;
  const mine = ORG.docs.filter(orgMine);
  const req = mine.filter(d => d.required);
  const items = req.map(d => orgState('doc', d)).concat(ORG.position ? [orgState('position', ORG.position)] : []);
  const done = items.filter(s => s === 'ok').length, pct = items.length ? Math.round(done / items.length * 100) : 100;
  const level = (ORG.levels.find(l => l.id === me.level_id) || {}).name;
  const row = (type, item, kind, title, sub) => {
    const st = orgState(type, item);
    return '<button type="button" class="org-item is-' + st + '" onclick="orgOpen(\'' + type + '\', \'' + item.id + '\')">' +
      '<span class="org-kind org-kind--' + kind + '">' + escapeHtml(t({ cargo: 'Mi cargo', sop: 'SOP', capacitacion: 'Capacitación' }[kind])) + '</span>' +
      '<span class="org-item-txt"><b>' + escapeHtml(title) + '</b>' + (sub ? '<small>' + escapeHtml(sub) + '</small>' : '') + '</span>' +
      '<span class="org-state ' + ORG_STATE[st][1] + '">' + escapeHtml(t(ORG_STATE[st][0])) + '</span></button>';
  };
  const order = { update: 0, pending: 1, ok: 2 };
  const docsSorted = mine.slice().sort((a, b) => order[orgState('doc', a)] - order[orgState('doc', b)]);
  const certPend = ORG.certs.filter(c => !c.valid).length;
  const upcoming = ORG.sessions.filter(x => x.status === 'agendada' && (x.email === me.email || (!x.email && me.role === 'gerente')) && new Date(x.starts_at) > new Date(Date.now() - 2 * 36e5)).length;
  const pendRed = me.role === 'gerente' ? ORG.redemptions.filter(r => r.status === 'pendiente').length : 0;
  const tabs = [['cap', 'Capacitación', items.length - done], ['cert', 'Certificaciones', certPend], ['pts', 'Puntos', pendRed], ['ases', 'Asesorías', upcoming]].concat(me.role === 'gerente' ? [['team', 'Mi equipo', 0]] : []).concat(me.role === 'gerente' && o.self_manage ? [['conf', 'Configurar', 0]] : []);
  const pts = ORG.points || {};
  const cap = '<div class="org-list">' +
      (ORG.position ? row('position', ORG.position, 'cargo', ORG.position.title, t('Descripción de tu cargo: funciones, responsabilidades e indicadores')) : '') +
      docsSorted.map(d => row('doc', d, d.kind, d.title, d.summary || d.area || '')).join('') +
      (!ORG.position && !mine.length ? '<div class="admin-empty">' + escapeHtml(t('El equipo de DGP está preparando tus capacitaciones. Aparecerán aquí muy pronto.')) + '</div>' : '') +
    '</div>';
  const conf = () => '<div class="org-config"><p class="org-config-note">' + escapeHtml(t('Aquí configuras tu empresa: equipo, niveles, cargos, procedimientos, certificaciones, premios y asesorías. Los cambios se ven al instante en el campus de cada persona.')) + '</p><div id="org-config-root"><div class="admin-empty">' + escapeHtml(t('Cargando…')) + '</div></div></div>';
  const body = { cap: () => cap, cert: orgTabCerts, pts: orgTabPoints, ases: orgTabSessions, team: orgTabTeam, conf }[ORG.tab] || (() => cap);
  root.innerHTML =
    '<div class="org-hero"><span class="org-logo">' + (o.logo_url ? '<img src="' + escapeHtml(o.logo_url) + '" alt="">' : escapeHtml(o.name.slice(0, 2).toUpperCase())) + '</span>' +
      '<div class="org-hero-txt"><b>' + escapeHtml(o.name) + '</b><small>' + escapeHtml([level, ORG.position && ORG.position.title, me.role === 'gerente' ? t('Gerente') : ''].filter(Boolean).join(' · ') || t('Equipo')) + '</small></div>' +
      '<div class="org-hero-stat"><b>' + (pts.balance || 0) + '</b><small>' + escapeHtml(t('puntos')) + '</small></div>' +
      '<div class="org-hero-prog"><div class="org-pct"><span class="org-pct-bar"><i style="width:' + pct + '%" class="' + (pct === 100 ? 'is-done' : '') + '"></i></span><b>' + pct + '%</b></div><small>' + done + ' ' + escapeHtml(t('de')) + ' ' + items.length + ' ' + escapeHtml(t('confirmados')) + '</small></div></div>' +
    '<div class="org-tabs" role="tablist">' + tabs.map(([k, label, n]) => '<button type="button" class="' + (ORG.tab === k ? 'is-on' : '') + '" onclick="orgSetTab(\'' + k + '\')">' + escapeHtml(t(label)) + (n ? '<i>' + n + '</i>' : '') + '</button>').join('') + '</div>' +
    '<div class="org-tab-body">' + body() + '</div>';
  if (ORG.tab === 'conf' && typeof orgOpenConfig === 'function') orgOpenConfig('org-config-root');
}

// Al salir de Configurar se recargan los datos para ver los cambios en las demás pestañas
function orgSetTab(k) {
  const was = ORG.tab; ORG.tab = k;
  if (was === 'conf' && k !== 'conf') loadOrgPortal(); else renderOrgPortal();
}

// ── Lector de cargo / documento ──
function orgOpen(type, id) {
  const item = type === 'position' ? ORG.position : ORG.docs.find(d => d.id === id);
  if (!item) return;
  orgOpenShell();
  const el = document.getElementById('org-modal');
  let body;
  if (type === 'position') {
    const sec = (label, txt, list) => txt ? '<h4>' + escapeHtml(t(label)) + '</h4>' + (list ? '<ul>' + oaLinesSafe(txt).map(x => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>' : '<p>' + escapeHtml(txt) + '</p>') : '';
    body = '<span class="org-kind org-kind--cargo">' + escapeHtml(t('Descripción de cargo')) + '</span><h3 class="org-doc-title">' + escapeHtml(item.title) + '</h3>' +
      '<p class="org-doc-meta">' + escapeHtml([item.area, item.reports_to ? t('Reporta a') + ': ' + item.reports_to : '', t('Versión') + ' ' + item.version].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="org-doc">' + sec('Propósito del cargo', item.purpose) + sec('Funciones principales', item.functions, true) + sec('Responsabilidades', item.responsibilities, true) +
        sec('Indicadores de desempeño', item.kpis, true) + sec('Competencias y requisitos', item.competencies, true) + '</div>';
  } else {
    body = '<span class="org-kind org-kind--' + item.kind + '">' + escapeHtml(t(item.kind === 'sop' ? 'Procedimiento (SOP)' : 'Capacitación')) + '</span><h3 class="org-doc-title">' + escapeHtml(item.title) + '</h3>' +
      '<p class="org-doc-meta">' + escapeHtml([item.area, t('Versión') + ' ' + item.version, t('Actualizado') + ' ' + new Date(item.updated_at).toLocaleDateString(locale())].filter(Boolean).join(' · ')) + '</p>' +
      (item.summary ? '<p class="org-doc-sum">' + escapeHtml(item.summary) + '</p>' : '') + '<div class="org-doc">' + orgFormat(item.body) + '</div>';
  }
  const st = orgState(type, item), a = orgAck(type, item.id);
  body += '<div class="org-confirm">' + (st === 'ok'
    ? '<span class="org-state is-ok">✓ ' + escapeHtml(t('Confirmado el')) + ' ' + escapeHtml(new Date(a.acked_at).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })) + '</span>'
    : '<p>' + escapeHtml(t(st === 'update' ? 'Este documento cambió desde la última vez que lo confirmaste. Léelo de nuevo y confírmalo.' : 'Cuando termines de leerlo, confirma que lo entendiste.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary" id="org-ack-btn" onclick="orgConfirm(\'' + type + '\', \'' + item.id + '\')">' + escapeHtml(t('He leído y entiendo este documento')) + '</button>') + '</div>';
  document.getElementById('org-modal-body').innerHTML = body;
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.querySelector('.tpl-sheet').scrollTop = 0;
}
function oaLinesSafe(s) { return String(s || '').split('\n').map(x => x.trim().replace(/^[-•*]\s*/, '')).filter(Boolean); }
function orgClose() { const el = document.getElementById('org-modal'); if (el) el.hidden = true; document.body.style.overflow = ''; }

async function orgConfirm(type, id) {
  const btn = document.getElementById('org-ack-btn'); if (btn) btn.disabled = true;
  const { data, error } = await sb.rpc('org_ack', { kind: type, item: id });
  if (error) { toast(t(rpcErrorText(error))); if (btn) btn.disabled = false; return; }
  ORG.acks = ORG.acks.filter(a => !(a.item_type === type && a.item_id === id)).concat([data]);
  toast(t('¡Listo! Quedó registrado que lo leíste.'));
  await loadOrgPortal(); orgOpen(type, id);
}
function rpcErrorText(e) { return (e && e.message) || String(e); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { orgClose(); if (typeof oaClose === 'function') oaClose(); } });

// Formulario "Diagnóstico gratis" de la página para empresas (no requiere cuenta)
async function submitOrgLead() {
  const v = id => document.getElementById(id).value.trim();
  const btn = document.getElementById('lead-btn'), err = document.getElementById('lead-error');
  err.hidden = true; btn.disabled = true;
  const { error } = await sb.rpc('submit_org_lead', { company: v('lead-company'), name: v('lead-name'), email: v('lead-email'), phone: v('lead-phone'), employees: v('lead-employees'), need: v('lead-need') });
  btn.disabled = false;
  if (error) { err.textContent = t(rpcErrorText(error)); err.hidden = false; return; }
  document.querySelectorAll('.lp-biz-form .adm-field, #lead-btn').forEach(el => { el.hidden = true; el.style.display = 'none'; });
  document.getElementById('lead-ok').hidden = false;
}

// Enlace de invitación (?registro=correo): abre el registro con el correo ya escrito
document.addEventListener('DOMContentLoaded', () => {
  let email = null;
  try { email = new URLSearchParams(location.search).get('registro'); } catch (e) {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  history.replaceState(null, '', location.pathname);
  setTimeout(() => {
    if (STATE.user) return;
    goToRegister();
    setTimeout(() => { const i = document.getElementById('input-email'); if (i) i.value = email.toLowerCase(); }, 900);
  }, 1200);
});

// ── Ranking (compartido con el panel admin) ──
function orgBoardHtml(board) {
  if (!board || !board.length) return '<div class="admin-empty">' + escapeHtml(t('Todavía no hay puntos.')) + '</div>';
  const medal = i => i < 3 ? '<span class="org-medal org-medal--' + (i + 1) + '">' + (i + 1) + '</span>' : (i + 1);
  return '<ol class="org-board">' + board.map((r, i) => '<li class="' + (r.me ? 'is-me' : '') + '"><span class="org-board-pos">' + medal(i) + '</span><b>' + escapeHtml(r.name) + (r.me ? ' <small>(' + escapeHtml(t('tú')) + ')</small>' : '') + '</b>' +
    (r.certs ? '<span class="org-board-cert">' + icon('award') + ' ' + r.certs + '</span>' : '') + '<span class="org-board-pts">' + r.points + ' pts</span></li>').join('') + '</ol>';
}

// ── Pestaña: certificaciones ──
function orgTabCerts() {
  if (!ORG.certs.length) return '<div class="admin-empty">' + escapeHtml(t('Todavía no tienes certificaciones asignadas.')) + '</div>';
  return '<div class="org-certs">' + ORG.certs.map(c => {
    const docsOk = c.docs.every(d => d.ok), v = c.valid, last = c.award;
    const exp = v && v.expires_at ? new Date(v.expires_at) : null, soon = exp && exp - Date.now() < 30 * 864e5;
    const st = v ? (soon ? ['Vence pronto', 'is-update'] : ['Certificado', 'is-ok']) : (last && last.passed ? ['Vencida: recertifícate', 'is-update'] : docsOk ? ['Listo para el examen', 'is-pending'] : ['Lee los documentos', 'is-pending']);
    return '<div class="org-cert"><div class="org-cert-top"><span class="org-cert-ic">' + icon('award') + '</span><div class="org-cert-txt"><b>' + escapeHtml(c.title) + '</b>' + (c.description ? '<small>' + escapeHtml(c.description) + '</small>' : '') + '</div>' +
        '<span class="org-state ' + st[1] + '">' + escapeHtml(t(st[0])) + '</span></div>' +
      (c.docs.length ? '<ul class="org-cert-docs">' + c.docs.map(d => '<li class="' + (d.ok ? 'is-ok' : '') + '"><button type="button" onclick="orgOpen(\'doc\', \'' + d.id + '\')">' + (d.ok ? '✓ ' : '○ ') + escapeHtml(d.title) + '</button></li>').join('') + '</ul>' : '') +
      '<div class="org-cert-foot"><small>' + c.questions + ' ' + escapeHtml(t('preguntas')) + ' · ' + escapeHtml(t('apruebas con')) + ' ' + c.pass_score + '% · +' + c.points + ' pts' + (c.valid_months ? ' · ' + escapeHtml(t('vigencia')) + ' ' + c.valid_months + ' ' + escapeHtml(t('meses')) : '') +
        (last && !last.passed ? ' · ' + escapeHtml(t('último intento')) + ': ' + last.score + '%' : '') + (exp ? ' · ' + escapeHtml(t('vence el')) + ' ' + escapeHtml(exp.toLocaleDateString(locale())) : '') + '</small>' +
        '<span class="org-cert-btns">' + (v ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgShowCert(\'' + c.id + '\')">' + escapeHtml(t('Ver certificado')) + '</button>' : '') +
        ((!v || soon) && c.questions ? '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm"' + (docsOk ? '' : ' disabled title="' + escapeHtml(t('Primero lee y confirma los documentos')) + '"') + ' onclick="orgStartExam(\'' + c.id + '\')">' + escapeHtml(t(v ? 'Recertificarme' : 'Presentar examen')) + '</button>' : '') + '</span></div></div>';
  }).join('') + '</div>';
}

function orgModalBody(html) {
  orgOpenShell();
  document.getElementById('org-modal-body').innerHTML = html;
  const el = document.getElementById('org-modal'); el.hidden = false; document.body.style.overflow = 'hidden'; el.querySelector('.tpl-sheet').scrollTop = 0;
}
function orgOpenShell() {
  if (document.getElementById('org-modal')) return;
  const el = document.createElement('div');
  el.id = 'org-modal'; el.className = 'tpl-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="tpl-modal-bg" onclick="orgClose()"></div><div class="tpl-sheet org-sheet"><button type="button" class="icon-btn tpl-x" onclick="orgClose()" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button><div id="org-modal-body"></div></div>';
  document.body.appendChild(el);
}

async function orgStartExam(id) {
  const c = ORG.certs.find(x => x.id === id);
  const { data, error } = await sb.rpc('org_exam', { cert: id });
  if (error) { toast(t(rpcErrorText(error))); return; }
  orgModalBody('<span class="org-kind org-kind--cert">' + escapeHtml(t('Examen de certificación')) + '</span><h3 class="org-doc-title">' + escapeHtml(c.title) + '</h3>' +
    '<p class="org-doc-meta">' + data.length + ' ' + escapeHtml(t('preguntas')) + ' · ' + escapeHtml(t('apruebas con')) + ' ' + c.pass_score + '% · ' + escapeHtml(t('máximo 3 intentos por día')) + '</p>' +
    '<form class="org-exam" onsubmit="event.preventDefault();orgSubmitExam(\'' + id + '\', ' + data.length + ')">' + data.map((q, i) =>
      '<fieldset class="org-q"><legend><span>' + (i + 1) + '</span>' + escapeHtml(q.q) + '</legend>' + q.options.map((o, j) => '<label class="org-opt"><input type="radio" name="oq' + i + '" value="' + j + '" required><span>' + escapeHtml(o) + '</span></label>').join('') + '</fieldset>').join('') +
    '<p class="modal-error" id="org-exam-err" hidden></p><button class="ui-btn ui-btn--primary" id="org-exam-btn">' + escapeHtml(t('Enviar respuestas')) + '</button></form>');
}

async function orgSubmitExam(id, n) {
  const answers = [];
  for (let i = 0; i < n; i++) { const el = document.querySelector('input[name="oq' + i + '"]:checked'); answers.push(el ? Number(el.value) : -1); }
  const btn = document.getElementById('org-exam-btn'), err = document.getElementById('org-exam-err');
  btn.disabled = true; err.hidden = true;
  const { data, error } = await sb.rpc('org_submit_exam', { cert: id, answers });
  if (error) { err.textContent = t(rpcErrorText(error)); err.hidden = false; btn.disabled = false; return; }
  await loadOrgPortal();
  const c = ORG.certs.find(x => x.id === id);
  orgModalBody('<div class="org-result ' + (data.passed ? 'is-ok' : 'is-fail') + '"><span class="org-result-ic">' + (data.passed ? icon('award') : icon('book')) + '</span>' +
    '<h3>' + escapeHtml(t(data.passed ? '¡Aprobaste!' : 'Esta vez no alcanzó')) + '</h3><p class="org-result-score">' + data.score + '%</p>' +
    '<p>' + escapeHtml(data.good + ' ' + t('de') + ' ' + data.total + ' ' + t('respuestas correctas') + '. ' + (data.passed ? t('Ganaste') + ' ' + c.points + ' ' + t('puntos y tu certificado ya está disponible.') : t('Repasa los documentos y vuelve a intentarlo; necesitas') + ' ' + c.pass_score + '%.')) + '</p>' +
    (data.passed ? '<button type="button" class="ui-btn ui-btn--primary" onclick="orgShowCert(\'' + id + '\')">' + escapeHtml(t('Ver mi certificado')) + '</button>' : '<button type="button" class="ui-btn ui-btn--ghost" onclick="orgClose()">' + escapeHtml(t('Volver')) + '</button>') + '</div>');
}

// Certificado con el logo de la empresa, DGP Academy y Moya & Company (se puede imprimir o guardar en PDF)
function orgShowCert(id) {
  const c = ORG.certs.find(x => x.id === id), a = c && c.valid;
  if (!a) return;
  const o = ORG.org, d = s => new Date(s).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  orgModalBody('<div class="org-certificate" id="org-certificate">' +
      '<div class="org-certificate-logos">' + (o.logo_url ? '<img src="' + escapeHtml(o.logo_url) + '" alt="">' : '<span class="org-logo">' + escapeHtml(o.name.slice(0, 2).toUpperCase()) + '</span>') +
        '<span class="org-certificate-brand"><svg class="brand-mark"><use href="#dgp-mark"/></svg>DGP Academy <i>×</i> <img src="assets/img/moya-mark-sm.png" alt=""> Moya &amp; Company</span></div>' +
      '<p class="org-certificate-kicker">' + escapeHtml(t('Certificado de competencia')) + '</p>' +
      '<p class="org-certificate-to">' + escapeHtml(t('Se otorga a')) + '</p><h2>' + escapeHtml(a.full_name || ORG.me.full_name || ORG.me.email) + '</h2>' +
      '<p class="org-certificate-for">' + escapeHtml(t('por aprobar la certificación')) + '</p><h3>' + escapeHtml(c.title) + '</h3>' +
      '<p class="org-certificate-org">' + escapeHtml(o.name) + ' · ' + escapeHtml(t('Puntaje')) + ' ' + a.score + '%</p>' +
      '<div class="org-certificate-foot"><span><b>' + escapeHtml(d(a.issued_at)) + '</b>' + escapeHtml(t('Fecha de emisión')) + '</span><span><b>' + escapeHtml(a.expires_at ? d(a.expires_at) : t('Sin vencimiento')) + '</b>' + escapeHtml(t('Vigente hasta')) + '</span><span><b>' + escapeHtml(a.number || '') + '</b>' + escapeHtml(t('Número')) + '</span></div>' +
    '</div><div class="tpl-actions"><button type="button" class="ui-btn ui-btn--primary" onclick="orgPrintCert()">' + escapeHtml(t('Imprimir o guardar PDF')) + '</button></div>');
}
function orgPrintCert() { document.body.classList.add('print-org-cert'); window.print(); setTimeout(() => document.body.classList.remove('print-org-cert'), 600); }

// ── Pestaña: puntos y premios ──
function orgTabPoints() {
  const p = ORG.points || {}, me = ORG.me, mgr = me.role === 'gerente';
  const mine = ORG.redemptions.filter(r => r.email === me.email);
  const RED = { pendiente: ['Pendiente', 'is-pending'], aprobado: ['Aprobado', 'is-ok'], entregado: ['Entregado', 'is-ok'], rechazado: ['Rechazado', 'is-update'] };
  return '<div class="org-pts">' +
    '<div class="org-pts-card"><b>' + (p.balance || 0) + '</b><span>' + escapeHtml(t('puntos disponibles')) + '</span><small>' + escapeHtml(t('Ganados')) + ': ' + (p.earned || 0) + ' · ' + escapeHtml(t('Usados')) + ': ' + (p.spent || 0) + '</small>' +
      '<ul><li>' + escapeHtml(t('Documentos confirmados')) + ' <b>' + (p.docs || 0) + '</b></li><li>' + escapeHtml(t('Cargo confirmado')) + ' <b>' + (p.position || 0) + '</b></li><li>' + escapeHtml(t('Certificaciones')) + ' <b>' + (p.certs || 0) + '</b></li><li>' + escapeHtml(t('Reconocimientos')) + ' <b>' + (p.bonus || 0) + '</b></li></ul></div>' +
    '<div><h4 class="org-sub">' + escapeHtml(t('Ranking del equipo')) + '</h4>' + orgBoardHtml(ORG.board) + '</div></div>' +
    '<h4 class="org-sub">' + escapeHtml(t('Premios')) + '</h4>' +
    (ORG.rewards.length ? '<div class="org-rewards">' + ORG.rewards.map(r => '<div class="org-reward"><b>' + escapeHtml(r.title) + '</b>' + (r.description ? '<small>' + escapeHtml(r.description) + '</small>' : '') +
      '<div><span class="org-board-pts">' + r.cost + ' pts</span><button type="button" class="ui-btn ui-btn--' + ((p.balance || 0) >= r.cost ? 'primary' : 'ghost') + ' ui-btn--sm"' + ((p.balance || 0) >= r.cost ? '' : ' disabled') + ' onclick="orgRedeem(\'' + r.id + '\')">' + escapeHtml(t('Canjear')) + '</button></div></div>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Tu empresa aún no ha definido premios.')) + '</div>') +
    (mine.length ? '<h4 class="org-sub">' + escapeHtml(t('Mis canjes')) + '</h4><div class="org-list">' + mine.map(r => '<div class="org-item"><span class="org-item-txt"><b>' + escapeHtml(r.title) + '</b><small>' + r.cost + ' pts · ' + escapeHtml(new Date(r.created_at).toLocaleDateString(locale())) + '</small></span><span class="org-state ' + RED[r.status][1] + '">' + escapeHtml(t(RED[r.status][0])) + '</span></div>').join('') + '</div>' : '') +
    (ORG.bonus.filter(b => b.email === me.email).length ? '<h4 class="org-sub">' + escapeHtml(t('Reconocimientos recibidos')) + '</h4><div class="org-list">' + ORG.bonus.filter(b => b.email === me.email).map(b => '<div class="org-item"><span class="org-item-txt"><b>' + escapeHtml(b.reason) + '</b><small>' + escapeHtml(new Date(b.created_at).toLocaleDateString(locale())) + '</small></span><span class="org-board-pts">' + (b.points > 0 ? '+' : '') + b.points + '</span></div>').join('') + '</div>' : '') +
    (mgr ? orgManagerPoints() : '');
}

function orgManagerPoints() {
  const pend = ORG.redemptions.filter(r => r.status === 'pendiente' || r.status === 'aprobado');
  const name = e => { const r = ORG.comp.find(x => x.email === e); return (r && r.full_name) || e; };
  return '<div class="org-mgr"><h4 class="org-sub">' + escapeHtml(t('Gerente: canjes por aprobar')) + '</h4>' +
    (pend.length ? '<div class="org-list">' + pend.map(r => '<div class="org-item"><span class="org-item-txt"><b>' + escapeHtml(name(r.email)) + ' · ' + escapeHtml(r.title) + '</b><small>' + r.cost + ' pts · ' + escapeHtml(t(r.status === 'pendiente' ? 'Pendiente' : 'Aprobado')) + '</small></span><span class="org-cert-btns">' +
      (r.status === 'pendiente' ? '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="orgDecide(\'' + r.id + '\', \'aprobado\')">' + escapeHtml(t('Aprobar')) + '</button><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgDecide(\'' + r.id + '\', \'rechazado\')">' + escapeHtml(t('Rechazar')) + '</button>'
        : '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgDecide(\'' + r.id + '\', \'entregado\')">' + escapeHtml(t('Marcar entregado')) + '</button>') + '</span></div>').join('') + '</div>'
      : '<p class="oa-help">' + escapeHtml(t('No hay canjes pendientes.')) + '</p>') +
    '<h4 class="org-sub">' + escapeHtml(t('Gerente: reconocer a alguien del equipo')) + '</h4>' +
    '<form class="oa-bonus" onsubmit="event.preventDefault();orgGivePoints()"><select class="form-input" id="org-g-email" required><option value="">' + escapeHtml(t('Elige a la persona')) + '</option>' + ORG.comp.filter(r => r.active && r.email !== ORG.me.email).map(r => '<option value="' + escapeHtml(r.email) + '">' + escapeHtml(r.full_name || r.email) + '</option>').join('') + '</select>' +
      '<input class="form-input" id="org-g-pts" type="number" min="1" max="500" required placeholder="' + escapeHtml(t('Puntos')) + '"><input class="form-input" id="org-g-why" required maxlength="200" placeholder="' + escapeHtml(t('Motivo del reconocimiento')) + '"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Dar puntos')) + '</button></form></div>';
}

async function orgRedeem(id) {
  const r = ORG.rewards.find(x => x.id === id);
  if (!confirm(t('¿Canjear') + ' "' + r.title + '" ' + t('por') + ' ' + r.cost + ' ' + t('puntos?'))) return;
  const { error } = await sb.rpc('org_redeem', { reward: id });
  if (error) { toast(t(rpcErrorText(error))); return; }
  toast(t('¡Canje solicitado! Tu gerente lo aprobará.')); await loadOrgPortal();
}
async function orgDecide(id, status) {
  const { error } = await sb.rpc('org_decide_redemption', { red: id, new_status: status });
  if (error) { toast(t(rpcErrorText(error))); return; }
  await loadOrgPortal();
}
async function orgGivePoints() {
  const v = id => document.getElementById(id).value.trim();
  const { error } = await sb.rpc('org_give_points', { target: v('org-g-email'), pts: parseInt(v('org-g-pts'), 10) || 0, why: v('org-g-why') });
  if (error) { toast(t(rpcErrorText(error))); return; }
  toast(t('¡Reconocimiento enviado!')); await loadOrgPortal();
}

// ── Pestaña: asesorías ──
function orgTabSessions() {
  const me = ORG.me, mgr = me.role === 'gerente';
  const mine = ORG.sessions.filter(x => x.email === me.email || (!x.email && mgr));
  const team = mgr ? ORG.sessions.filter(x => x.email && x.email !== me.email) : [];
  const now = Date.now();
  const card = (x, showWho) => {
    const when = new Date(x.starts_at), live = x.status === 'agendada' && when.getTime() + x.minutes * 6e4 > now;
    const who = showWho ? ((ORG.comp.find(r => r.email === x.email) || {}).full_name || x.email || t('Empresa / gerencia')) + ' · ' : '';
    const canTick = x.email === me.email || mgr;
    return '<div class="org-session' + (live ? ' is-live' : '') + '"><div class="org-session-top"><div><b>' + escapeHtml(x.title) + '</b><small>' + escapeHtml(who + when.toLocaleString(locale(), { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) + ' · ' + x.minutes + ' min') + '</small></div>' +
      (live && x.meet_url ? '<a class="ui-btn ui-btn--primary ui-btn--sm" href="' + escapeHtml(x.meet_url) + '" target="_blank" rel="noopener">' + escapeHtml(t('Entrar a la videollamada')) + '</a>' : '<span class="org-state ' + (x.status === 'realizada' ? 'is-ok' : x.status === 'cancelada' ? 'is-update' : 'is-pending') + '">' + escapeHtml(t({ agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }[x.status])) + '</span>') + '</div>' +
      (x.notes ? '<div class="org-session-notes"><b>' + escapeHtml(t('Notas')) + '</b><p>' + escapeHtml(x.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      ((x.tasks || []).length ? '<ul class="org-tasks">' + x.tasks.map((tk, i) => '<li><label><input type="checkbox"' + (tk.done ? ' checked' : '') + (canTick ? '' : ' disabled') + ' onchange="orgToggleTask(\'' + x.id + '\', ' + i + ', this)"><span>' + escapeHtml(tk.t) + '</span></label></li>').join('') + '</ul>' : '') + '</div>';
  };
  return (mine.length ? mine.map(x => card(x, false)).join('') : '<div class="admin-empty">' + escapeHtml(t('Aún no tienes asesorías. El equipo de DGP te avisará cuando agende una contigo.')) + '</div>') +
    (team.length ? '<h4 class="org-sub">' + escapeHtml(t('Asesorías de mi equipo')) + '</h4>' + team.map(x => card(x, true)).join('') : '');
}
async function orgToggleTask(id, i, box) {
  const { data, error } = await sb.rpc('org_task_toggle', { sess: id, idx: i });
  if (error) { toast(t(rpcErrorText(error))); box.checked = !box.checked; return; }
  const s = ORG.sessions.find(x => x.id === id); if (s) s.tasks = data;
}

// ── Pestaña: mi equipo (gerente) ──
function orgTabTeam() {
  return '<div class="org-team-head"><h3>' + escapeHtml(t('Cumplimiento de mi equipo')) + '</h3><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgExportCsv(ORG.comp, ORG.org.name)">' + escapeHtml(t('Exportar a Excel')) + '</button></div>' + orgComplianceTable(ORG.comp);
}
