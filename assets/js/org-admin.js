// =========================================================
// DGP Empresas — panel admin (permiso 'empresas')
// El equipo DGP administra todo: empresas, empleados, niveles, cargos, SOPs y capacitaciones.
// El gerente de cada empresa solo ve resultados desde su campus, salvo las empresas
// marcadas como "se configura sola" (socio): ahí su gerente usa este mismo editor
// para su propia empresa, desde la pestaña Configurar del campus.
// =========================================================
const OA = { rootId: 'oa-root', self: false, orgs: [], leads: [], counts: {}, cur: null, view: 'equipo', levels: [], positions: [], members: [], docs: [], comp: [], certs: [], awards: [], rewards: [], redemptions: [], sessions: [], points: [], board: [] };
const oaRoot = () => document.getElementById(OA.rootId);
const oaId = id => String(id || '').replace(/[^a-f0-9-]/g, '');
const oaLines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

async function loadOrgsAdmin() {
  OA.self = false; OA.rootId = 'oa-root';
  const root = oaRoot();
  if (!root) return;
  const [orgs, leads, mem] = await Promise.all([
    sb.from('orgs').select('*').order('created_at', { ascending: false }),
    sb.from('org_leads').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('org_members').select('org_id, active')
  ]);
  if (orgs.error) { root.innerHTML = '<div class="admin-empty is-error">' + escapeHtml(rpcError(orgs.error)) + '</div>'; return; }
  OA.orgs = orgs.data || []; OA.leads = leads.data || [];
  OA.counts = {};
  (mem.data || []).forEach(m => { if (m.active) OA.counts[m.org_id] = (OA.counts[m.org_id] || 0) + 1; });
  const badge = document.getElementById('adm-org-badge');
  const fresh = OA.leads.filter(l => l.status === 'nuevo').length;
  if (badge) { badge.hidden = !fresh; badge.textContent = fresh; }
  if (OA.cur && OA.orgs.some(o => o.id === OA.cur)) await loadOrgDetail(OA.cur);
  else { OA.cur = null; renderOrgList(); }
}

