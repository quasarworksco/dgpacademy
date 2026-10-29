// =========================================================
// DGP Empresas — portal del empleado y vista del gerente (sección "Mi empresa" del campus)
// Cada persona ve su cargo y los SOPs / capacitaciones asignados a su nivel o cargo,
// y los confirma como leídos. El gerente ve además el cumplimiento de su equipo.
// =========================================================
const ORG = { me: null, org: null, levels: [], position: null, docs: [], acks: [], comp: [], loaded: false };

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
    '<div class="oa-table-wrap"><table class="oa-table org-comp"><thead><tr><th>' + escapeHtml(t('Persona')) + '</th><th>' + escapeHtml(t('Nivel y cargo')) + '</th><th>' + escapeHtml(t('Documentos')) + '</th><th>' + escapeHtml(t('Cargo')) + '</th><th>' + escapeHtml(t('Cumplimiento')) + '</th></tr></thead><tbody>' +
    rows.map(r => {
      const pct = orgPct(r);
      return '<tr class="' + (r.active ? '' : 'is-off') + '"><td><b>' + escapeHtml(r.full_name || r.email) + '</b><small>' + escapeHtml(r.email) + (r.registered ? '' : ' · ' + t('falta registrarse')) + '</small></td>' +
        '<td>' + escapeHtml([r.level, r.position].filter(Boolean).join(' · ') || '—') + '</td>' +
        '<td>' + r.done + ' / ' + r.assigned + '</td>' +
        '<td>' + (r.position ? (r.position_ok ? '<span class="org-ok">✓</span>' : '<span class="org-pend">' + escapeHtml(t('Pendiente')) + '</span>') : '—') + '</td>' +
        '<td><div class="org-pct"><span class="org-pct-bar"><i style="width:' + pct + '%" class="' + (pct === 100 ? 'is-done' : pct < 50 ? 'is-low' : '') + '"></i></span><b>' + pct + '%</b></div></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function orgExportCsv(rows, name) {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = [t('Nombre'), t('Correo'), t('Nivel'), t('Cargo'), t('Área'), t('Rol'), t('Documentos confirmados'), t('Documentos asignados'), t('Cargo confirmado'), t('Cumplimiento %'), t('Registrado'), t('Activo')];
  const lines = (rows || []).map(r => [r.full_name, r.email, r.level, r.position, r.area, r.role, r.done, r.assigned, r.position ? (r.position_ok ? t('Sí') : t('No')) : '', orgPct(r), r.registered ? t('Sí') : t('No'), r.active ? t('Sí') : t('No')].map(esc).join(','));
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
  ORG.comp = [];
  if (me.role === 'gerente') { const c = await sb.rpc('org_compliance', { o: org.id }); ORG.comp = c.data || []; }
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
  root.innerHTML =
    '<div class="org-hero"><span class="org-logo">' + (o.logo_url ? '<img src="' + escapeHtml(o.logo_url) + '" alt="">' : escapeHtml(o.name.slice(0, 2).toUpperCase())) + '</span>' +
      '<div class="org-hero-txt"><b>' + escapeHtml(o.name) + '</b><small>' + escapeHtml([level, ORG.position && ORG.position.title, me.role === 'gerente' ? t('Gerente') : ''].filter(Boolean).join(' · ') || t('Equipo')) + '</small></div>' +
      '<div class="org-hero-prog"><div class="org-pct"><span class="org-pct-bar"><i style="width:' + pct + '%" class="' + (pct === 100 ? 'is-done' : '') + '"></i></span><b>' + pct + '%</b></div><small>' + done + ' ' + escapeHtml(t('de')) + ' ' + items.length + ' ' + escapeHtml(t('confirmados')) + '</small></div></div>' +
    '<div class="org-list">' +
      (ORG.position ? row('position', ORG.position, 'cargo', ORG.position.title, t('Descripción de tu cargo: funciones, responsabilidades e indicadores')) : '') +
      docsSorted.map(d => row('doc', d, d.kind, d.title, d.summary || d.area || '')).join('') +
      (!ORG.position && !mine.length ? '<div class="admin-empty">' + escapeHtml(t('El equipo de DGP está preparando tus capacitaciones. Aparecerán aquí muy pronto.')) + '</div>' : '') +
    '</div>' +
    (me.role === 'gerente' ? '<div class="org-team"><div class="org-team-head"><h3>' + escapeHtml(t('Cumplimiento de mi equipo')) + '</h3><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgExportCsv(ORG.comp, ORG.org.name)">' + escapeHtml(t('Exportar a Excel')) + '</button></div>' + orgComplianceTable(ORG.comp) + '</div>' : '');
}

// ── Lector de cargo / documento ──
function orgOpen(type, id) {
  const item = type === 'position' ? ORG.position : ORG.docs.find(d => d.id === id);
  if (!item) return;
  let el = document.getElementById('org-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'org-modal'; el.className = 'tpl-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="tpl-modal-bg" onclick="orgClose()"></div><div class="tpl-sheet org-sheet"><button type="button" class="icon-btn tpl-x" onclick="orgClose()" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button><div id="org-modal-body"></div></div>';
    document.body.appendChild(el);
  }
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
  renderOrgPortal(); orgOpen(type, id);
  if (ORG.me.role === 'gerente') sb.rpc('org_compliance', { o: ORG.org.id }).then(r => { ORG.comp = r.data || ORG.comp; renderOrgPortal(); });
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