// ── Lista de empresas y solicitudes ──
function renderOrgList() {
  const root = oaRoot();
  const active = OA.orgs.filter(o => o.status === 'activo');
  const employees = Object.values(OA.counts).reduce((a, n) => a + n, 0);
  const fresh = OA.leads.filter(l => l.status === 'nuevo');
  root.innerHTML =
    '<div class="adm-kpis adm-kpis--4">' +
      '<div class="adm-kpi"><span class="adm-kpi-label">' + escapeHtml(t('Empresas activas')) + '</span><b class="adm-kpi-num">' + active.length + '</b><span class="adm-kpi-foot">' + OA.orgs.length + ' ' + escapeHtml(t('en total')) + '</span></div>' +
      '<div class="adm-kpi"><span class="adm-kpi-label">' + escapeHtml(t('Empleados')) + '</span><b class="adm-kpi-num">' + employees + '</b><span class="adm-kpi-foot">' + escapeHtml(t('con acceso a su empresa')) + '</span></div>' +
      '<div class="adm-kpi adm-kpi--warn"><span class="adm-kpi-label">' + escapeHtml(t('Solicitudes nuevas')) + '</span><b class="adm-kpi-num">' + fresh.length + '</b><span class="adm-kpi-foot">' + escapeHtml(t('Diagnóstico gratis')) + '</span></div>' +
      '<div class="adm-kpi"><span class="adm-kpi-label">' + escapeHtml(t('Cupos contratados')) + '</span><b class="adm-kpi-num">' + active.reduce((a, o) => a + (o.seats || 0), 0) + '</b><span class="adm-kpi-foot">' + escapeHtml(t('suma de todas las empresas')) + '</span></div>' +
    '</div>' +
    '<div class="oa-head"><h2>' + escapeHtml(t('Empresas')) + '</h2><button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaOrgForm()">+ ' + escapeHtml(t('Nueva empresa')) + '</button></div>' +
    (OA.orgs.length ? '<div class="oa-orgs">' + OA.orgs.map(o =>
      '<button type="button" class="oa-org" onclick="loadOrgDetail(\'' + oaId(o.id) + '\')">' +
        '<span class="oa-org-logo">' + (o.logo_url ? '<img src="' + escapeHtml(o.logo_url) + '" alt="">' : escapeHtml((o.name || '?').slice(0, 2).toUpperCase())) + '</span>' +
        '<span class="oa-org-txt"><b>' + escapeHtml(o.name) + (o.self_manage ? ' <span class="oa-chip">' + escapeHtml(t('Socio')) + '</span>' : '') + '</b><small>' + escapeHtml([o.industry, (OA.counts[o.id] || 0) + ' / ' + o.seats + ' ' + t('empleados')].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="pay-status ' + (o.status === 'activo' ? 'is-paid' : 'is-pending') + '">' + escapeHtml(t(o.status === 'activo' ? 'Activa' : 'Pausada')) + '</span></button>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Aún no hay empresas. Crea la primera con el botón "Nueva empresa".')) + '</div>') +
    '<div class="oa-head"><h2>' + escapeHtml(t('Solicitudes de diagnóstico')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('Llegan desde la página Para empresas')) + '</span></div>' +
    (OA.leads.length ? '<div class="oa-leads">' + OA.leads.map(l =>
      '<div class="oa-lead' + (l.status === 'nuevo' ? ' is-new' : '') + '"><div class="oa-lead-main"><b>' + escapeHtml(l.company) + '</b><small>' + escapeHtml(l.name) + ' · <a href="mailto:' + escapeHtml(l.email) + '">' + escapeHtml(l.email) + '</a>' + (l.phone ? ' · ' + escapeHtml(l.phone) : '') + (l.employees ? ' · ' + escapeHtml(l.employees) + ' ' + escapeHtml(t('empleados')) : '') + '</small>' +
        (l.need ? '<p>' + escapeHtml(l.need) + '</p>' : '') + '<small class="oa-date">' + escapeHtml(new Date(l.created_at).toLocaleString(locale())) + '</small></div>' +
        '<div class="oa-lead-actions"><select class="form-input" onchange="oaLeadStatus(\'' + oaId(l.id) + '\', this.value)">' + ['nuevo', 'contactado', 'cliente', 'descartado'].map(s => '<option value="' + s + '"' + (s === l.status ? ' selected' : '') + '>' + escapeHtml(t({ nuevo: 'Nueva', contactado: 'Contactado', cliente: 'Ya es cliente', descartado: 'Descartada' }[s])) + '</option>').join('') + '</select>' +
        '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaOrgForm(null, \'' + oaId(l.id) + '\')">' + escapeHtml(t('Crear empresa')) + '</button></div></div>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Todavía no hay solicitudes.')) + '</div>');
}

async function oaLeadStatus(id, status) {
  const { error } = await sb.from('org_leads').update({ status }).eq('id', id);
  if (error) { toast(rpcError(error)); return; }
  const l = OA.leads.find(x => x.id === id); if (l) l.status = status;
  const badge = document.getElementById('adm-org-badge');
  const fresh = OA.leads.filter(x => x.status === 'nuevo').length;
  if (badge) { badge.hidden = !fresh; badge.textContent = fresh; }
}

// ── Ventana de formularios ──
function oaModal(html) {
  let el = document.getElementById('oa-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'oa-modal'; el.className = 'tpl-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="tpl-modal-bg" onclick="oaClose()"></div><div class="tpl-sheet oa-sheet"><button type="button" class="icon-btn tpl-x" onclick="oaClose()" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button><div id="oa-modal-body"></div></div>';
    document.body.appendChild(el);
  }
  document.getElementById('oa-modal-body').innerHTML = html;
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.querySelector('.tpl-sheet').scrollTop = 0;
}
function oaClose() { const el = document.getElementById('oa-modal'); if (el) el.hidden = true; document.body.style.overflow = ''; }
const oaField = (label, input, wide) => '<label class="adm-field' + (wide ? ' adm-field--wide' : '') + '"><span>' + escapeHtml(t(label)) + '</span>' + input + '</label>';
const oaInput = (id, val, attrs) => '<input class="form-input" id="' + id + '" value="' + escapeHtml(val == null ? '' : val) + '" ' + (attrs || '') + '>';
const oaArea = (id, val, rows, ph) => '<textarea class="form-input" id="' + id + '" rows="' + (rows || 3) + '"' + (ph ? ' placeholder="' + escapeHtml(t(ph)) + '"' : '') + '>' + escapeHtml(val || '') + '</textarea>';
const oaVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
function oaErr(msg) { const e = document.getElementById('oa-err'); if (e) { e.textContent = t(msg); e.hidden = false; } else toast(t(msg)); }

// ── Empresa: crear o editar ──
function oaOrgForm(id, leadId) {
  const o = id ? OA.orgs.find(x => x.id === id) : {};
  const l = leadId ? OA.leads.find(x => x.id === leadId) : null;
  const v = (k, lk) => (o && o[k] != null ? o[k] : (l && lk ? l[lk] : ''));
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Editar empresa' : 'Nueva empresa')) + '</h3>' +
    '<form onsubmit="event.preventDefault();oaSaveOrg(\'' + oaId(id) + '\', \'' + oaId(leadId) + '\')"><div class="adm-form-grid">' +
      oaField('Nombre de la empresa', oaInput('oa-o-name', v('name', 'company'), 'required maxlength="120"'), true) +
      oaField('Rubro', oaInput('oa-o-industry', v('industry'), 'maxlength="80" placeholder="' + escapeHtml(t('Ej.: restaurante, clínica, constructora')) + '"')) +
      oaField('Cupos de empleados', oaInput('oa-o-seats', v('seats') || 10, 'type="number" min="1" max="5000" required')) +
      oaField('Persona de contacto', oaInput('oa-o-cname', v('contact_name', 'name'), 'maxlength="120"')) +
      oaField('Correo de contacto', oaInput('oa-o-cemail', v('contact_email', 'email'), 'type="email" maxlength="160"')) +
      oaField('Teléfono', oaInput('oa-o-cphone', v('contact_phone', 'phone'), 'maxlength="40"')) +
      oaField('Logo (enlace de la imagen, opcional)', oaInput('oa-o-logo', v('logo_url'), 'type="url" maxlength="400" placeholder="https://"')) +
      (id ? oaField('Estado', '<select class="form-input" id="oa-o-status"><option value="activo"' + (o.status === 'activo' ? ' selected' : '') + '>' + escapeHtml(t('Activa')) + '</option><option value="pausado"' + (o.status === 'pausado' ? ' selected' : '') + '>' + escapeHtml(t('Pausada (los empleados no la ven)')) + '</option></select>') : '') +
      oaField('Notas internas', oaArea('oa-o-notes', v('notes', 'need'), 3), true) +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' +
      (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteOrg(\'' + oaId(id) + '\')">' + escapeHtml(t('Eliminar empresa')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}

async function oaSaveOrg(id, leadId) {
  const row = { name: oaVal('oa-o-name'), industry: oaVal('oa-o-industry') || null, seats: parseInt(oaVal('oa-o-seats'), 10) || 10,
    contact_name: oaVal('oa-o-cname') || null, contact_email: oaVal('oa-o-cemail').toLowerCase() || null, contact_phone: oaVal('oa-o-cphone') || null,
    logo_url: /^https:\/\//.test(oaVal('oa-o-logo')) ? oaVal('oa-o-logo') : null, notes: oaVal('oa-o-notes') || null,
  };
  if (id) row.status = oaVal('oa-o-status') || 'activo';
  const q = id ? sb.from('orgs').update(row).eq('id', id).select().single() : sb.from('orgs').insert(row).select().single();
  const { data, error } = await q;
  if (error) { oaErr(rpcError(error)); return; }
  if (leadId) await sb.from('org_leads').update({ status: 'cliente' }).eq('id', leadId);
  oaClose(); toast(t('Empresa guardada'));
  OA.cur = data.id; OA.view = id ? OA.view : 'equipo';
  loadOrgsAdmin();
}

async function oaDeleteOrg(id) {
  const o = OA.orgs.find(x => x.id === id);
  if (!o || !confirm(t('¿Eliminar la empresa') + ' "' + o.name + '"? ' + t('Se borrarán sus empleados, cargos, documentos y confirmaciones. No se puede deshacer.'))) return;
  const { error } = await sb.from('orgs').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); OA.cur = null; toast(t('Empresa eliminada')); loadOrgsAdmin();
}

// ── Detalle de una empresa ──
async function loadOrgDetail(id) {
  OA.cur = id;
  const root = oaRoot();
  const [lv, ps, mb, dc, cp, ce, aw, rw, rd, ss, pt, lb] = await Promise.all([
    sb.from('org_levels').select('*').eq('org_id', id).order('rank'),
    sb.from('org_positions').select('*').eq('org_id', id).order('title'),
    sb.from('org_members').select('*').eq('org_id', id).order('full_name'),
    sb.from('org_docs').select('*').eq('org_id', id).order('updated_at', { ascending: false }),
    sb.rpc('org_compliance', { o: id }),
    sb.from('org_certs').select('*').eq('org_id', id).order('title'),
    sb.from('org_cert_awards').select('*').eq('org_id', id).order('issued_at', { ascending: false }).limit(500),
    sb.from('org_rewards').select('*').eq('org_id', id).order('cost'),
    sb.from('org_redemptions').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(300),
    sb.from('org_sessions').select('*').eq('org_id', id).order('starts_at', { ascending: false }).limit(300),
    sb.from('org_points').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(300),
    sb.rpc('org_leaderboard', { o: id })
  ]);
  const err = [lv, ps, mb, dc, cp, ce, aw, rw, rd, ss, pt, lb].find(r => r.error);
  if (err) { root.innerHTML = '<div class="admin-empty is-error">' + escapeHtml(rpcError(err.error)) + '</div>'; return; }
  OA.levels = lv.data || []; OA.positions = ps.data || []; OA.members = mb.data || []; OA.docs = dc.data || []; OA.comp = cp.data || [];
  OA.certs = ce.data || []; OA.awards = aw.data || []; OA.rewards = rw.data || []; OA.redemptions = rd.data || []; OA.sessions = ss.data || []; OA.points = pt.data || []; OA.board = lb.data || [];
  renderOrgDetail();
}

function oaLevelName(id) { const l = OA.levels.find(x => x.id === id); return l ? l.name : ''; }
function oaPosName(id) { const p = OA.positions.find(x => x.id === id); return p ? p.title : ''; }

function renderOrgDetail() {
  const o = OA.orgs.find(x => x.id === OA.cur);
  if (!o) { OA.cur = null; renderOrgList(); return; }
  const root = oaRoot();
  const pendRed = OA.redemptions.filter(r => r.status === 'pendiente').length;
  const tabs = [['equipo', 'Equipo', OA.members.length], ['niveles', 'Niveles', OA.levels.length], ['cargos', 'Cargos', OA.positions.length], ['docs', 'SOPs y capacitaciones', OA.docs.length],
    ['certs', 'Certificaciones', OA.certs.length], ['puntos', 'Puntos y premios', pendRed || null], ['sesiones', 'Asesorías', OA.sessions.filter(x => x.status === 'agendada').length || null], ['cumplimiento', 'Cumplimiento']];
  root.innerHTML =
    '<div class="oa-detail-head">' + (OA.self ? '' : '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="OA.cur=null;renderOrgList()">← ' + escapeHtml(t('Empresas')) + '</button>') +
      '<div class="oa-detail-title"><span class="oa-org-logo">' + (o.logo_url ? '<img src="' + escapeHtml(o.logo_url) + '" alt="">' : escapeHtml(o.name.slice(0, 2).toUpperCase())) + '</span><div><h2>' + escapeHtml(o.name) + '</h2><small>' + escapeHtml([o.industry, OA.members.filter(m => m.active).length + ' / ' + o.seats + ' ' + t('empleados'), o.contact_name, o.contact_email].filter(Boolean).join(' · ')) + '</small></div></div>' +
      (OA.self ? '' : '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaOrgForm(\'' + oaId(o.id) + '\')">' + escapeHtml(t('Editar empresa')) + '</button>') + '</div>' +
    '<div class="adm-seg adm-seg--wide">' + tabs.map(([k, label, n]) => '<button class="' + (OA.view === k ? 'is-active' : '') + '" onclick="OA.view=\'' + k + '\';renderOrgDetail()">' + escapeHtml(t(label)) + (n != null ? ' <small>' + n + '</small>' : '') + '</button>').join('') + '</div>' +
    '<div id="oa-body">' + ({ equipo: oaTeam, niveles: oaLevels, cargos: oaPositions, docs: oaDocs, certs: oaCerts, puntos: oaPoints, sesiones: oaSessions, cumplimiento: oaCompliance }[OA.view] || oaTeam)() + '</div>';
}

// ── Equipo ──
function oaTeam() {
  const o = OA.orgs.find(x => x.id === OA.cur);
  const comp = {}; OA.comp.forEach(c => { comp[c.email] = c; });
  const used = OA.members.filter(m => m.active).length;
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Agrega a cada empleado con su correo. Cuando se registre en la academia con ese correo verá automáticamente su empresa, su cargo y sus capacitaciones.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaMemberForm()"' + (used >= o.seats ? ' disabled title="' + escapeHtml(t('Sin cupos disponibles')) + '"' : '') + '>+ ' + escapeHtml(t('Agregar empleado')) + '</button></div>' +
    (OA.members.length ? '<div class="oa-table-wrap"><table class="oa-table"><thead><tr><th>' + escapeHtml(t('Empleado')) + '</th><th>' + escapeHtml(t('Nivel')) + '</th><th>' + escapeHtml(t('Cargo')) + '</th><th>' + escapeHtml(t('Estado')) + '</th><th></th></tr></thead><tbody>' +
      OA.members.map(m => {
        const c = comp[m.email] || {};
        return '<tr class="' + (m.active ? '' : 'is-off') + '"><td><b>' + escapeHtml(m.full_name || m.email) + '</b>' + (m.role === 'gerente' ? ' <span class="oa-chip">' + escapeHtml(t('Gerente')) + '</span>' : '') + '<small>' + escapeHtml(m.email) + (m.area ? ' · ' + escapeHtml(m.area) : '') + '</small></td>' +
          '<td>' + escapeHtml(oaLevelName(m.level_id) || '—') + '</td><td>' + escapeHtml(oaPosName(m.position_id) || '—') + '</td>' +
          '<td>' + (!m.active ? '<span class="pay-status is-rejected">' + escapeHtml(t('Inactivo')) + '</span>' : c.registered ? '<span class="pay-status is-paid">' + escapeHtml(t('Registrado')) + '</span>' : '<span class="pay-status is-pending">' + escapeHtml(t('Falta registrarse')) + '</span>') +
            (!c.registered && m.invited_at ? '<small>' + escapeHtml(t('Invitado el') + ' ' + new Date(m.invited_at).toLocaleDateString(locale())) + '</small>' : '') + '</td>' +
          '<td class="oa-actions">' + (m.active && !c.registered ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaInvite(\'' + escapeHtml(m.email) + '\', this)">' + escapeHtml(t(m.invited_at ? 'Reenviar invitación' : 'Enviar invitación')) + '</button> ' : '') +
            '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaMemberForm(\'' + escapeHtml(m.email) + '\')">' + escapeHtml(t('Editar')) + '</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="admin-empty">' + escapeHtml(t('Todavía no hay empleados en esta empresa.')) + '</div>');
}

const oaSelect = (id, rows, cur, labelKey, empty) => '<select class="form-input" id="' + id + '"><option value="">' + escapeHtml(t(empty || 'Sin asignar')) + '</option>' +
  rows.map(r => '<option value="' + r.id + '"' + (r.id === cur ? ' selected' : '') + '>' + escapeHtml(r[labelKey]) + '</option>').join('') + '</select>';

function oaMemberForm(email) {
  const m = email ? OA.members.find(x => x.email === email) : { role: 'empleado', active: true };
  oaModal('<h3 class="oa-title">' + escapeHtml(t(email ? 'Editar empleado' : 'Agregar empleado')) + '</h3>' +
    '<form onsubmit="event.preventDefault();oaSaveMember(' + (email ? '\'' + escapeHtml(email) + '\'' : 'null') + ')"><div class="adm-form-grid">' +
      oaField('Correo', oaInput('oa-m-email', m.email, 'type="email" required maxlength="160"' + (email ? ' readonly' : ''))) +
      oaField('Nombre completo', oaInput('oa-m-name', m.full_name, 'maxlength="120"')) +
      oaField('Rol', '<select class="form-input" id="oa-m-role"><option value="empleado"' + (m.role === 'empleado' ? ' selected' : '') + '>' + escapeHtml(t('Empleado')) + '</option><option value="gerente"' + (m.role === 'gerente' ? ' selected' : '') + '>' + escapeHtml(t('Gerente (ve el cumplimiento del equipo)')) + '</option></select>') +
      oaField('Nivel', oaSelect('oa-m-level', OA.levels, m.level_id, 'name')) +
      oaField('Cargo', oaSelect('oa-m-pos', OA.positions, m.position_id, 'title')) +
      oaField('Área', oaInput('oa-m-area', m.area, 'maxlength="80" placeholder="' + escapeHtml(t('Ej.: ventas, cocina, administración')) + '"')) +
      (email ? oaField('Estado', '<select class="form-input" id="oa-m-active"><option value="1"' + (m.active ? ' selected' : '') + '>' + escapeHtml(t('Activo')) + '</option><option value="0"' + (!m.active ? ' selected' : '') + '>' + escapeHtml(t('Inactivo (ya no trabaja aquí)')) + '</option></select>') : '') +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' +
      (email ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteMember(\'' + escapeHtml(email) + '\')">' + escapeHtml(t('Quitar de la empresa')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}

async function oaSaveMember(email) {
  const row = { full_name: oaVal('oa-m-name') || null, role: oaVal('oa-m-role') || 'empleado', level_id: oaVal('oa-m-level') || null,
    position_id: oaVal('oa-m-pos') || null, area: oaVal('oa-m-area') || null };
  let res;
  if (email) { row.active = oaVal('oa-m-active') !== '0'; res = await sb.from('org_members').update(row).eq('org_id', OA.cur).eq('email', email); }
  else {
    row.org_id = OA.cur; row.email = oaVal('oa-m-email').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) { oaErr('Escribe un correo válido'); return; }
    res = await sb.from('org_members').insert(row);
  }
  if (res.error) { oaErr(/duplicate|unique/i.test(res.error.message) ? 'Ese correo ya pertenece a una empresa' : rpcError(res.error)); return; }
  oaClose(); toast(t('Empleado guardado')); loadOrgDetail(OA.cur);
}

async function oaDeleteMember(email) {
  if (!confirm(t('¿Quitar a') + ' ' + email + ' ' + t('de la empresa? Se borrarán sus confirmaciones.'))) return;
  await sb.from('org_acks').delete().eq('org_id', OA.cur).eq('email', email);
  const { error } = await sb.from('org_members').delete().eq('org_id', OA.cur).eq('email', email);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}

// ── Niveles ──
function oaLevels() {
  return '<p class="oa-help">' + escapeHtml(t('Los niveles definen qué capacitaciones ve cada grupo. Por ejemplo, los líderes ven entrenamientos de gestión de equipos y el personal administrativo ve sus procesos.')) + '</p>' +
    '<div class="oa-levels">' + OA.levels.map(l =>
      '<div class="oa-level"><input class="form-input" type="number" min="1" max="99" value="' + l.rank + '" id="oa-lr-' + l.id + '" aria-label="' + escapeHtml(t('Orden')) + '">' +
        '<input class="form-input" value="' + escapeHtml(l.name) + '" id="oa-ln-' + l.id + '" maxlength="60">' +
        '<span class="oa-count">' + OA.members.filter(m => m.level_id === l.id).length + ' ' + escapeHtml(t('personas')) + '</span>' +
        '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaSaveLevel(\'' + l.id + '\')">' + escapeHtml(t('Guardar')) + '</button>' +
        '<button type="button" class="icon-btn" onclick="oaDeleteLevel(\'' + l.id + '\')" aria-label="' + escapeHtml(t('Eliminar')) + '"><svg><use href="#i-x"/></svg></button></div>').join('') +
    '</div><form class="oa-level oa-level--new" onsubmit="event.preventDefault();oaAddLevel()"><input class="form-input" type="number" min="1" max="99" id="oa-lr-new" value="' + (OA.levels.length + 1) + '"><input class="form-input" id="oa-ln-new" maxlength="60" required placeholder="' + escapeHtml(t('Nuevo nivel, ej.: Gerencia media')) + '"><button class="ui-btn ui-btn--primary ui-btn--sm">+ ' + escapeHtml(t('Agregar nivel')) + '</button></form>';
}
async function oaAddLevel() {
  const { error } = await sb.from('org_levels').insert({ org_id: OA.cur, name: oaVal('oa-ln-new'), rank: parseInt(oaVal('oa-lr-new'), 10) || 1 });
  if (error) { toast(rpcError(error)); return; }
  loadOrgDetail(OA.cur);
}
async function oaSaveLevel(id) {
  const { error } = await sb.from('org_levels').update({ name: oaVal('oa-ln-' + id), rank: parseInt(oaVal('oa-lr-' + id), 10) || 1 }).eq('id', id);
  if (error) { toast(rpcError(error)); return; }
  toast(t('Nivel guardado')); loadOrgDetail(OA.cur);
}
async function oaDeleteLevel(id) {
  if (!confirm(t('¿Eliminar este nivel? Las personas y documentos que lo usaban quedarán sin nivel.'))) return;
  await Promise.all(OA.docs.filter(d => d.level_ids.includes(id)).map(d => sb.from('org_docs').update({ level_ids: d.level_ids.filter(x => x !== id) }).eq('id', d.id)));
  const { error } = await sb.from('org_levels').delete().eq('id', id);
  if (error) { toast(rpcError(error)); return; }
  loadOrgDetail(OA.cur);
}

// ── Cargos (manual de descripción de cargos) ──
function oaPositions() {
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Cada cargo es una ficha del manual: propósito, funciones, responsabilidades, indicadores y competencias. El empleado lo lee y lo confirma; si lo editas, se le pedirá confirmarlo otra vez.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaPositionForm()">+ ' + escapeHtml(t('Nuevo cargo')) + '</button></div>' +
    (OA.positions.length ? '<div class="oa-cards">' + OA.positions.map(p =>
      '<button type="button" class="oa-card" onclick="oaPositionForm(\'' + p.id + '\')"><b>' + escapeHtml(p.title) + '</b><small>' + escapeHtml([oaLevelName(p.level_id), p.area, p.reports_to ? t('Reporta a') + ' ' + p.reports_to : ''].filter(Boolean).join(' · ')) + '</small>' +
        '<span class="oa-meta">v' + p.version + ' · ' + OA.members.filter(m => m.position_id === p.id).length + ' ' + escapeHtml(t('personas')) + '</span></button>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Aún no hay cargos. Crea el primero para armar el manual de la empresa.')) + '</div>');
}

function oaPositionForm(id) {
  const p = id ? OA.positions.find(x => x.id === id) : {};
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Editar cargo' : 'Nuevo cargo')) + '</h3>' +
    '<form onsubmit="event.preventDefault();oaSavePosition(' + (id ? '\'' + id + '\'' : 'null') + ')"><div class="adm-form-grid">' +
      oaField('Nombre del cargo', oaInput('oa-p-title', p.title, 'required maxlength="120"'), true) +
      oaField('Nivel', oaSelect('oa-p-level', OA.levels, p.level_id, 'name')) +
      oaField('Área', oaInput('oa-p-area', p.area, 'maxlength="80"')) +
      oaField('Reporta a', oaInput('oa-p-reports', p.reports_to, 'maxlength="120" placeholder="' + escapeHtml(t('Ej.: Gerente general')) + '"'), true) +
      oaField('Propósito del cargo', oaArea('oa-p-purpose', p.purpose, 2, 'Para qué existe este cargo, en una o dos frases'), true) +
      oaField('Funciones principales (una por línea)', oaArea('oa-p-functions', p.functions, 5), true) +
      oaField('Responsabilidades (una por línea)', oaArea('oa-p-resp', p.responsibilities, 4), true) +
      oaField('Indicadores de desempeño / KPIs (uno por línea)', oaArea('oa-p-kpis', p.kpis, 3), true) +
      oaField('Competencias y requisitos (uno por línea)', oaArea('oa-p-comp', p.competencies, 3), true) +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' +
      (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeletePosition(\'' + id + '\')">' + escapeHtml(t('Eliminar cargo')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}

async function oaSavePosition(id) {
  const row = { title: oaVal('oa-p-title'), level_id: oaVal('oa-p-level') || null, area: oaVal('oa-p-area') || null, reports_to: oaVal('oa-p-reports') || null,
    purpose: oaVal('oa-p-purpose') || null, functions: oaVal('oa-p-functions') || null, responsibilities: oaVal('oa-p-resp') || null,
    kpis: oaVal('oa-p-kpis') || null, competencies: oaVal('oa-p-comp') || null };
  const { error } = id ? await sb.from('org_positions').update(row).eq('id', id) : await sb.from('org_positions').insert(Object.assign({ org_id: OA.cur }, row));
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); toast(t('Cargo guardado')); loadOrgDetail(OA.cur);
}

async function oaDeletePosition(id) {
  if (!confirm(t('¿Eliminar este cargo? Las personas que lo tenían quedarán sin cargo.'))) return;
  await Promise.all(OA.docs.filter(d => d.position_ids.includes(id)).map(d => sb.from('org_docs').update({ position_ids: d.position_ids.filter(x => x !== id) }).eq('id', d.id)));
  await sb.from('org_acks').delete().eq('item_type', 'position').eq('item_id', id);
  const { error } = await sb.from('org_positions').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}

// ── SOPs y capacitaciones ──
function oaAudience(d) {
  if (!d.level_ids.length && !d.position_ids.length) return t('Toda la empresa');
  return d.level_ids.map(oaLevelName).concat(d.position_ids.map(oaPosName)).filter(Boolean).join(', ');
}

function oaDocs() {
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Procedimientos (SOPs) y capacitaciones internas. Elige a qué niveles o cargos se asignan; cada persona debe leerlos y confirmarlos. Al editar uno se publica una nueva versión y se pide confirmarlo otra vez.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaDocForm()">+ ' + escapeHtml(t('Nuevo documento')) + '</button></div>' +
    (OA.docs.length ? '<div class="oa-cards">' + OA.docs.map(d =>
      '<button type="button" class="oa-card" onclick="oaDocForm(\'' + d.id + '\')"><span class="oa-kind oa-kind--' + d.kind + '">' + escapeHtml(t(d.kind === 'sop' ? 'SOP' : 'Capacitación')) + '</span><b>' + escapeHtml(d.title) + '</b>' +
        '<small>' + escapeHtml(t('Para') + ': ' + oaAudience(d)) + '</small>' +
        '<span class="oa-meta">v' + d.version + (d.required ? ' · ' + escapeHtml(t('Obligatorio')) : '') + (d.published ? '' : ' · ' + escapeHtml(t('Borrador'))) + '</span></button>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Aún no hay documentos. Crea el primer SOP o capacitación.')) + '</div>');
}

function oaDocForm(id) {
  const d = id ? OA.docs.find(x => x.id === id) : { kind: 'sop', level_ids: [], position_ids: [], required: true, published: true };
  const checks = (rows, sel, key, prefix) => rows.length ? '<div class="oa-checks">' + rows.map(r => '<label class="oa-check"><input type="checkbox" data-' + prefix + '="' + r.id + '"' + (sel.includes(r.id) ? ' checked' : '') + '><span>' + escapeHtml(r[key]) + '</span></label>').join('') + '</div>' : '<small class="oa-help">' + escapeHtml(t('Aún no hay registros.')) + '</small>';
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Editar documento' : 'Nuevo documento')) + '</h3>' +
    '<form onsubmit="event.preventDefault();oaSaveDoc(' + (id ? '\'' + id + '\'' : 'null') + ')"><div class="adm-form-grid">' +
      oaField('Tipo', '<select class="form-input" id="oa-d-kind"><option value="sop"' + (d.kind === 'sop' ? ' selected' : '') + '>' + escapeHtml(t('SOP (procedimiento)')) + '</option><option value="capacitacion"' + (d.kind === 'capacitacion' ? ' selected' : '') + '>' + escapeHtml(t('Capacitación')) + '</option></select>') +
      oaField('Área', oaInput('oa-d-area', d.area, 'maxlength="80"')) +
      oaField('Título', oaInput('oa-d-title', d.title, 'required maxlength="160"'), true) +
      oaField('Resumen (qué aprende o para qué sirve)', oaArea('oa-d-summary', d.summary, 2), true) +
      '<div class="oa-ai adm-field--wide"><b>' + icon('spark') + ' ' + escapeHtml(t('Borrador automático')) + '</b><span>' + escapeHtml(t('Escribe el título y, si quieres, notas del cliente (cómo lo hacen hoy, herramientas, horarios). Se genera un borrador con la estructura de DGP que revisas antes de guardar.')) + '</span>' +
        oaArea('oa-d-notes', '', 3, 'Notas del cliente (opcional)') + '<div class="oa-ai-row"><select class="form-input" id="oa-d-lang" aria-label="' + escapeHtml(t('Idioma del borrador')) + '"><option value="en"' + (LANG === 'en' ? ' selected' : '') + '>English</option><option value="es"' + (LANG === 'es' ? ' selected' : '') + '>Español</option></select>' +
        '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" id="oa-ai-btn" onclick="oaDraftDoc()">' + escapeHtml(t('Generar borrador')) + '</button></div></div>' +
      oaField('Contenido', oaArea('oa-d-body', d.body, 12, '# Título de sección\nTexto normal en párrafos.\n1. Paso numerado\n- Punto de lista\n> Nota importante'), true) +
      '<p class="oa-help adm-field--wide">' + escapeHtml(t('Formato: "# " título de sección · "1. " paso numerado · "- " punto · "> " nota importante · línea en blanco para separar párrafos.')) + '</p>' +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Asignar a niveles')) + '</span>' + checks(OA.levels, d.level_ids, 'name', 'lv') + '</div>' +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Asignar a cargos específicos')) + '</span>' + checks(OA.positions, d.position_ids, 'title', 'ps') + '</div>' +
      '<p class="oa-help adm-field--wide">' + escapeHtml(t('Si no marcas ningún nivel ni cargo, el documento es para toda la empresa.')) + '</p>' +
      '<label class="oa-check"><input type="checkbox" id="oa-d-req"' + (d.required ? ' checked' : '') + '><span>' + escapeHtml(t('Obligatorio (cuenta para el cumplimiento)')) + '</span></label>' +
      '<label class="oa-check"><input type="checkbox" id="oa-d-pub"' + (d.published ? ' checked' : '') + '><span>' + escapeHtml(t('Publicado (visible para el equipo)')) + '</span></label>' +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' +
      (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteDoc(\'' + id + '\')">' + escapeHtml(t('Eliminar documento')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}

async function oaSaveDoc(id) {
  const box = document.getElementById('oa-modal-body');
  const row = { kind: oaVal('oa-d-kind'), area: oaVal('oa-d-area') || null, title: oaVal('oa-d-title'), summary: oaVal('oa-d-summary') || null,
    body: document.getElementById('oa-d-body').value.replace(/\s+$/, ''),
    level_ids: [...box.querySelectorAll('[data-lv]:checked')].map(x => x.dataset.lv),
    position_ids: [...box.querySelectorAll('[data-ps]:checked')].map(x => x.dataset.ps),
    required: document.getElementById('oa-d-req').checked, published: document.getElementById('oa-d-pub').checked };
  if (row.body.length < 10) { oaErr('Escribe el contenido del documento'); return; }
  const { error } = id ? await sb.from('org_docs').update(row).eq('id', id) : await sb.from('org_docs').insert(Object.assign({ org_id: OA.cur }, row));
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); toast(t('Documento guardado')); loadOrgDetail(OA.cur);
}

async function oaDeleteDoc(id) {
  if (!confirm(t('¿Eliminar este documento y sus confirmaciones?'))) return;
  await sb.from('org_acks').delete().eq('item_type', 'doc').eq('item_id', id);
  const { error } = await sb.from('org_docs').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}

// ── Cumplimiento (lo mismo que ve el gerente) ──
function oaCompliance() {
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Avance de cada persona en sus documentos obligatorios y la confirmación de su cargo. Es la misma vista que tiene el gerente de la empresa.')) + '</p>' +
    '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="orgExportCsv(OA.comp, (OA.orgs.find(o => o.id === OA.cur) || {}).name)">' + escapeHtml(t('Exportar a Excel')) + '</button></div>' +
    orgComplianceTable(OA.comp);
}

// ── Invitación por correo (un envío por clic; no se reintenta) ──
async function oaInvite(email, btn) {
  const m = OA.members.find(x => x.email === email);
  if (!confirm(t('¿Enviar la invitación a') + ' ' + email + '? ' + t('Revisa que el correo esté bien escrito: se envía una sola vez.'))) return;
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await sb.functions.invoke('orgs', { body: { action: 'invite', org_id: OA.cur, email } });
    if (error) { let msg = error.message; try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (x) {} throw new Error(msg); }
    if (data && data.error) throw new Error(data.error);
    if (m) m.invited_at = new Date().toISOString();
    toast(t('Invitación enviada a') + ' ' + email);
    renderOrgDetail();
  } catch (e) { toast(t(e.message || 'No se pudo enviar')); if (btn) btn.disabled = false; }
}

// ── Borrador de SOP con IA ──
async function oaDraftDoc() {
  const title = oaVal('oa-d-title');
  if (title.length < 3) { oaErr('Escribe primero el título del documento'); return; }
  const body = document.getElementById('oa-d-body');
  if (body.value.trim() && !confirm(t('El contenido actual se reemplazará por el borrador. ¿Continuar?'))) return;
  const btn = document.getElementById('oa-ai-btn'); btn.disabled = true; btn.textContent = t('Redactando…');
  try {
    const { data, error } = await sb.functions.invoke('orgs', { body: { action: 'sop_draft', org_id: OA.cur, title, kind: oaVal('oa-d-kind'), area: oaVal('oa-d-area'), notes: oaVal('oa-d-notes'), lang: oaVal('oa-d-lang') || LANG } });
    if (error) { let msg = error.message; try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (x) {} throw new Error(msg); }
    if (data && data.error) throw new Error(data.error);
    body.value = data.body; body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight + 4, 600) + 'px';
    toast(t('Borrador listo. Revísalo y completa lo que esté entre [corchetes].'));
  } catch (e) { oaErr(e.message || 'No se pudo generar el borrador'); }
  btn.disabled = false; btn.textContent = t('Generar borrador');
}

// ── Certificaciones ──
function oaCerts() {
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Una certificación agrupa documentos que la persona debe confirmar y un examen que se califica automáticamente. Al aprobar recibe su certificado con el logo de la empresa y puntos. Si tiene vigencia, vence y debe recertificarse.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaCertForm()">+ ' + escapeHtml(t('Nueva certificación')) + '</button></div>' +
    (OA.certs.length ? '<div class="oa-cards">' + OA.certs.map(c => {
      const passed = new Set(OA.awards.filter(a => a.cert_id === c.id && a.passed && (!a.expires_at || new Date(a.expires_at) > new Date())).map(a => a.email));
      return '<button type="button" class="oa-card" onclick="oaCertForm(\'' + c.id + '\')"><span class="oa-kind oa-kind--cert">' + icon('award') + ' ' + escapeHtml(t('Certificación')) + '</span><b>' + escapeHtml(c.title) + '</b>' +
        '<small>' + escapeHtml(t('Para') + ': ' + oaAudience(c)) + '</small>' +
        '<span class="oa-meta">' + c.questions.length + ' ' + escapeHtml(t('preguntas')) + ' · ' + escapeHtml(t('aprueba con')) + ' ' + c.pass_score + '% · ' + passed.size + ' ' + escapeHtml(t('certificados vigentes')) + (c.valid_months ? ' · ' + escapeHtml(t('vence a los')) + ' ' + c.valid_months + ' ' + escapeHtml(t('meses')) : '') + (c.published ? '' : ' · ' + escapeHtml(t('Borrador'))) + '</span></button>';
    }).join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Aún no hay certificaciones. Crea la primera, por ejemplo "Cajero certificado".')) + '</div>') +
    (OA.awards.length ? '<div class="oa-head"><h2>' + escapeHtml(t('Últimos resultados')) + '</h2></div><div class="oa-table-wrap"><table class="oa-table"><thead><tr><th>' + escapeHtml(t('Persona')) + '</th><th>' + escapeHtml(t('Certificación')) + '</th><th>' + escapeHtml(t('Puntaje')) + '</th><th>' + escapeHtml(t('Fecha')) + '</th><th>' + escapeHtml(t('Vence')) + '</th></tr></thead><tbody>' +
      OA.awards.slice(0, 40).map(a => '<tr><td><b>' + escapeHtml(a.full_name || a.email) + '</b><small>' + escapeHtml(a.email) + '</small></td><td>' + escapeHtml((OA.certs.find(c => c.id === a.cert_id) || {}).title || '') + (a.number ? '<small>' + escapeHtml(a.number) + '</small>' : '') + '</td>' +
        '<td>' + (a.passed ? '<span class="pay-status is-paid">' : '<span class="pay-status is-rejected">') + a.score + '%</span></td><td>' + escapeHtml(new Date(a.issued_at).toLocaleDateString(locale())) + '</td><td>' + escapeHtml(a.expires_at ? new Date(a.expires_at).toLocaleDateString(locale()) : '—') + '</td></tr>').join('') +
      '</tbody></table></div>' : '');
}

function oaQuestionRow(q, i) {
  q = q || { q: '', options: ['', '', '', ''], answer: 0 };
  const opts = (q.options || []).concat(['', '', '', '']).slice(0, 4);
  const g = 'qa-' + Math.random().toString(36).slice(2, 9);
  return '<div class="oa-q" data-q><div class="oa-q-head"><b>' + escapeHtml(t('Pregunta')) + ' <span class="oa-q-n">' + (i + 1) + '</span></b><button type="button" class="icon-btn" onclick="this.closest(\'[data-q]\').remove();oaRenumber()" aria-label="' + escapeHtml(t('Quitar')) + '"><svg><use href="#i-x"/></svg></button></div>' +
    '<input class="form-input" data-qt maxlength="300" placeholder="' + escapeHtml(t('Escribe la pregunta')) + '" value="' + escapeHtml(q.q) + '">' +
    '<div class="oa-q-opts">' + opts.map((o, j) => '<label class="oa-q-opt"><input type="radio" name="' + g + '" data-qa="' + j + '"' + (q.answer === j ? ' checked' : '') + ' title="' + escapeHtml(t('Respuesta correcta')) + '"><input class="form-input" data-qo maxlength="200" placeholder="' + escapeHtml(t('Opción') + ' ' + (j + 1) + (j > 1 ? ' (' + t('opcional') + ')' : '')) + '" value="' + escapeHtml(o) + '"></label>').join('') + '</div></div>';
}
function oaRenumber() { document.querySelectorAll('#oa-qs .oa-q-n').forEach((n, i) => { n.textContent = i + 1; }); }
function oaAddQuestion() { const box = document.getElementById('oa-qs'); box.insertAdjacentHTML('beforeend', oaQuestionRow(null, box.children.length)); }

function oaCertForm(id) {
  const c = id ? OA.certs.find(x => x.id === id) : { level_ids: [], position_ids: [], doc_ids: [], questions: [], pass_score: 80, points: 50, published: true };
  const checks = (rows, sel, key, prefix) => rows.length ? '<div class="oa-checks">' + rows.map(r => '<label class="oa-check"><input type="checkbox" data-' + prefix + '="' + r.id + '"' + (sel.includes(r.id) ? ' checked' : '') + '><span>' + escapeHtml(r[key]) + '</span></label>').join('') + '</div>' : '<small class="oa-help">' + escapeHtml(t('Aún no hay registros.')) + '</small>';
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Editar certificación' : 'Nueva certificación')) + '</h3>' +
    '<form onsubmit="event.preventDefault();oaSaveCert(' + (id ? '\'' + id + '\'' : 'null') + ')"><div class="adm-form-grid">' +
      oaField('Nombre de la certificación', oaInput('oa-c-title', c.title, 'required maxlength="160" placeholder="' + escapeHtml(t('Ej.: Cajero certificado')) + '"'), true) +
      oaField('Descripción', oaArea('oa-c-desc', c.description, 2), true) +
      oaField('Aprueba con (%)', oaInput('oa-c-pass', c.pass_score, 'type="number" min="1" max="100" required')) +
      oaField('Vigencia en meses (vacío = no vence)', oaInput('oa-c-valid', c.valid_months, 'type="number" min="1" max="120"')) +
      oaField('Puntos al aprobar', oaInput('oa-c-points', c.points, 'type="number" min="0" max="10000"')) +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Para qué niveles')) + '</span>' + checks(OA.levels, c.level_ids, 'name', 'lv') + '</div>' +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Para qué cargos')) + '</span>' + checks(OA.positions, c.position_ids, 'title', 'ps') + '</div>' +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Documentos que debe leer y confirmar antes del examen')) + '</span>' + checks(OA.docs, c.doc_ids, 'title', 'dc') + '</div>' +
      '<div class="adm-field adm-field--wide"><span>' + escapeHtml(t('Examen (marca el círculo de la respuesta correcta)')) + '</span><div id="oa-qs">' + c.questions.map(oaQuestionRow).join('') + '</div>' +
        '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaAddQuestion()">+ ' + escapeHtml(t('Agregar pregunta')) + '</button></div>' +
      '<label class="oa-check"><input type="checkbox" id="oa-c-pub"' + (c.published ? ' checked' : '') + '><span>' + escapeHtml(t('Publicada (visible para el equipo)')) + '</span></label>' +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' +
      (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteCert(\'' + id + '\')">' + escapeHtml(t('Eliminar certificación')) + '</button>' : '') +
      '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
  if (!c.questions.length) oaAddQuestion();
}

async function oaSaveCert(id) {
  const box = document.getElementById('oa-modal-body');
  const questions = [];
  for (const el of box.querySelectorAll('[data-q]')) {
    const q = el.querySelector('[data-qt]').value.trim();
    const all = [...el.querySelectorAll('[data-qo]')].map(x => x.value.trim());
    const checked = [...el.querySelectorAll('[data-qa]')].findIndex(x => x.checked);
    if (!q && all.every(x => !x)) continue;
    const options = all.filter(Boolean);
    if (!q || options.length < 2) { oaErr('Cada pregunta necesita el texto y al menos 2 opciones'); return; }
    if (checked < 0 || !all[checked]) { oaErr('Marca la respuesta correcta de cada pregunta'); return; }
    questions.push({ q, options, answer: options.indexOf(all[checked]) });
  }
  const valid = parseInt(oaVal('oa-c-valid'), 10);
  const row = { title: oaVal('oa-c-title'), description: oaVal('oa-c-desc') || null, pass_score: parseInt(oaVal('oa-c-pass'), 10) || 80,
    valid_months: valid > 0 ? valid : null, points: parseInt(oaVal('oa-c-points'), 10) || 0, questions,
    level_ids: [...box.querySelectorAll('[data-lv]:checked')].map(x => x.dataset.lv), position_ids: [...box.querySelectorAll('[data-ps]:checked')].map(x => x.dataset.ps),
    doc_ids: [...box.querySelectorAll('[data-dc]:checked')].map(x => x.dataset.dc), published: document.getElementById('oa-c-pub').checked, updated_at: new Date().toISOString() };
  if (row.published && !questions.length) { oaErr('Agrega al menos una pregunta o guárdala sin publicar'); return; }
  const { error } = id ? await sb.from('org_certs').update(row).eq('id', id) : await sb.from('org_certs').insert(Object.assign({ org_id: OA.cur }, row));
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); toast(t('Certificación guardada')); loadOrgDetail(OA.cur);
}

async function oaDeleteCert(id) {
  if (!confirm(t('¿Eliminar esta certificación y todos sus resultados?'))) return;
  const { error } = await sb.from('org_certs').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}

// ── Puntos y premios ──
const OA_RED = { pendiente: ['Pendiente', 'is-pending'], aprobado: ['Aprobado', 'is-paid'], entregado: ['Entregado', 'is-paid'], rechazado: ['Rechazado', 'is-rejected'] };
function oaPoints() {
  const name = e => { const m = OA.members.find(x => x.email === e); return (m && m.full_name) || e; };
  return '<p class="oa-help">' + escapeHtml(t('Cada persona gana 10 puntos por documento confirmado, 10 por confirmar su cargo y los puntos de cada certificación aprobada. Con ellos canjea los premios que defina la empresa.')) + '</p>' +
    '<div class="oa-grid2">' +
      '<div><div class="oa-head"><h2>' + escapeHtml(t('Ranking')) + '</h2></div>' + orgBoardHtml(OA.board) + '</div>' +
      '<div><div class="oa-head"><h2>' + escapeHtml(t('Premios')) + '</h2><button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaRewardForm()">+ ' + escapeHtml(t('Nuevo premio')) + '</button></div>' +
        (OA.rewards.length ? '<div class="oa-list">' + OA.rewards.map(r => '<button type="button" class="oa-row" onclick="oaRewardForm(\'' + r.id + '\')"><span><b>' + escapeHtml(r.title) + '</b>' + (r.description ? '<small>' + escapeHtml(r.description) + '</small>' : '') + '</span><span class="oa-pts">' + r.cost + ' pts' + (r.active ? '' : ' · ' + escapeHtml(t('Inactivo'))) + '</span></button>').join('') + '</div>'
          : '<div class="admin-empty">' + escapeHtml(t('Aún no hay premios. Ej.: medio día libre, bono, almuerzo pagado.')) + '</div>') +
      '</div></div>' +
    '<div class="oa-head"><h2>' + escapeHtml(t('Canjes')) + '</h2><span class="adm-card-sub">' + escapeHtml(t('El gerente también puede aprobarlos desde su campus')) + '</span></div>' +
    (OA.redemptions.length ? '<div class="oa-list">' + OA.redemptions.map(r => '<div class="oa-row"><span><b>' + escapeHtml(name(r.email)) + ' · ' + escapeHtml(r.title) + '</b><small>' + r.cost + ' pts · ' + escapeHtml(new Date(r.created_at).toLocaleDateString(locale())) + '</small></span>' +
      '<span class="oa-row-actions"><span class="pay-status ' + OA_RED[r.status][1] + '">' + escapeHtml(t(OA_RED[r.status][0])) + '</span>' +
      (r.status === 'pendiente' ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaRedeem(\'' + r.id + '\', \'aprobado\')">' + escapeHtml(t('Aprobar')) + '</button><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaRedeem(\'' + r.id + '\', \'rechazado\')">' + escapeHtml(t('Rechazar')) + '</button>' : '') +
      (r.status === 'aprobado' ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" onclick="oaRedeem(\'' + r.id + '\', \'entregado\')">' + escapeHtml(t('Marcar entregado')) + '</button>' : '') + '</span></div>').join('') + '</div>'
      : '<div class="admin-empty">' + escapeHtml(t('Todavía no hay canjes.')) + '</div>') +
    '<div class="oa-head"><h2>' + escapeHtml(t('Dar puntos extra')) + '</h2></div>' +
    '<form class="oa-bonus" onsubmit="event.preventDefault();oaGiveBonus()"><select class="form-input" id="oa-b-email" required><option value="">' + escapeHtml(t('Elige a la persona')) + '</option>' + OA.members.filter(m => m.active).map(m => '<option value="' + escapeHtml(m.email) + '">' + escapeHtml(m.full_name || m.email) + '</option>').join('') + '</select>' +
      '<input class="form-input" id="oa-b-pts" type="number" min="-10000" max="10000" required placeholder="' + escapeHtml(t('Puntos')) + '"><input class="form-input" id="oa-b-why" required maxlength="200" placeholder="' + escapeHtml(t('Motivo, ej.: cliente felicitó su atención')) + '"><button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Dar puntos')) + '</button></form>' +
    (OA.points.length ? '<div class="oa-list oa-list--small">' + OA.points.slice(0, 20).map(p => '<div class="oa-row"><span><b>' + escapeHtml(name(p.email)) + '</b><small>' + escapeHtml(p.reason) + ' · ' + escapeHtml(new Date(p.created_at).toLocaleDateString(locale())) + '</small></span><span class="oa-pts">' + (p.points > 0 ? '+' : '') + p.points + '</span></div>').join('') + '</div>' : '');
}

function oaRewardForm(id) {
  const r = id ? OA.rewards.find(x => x.id === id) : { active: true };
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Editar premio' : 'Nuevo premio')) + '</h3><form onsubmit="event.preventDefault();oaSaveReward(' + (id ? '\'' + id + '\'' : 'null') + ')"><div class="adm-form-grid">' +
    oaField('Premio', oaInput('oa-r-title', r.title, 'required maxlength="120" placeholder="' + escapeHtml(t('Ej.: Medio día libre')) + '"'), true) +
    oaField('Costo en puntos', oaInput('oa-r-cost', r.cost, 'type="number" min="1" max="1000000" required')) +
    oaField('Estado', '<select class="form-input" id="oa-r-active"><option value="1"' + (r.active ? ' selected' : '') + '>' + escapeHtml(t('Activo')) + '</option><option value="0"' + (!r.active ? ' selected' : '') + '>' + escapeHtml(t('Inactivo')) + '</option></select>') +
    oaField('Descripción', oaArea('oa-r-desc', r.description, 2), true) +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' + (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteReward(\'' + id + '\')">' + escapeHtml(t('Eliminar')) + '</button>' : '') +
    '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}
async function oaSaveReward(id) {
  const row = { title: oaVal('oa-r-title'), cost: parseInt(oaVal('oa-r-cost'), 10) || 1, description: oaVal('oa-r-desc') || null, active: oaVal('oa-r-active') !== '0' };
  const { error } = id ? await sb.from('org_rewards').update(row).eq('id', id) : await sb.from('org_rewards').insert(Object.assign({ org_id: OA.cur }, row));
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}
async function oaDeleteReward(id) {
  if (!confirm(t('¿Eliminar este premio?'))) return;
  const { error } = await sb.from('org_rewards').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}
async function oaRedeem(id, status) {
  const { error } = await sb.rpc('org_decide_redemption', { red: id, new_status: status });
  if (error) { toast(rpcError(error)); return; }
  loadOrgDetail(OA.cur);
}
async function oaGiveBonus() {
  const pts = parseInt(oaVal('oa-b-pts'), 10);
  if (!pts) { toast(t('Escribe los puntos')); return; }
  const { error } = await sb.from('org_points').insert({ org_id: OA.cur, email: oaVal('oa-b-email'), points: pts, reason: oaVal('oa-b-why'), given_by: (STATE.user.email || '').toLowerCase() });
  if (error) { toast(rpcError(error)); return; }
  toast(t('Puntos registrados')); loadOrgDetail(OA.cur);
}

// ── Asesorías por videollamada ──
const OA_SES = { agendada: ['Agendada', 'is-pending'], realizada: ['Realizada', 'is-paid'], cancelada: ['Cancelada', 'is-rejected'] };
function oaSessions() {
  const name = e => { if (!e) return t('Empresa / gerencia'); const m = OA.members.find(x => x.email === e); return (m && m.full_name) || e; };
  const up = OA.sessions.filter(s => s.status === 'agendada').sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const rest = OA.sessions.filter(s => s.status !== 'agendada');
  const row = s => {
    const tasks = s.tasks || [], done = tasks.filter(x => x.done).length;
    return '<button type="button" class="oa-row" onclick="oaSessionForm(\'' + s.id + '\')"><span><b>' + escapeHtml(s.title) + ' · ' + escapeHtml(name(s.email)) + '</b><small>' + escapeHtml(new Date(s.starts_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) + ' · ' + s.minutes + ' min' + (tasks.length ? ' · ' + done + '/' + tasks.length + ' ' + escapeHtml(t('tareas')) : '') + '</small></span><span class="pay-status ' + OA_SES[s.status][1] + '">' + escapeHtml(t(OA_SES[s.status][0])) + '</span></button>';
  };
  return '<div class="oa-bar"><p class="oa-help">' + escapeHtml(t('Agenda videollamadas con cada persona o con la gerencia. Pega el enlace de Google Meet, Zoom o Teams. Después de la sesión escribe las notas y las tareas: la persona las ve en su campus y marca las tareas hechas.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary ui-btn--sm" onclick="oaSessionForm()">+ ' + escapeHtml(t('Agendar asesoría')) + '</button></div>' +
    '<div class="oa-head"><h2>' + escapeHtml(t('Próximas')) + '</h2></div>' + (up.length ? '<div class="oa-list">' + up.map(row).join('') + '</div>' : '<div class="admin-empty">' + escapeHtml(t('No hay asesorías agendadas.')) + '</div>') +
    (rest.length ? '<div class="oa-head"><h2>' + escapeHtml(t('Historial')) + '</h2></div><div class="oa-list">' + rest.map(row).join('') + '</div>' : '');
}

function oaLocalDT(iso) { const d = iso ? new Date(iso) : new Date(Date.now() + 864e5); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function oaSessionForm(id) {
  const s = id ? OA.sessions.find(x => x.id === id) : { minutes: 45, status: 'agendada', tasks: [] };
  oaModal('<h3 class="oa-title">' + escapeHtml(t(id ? 'Asesoría' : 'Agendar asesoría')) + '</h3><form onsubmit="event.preventDefault();oaSaveSession(' + (id ? '\'' + id + '\'' : 'null') + ')"><div class="adm-form-grid">' +
    oaField('Con quién', '<select class="form-input" id="oa-s-email"><option value="">' + escapeHtml(t('Empresa / gerencia')) + '</option>' + OA.members.filter(m => m.active || m.email === s.email).map(m => '<option value="' + escapeHtml(m.email) + '"' + (m.email === s.email ? ' selected' : '') + '>' + escapeHtml(m.full_name || m.email) + '</option>').join('') + '</select>') +
    oaField('Tema', oaInput('oa-s-title', s.title, 'required maxlength="160" placeholder="' + escapeHtml(t('Ej.: Seguimiento de procesos de caja')) + '"')) +
    oaField('Fecha y hora (tu zona horaria)', oaInput('oa-s-when', oaLocalDT(s.starts_at), 'type="datetime-local" required')) +
    oaField('Duración (minutos)', oaInput('oa-s-min', s.minutes, 'type="number" min="10" max="480" required')) +
    oaField('Enlace de la videollamada', oaInput('oa-s-url', s.meet_url, 'type="url" maxlength="400" placeholder="https://meet.google.com/…"'), true) +
    oaField('Estado', '<select class="form-input" id="oa-s-status">' + Object.keys(OA_SES).map(k => '<option value="' + k + '"' + (s.status === k ? ' selected' : '') + '>' + escapeHtml(t(OA_SES[k][0])) + '</option>').join('') + '</select>') +
    oaField('Notas de la sesión (las ve la persona)', oaArea('oa-s-notes', s.notes, 4), true) +
    oaField('Tareas acordadas (una por línea)', oaArea('oa-s-tasks', (s.tasks || []).map(x => x.t).join('\n'), 3), true) +
    '</div><p class="modal-error" id="oa-err" hidden></p><div class="adm-form-actions">' + (id ? '<button type="button" class="ui-btn ui-btn--ghost ui-btn--sm oa-danger" onclick="oaDeleteSession(\'' + id + '\')">' + escapeHtml(t('Eliminar')) + '</button>' : '') +
    '<button class="ui-btn ui-btn--primary ui-btn--sm">' + escapeHtml(t('Guardar')) + '</button></div></form>');
}
async function oaSaveSession(id) {
  const prev = id ? (OA.sessions.find(x => x.id === id).tasks || []) : [];
  const url = oaVal('oa-s-url');
  if (url && !/^https:\/\//.test(url)) { oaErr('El enlace debe empezar con https://'); return; }
  const row = { email: oaVal('oa-s-email') || null, title: oaVal('oa-s-title'), starts_at: new Date(oaVal('oa-s-when')).toISOString(), minutes: parseInt(oaVal('oa-s-min'), 10) || 45,
    meet_url: url || null, status: oaVal('oa-s-status'), notes: oaVal('oa-s-notes') || null,
    tasks: oaLines(document.getElementById('oa-s-tasks').value).map(tx => ({ t: tx, done: !!(prev.find(p => p.t === tx) || {}).done })) };
  const { error } = id ? await sb.from('org_sessions').update(row).eq('id', id) : await sb.from('org_sessions').insert(Object.assign({ org_id: OA.cur }, row));
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); toast(t('Asesoría guardada')); loadOrgDetail(OA.cur);
}
async function oaDeleteSession(id) {
  if (!confirm(t('¿Eliminar esta asesoría?'))) return;
  const { error } = await sb.from('org_sessions').delete().eq('id', id);
  if (error) { oaErr(rpcError(error)); return; }
  oaClose(); loadOrgDetail(OA.cur);
}

// ── Gerente que configura su propia empresa (desde el campus) ──
function orgOpenConfig(rootId) {
  if (!ORG.org || !ORG.org.self_manage) return;
  if (!OA.self || OA.cur !== ORG.org.id) OA.view = 'equipo';
  OA.self = true; OA.rootId = rootId; OA.orgs = [ORG.org]; OA.leads = [];
  loadOrgDetail(ORG.org.id);
}
