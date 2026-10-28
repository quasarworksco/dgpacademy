// =========================================================
// Asesorías 1 a 1: el estudiante elige día y hora entre los horarios que publica el equipo
// Incluidas en la membresía (por mes) y en el pase completo o el programa web (2 sesiones).
// =========================================================
const ADV = { info: null, slots: [], day: null, slot: null };

async function loadAdvisory() {
  if (!STATE.user) return;
  const until = new Date(Date.now() + 60 * 864e5).toISOString();
  const [info, slots] = await Promise.all([
    sb.rpc('my_advisory'),
    sb.from('meeting_slots').select('id, starts_at, minutes').is('booked_by', null).gt('starts_at', new Date(Date.now() + 2 * 36e5).toISOString()).lte('starts_at', until).order('starts_at').limit(300)
  ]);
  ADV.info = info.data || null;
  ADV.slots = slots.data || [];
  if (ADV.day && !ADV.slots.some(s => dayKey(s.starts_at) === ADV.day)) { ADV.day = null; ADV.slot = null; }
  renderAdvisory();
}

function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function tzName() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' '); } catch (e) { return ''; } }

function renderAdvisory() {
  const root = document.getElementById('adv-root');
  if (!root) return;
  const info = ADV.info || { left: 0, membership_total: 0, program_total: 0 };
  const eligible = (info.membership_total || 0) + (info.program_total || 0) > 0;
  const upcoming = (MEMBER.meetings || []).filter(m => m.status === 'scheduled' && m.scheduled_at && new Date(m.scheduled_at) > new Date(Date.now() - 2 * 36e5))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  if (!eligible && !upcoming.length) {
    root.innerHTML = '<div class="adv-lock"><div class="adv-lock-ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></div>' +
      '<div><b>' + escapeHtml(t('Asesorías privadas con el equipo de DGP')) + '</b><span>' + escapeHtml(t('Videollamadas para revisar tu proyecto, resolver dudas o planear tu negocio. Incluidas en el pase completo (2 sesiones) y en la membresía (cada mes).')) + '</span></div>' +
      '<div class="adv-lock-btns"><button class="ui-btn ui-btn--primary ui-btn--sm" onclick="openCheckout(\'pase\')">' + escapeHtml(t('Pase completo')) + priceTag('pase') + '</button><button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="document.getElementById(\'dash-member\').scrollIntoView({behavior:\'smooth\'})">' + escapeHtml(t('Ver membresía')) + '</button></div></div>';
    return;
  }

  // Días con horarios libres (máximo 14 en la tira)
  const days = [];
  ADV.slots.forEach(s => { const k = dayKey(s.starts_at); let d = days.find(x => x.k === k); if (!d) { d = { k, date: new Date(s.starts_at), n: 0 }; days.push(d); } d.n++; });
  if (!ADV.day && days.length) ADV.day = days[0].k;
  const daySlots = ADV.slots.filter(s => dayKey(s.starts_at) === ADV.day);
  const fmtT = ts => new Date(ts).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });

  root.innerHTML =
    '<div class="adv">' +
      '<div class="adv-main">' +
        '<div class="adv-top"><span class="adv-left"><b>' + (info.left || 0) + '</b> ' + escapeHtml(t(info.left === 1 ? 'asesoría disponible' : 'asesorías disponibles')) + '</span><span class="adv-tz">' + escapeHtml(t('Horarios en tu zona')) + ': ' + escapeHtml(tzName()) + '</span></div>' +
        (days.length ? (
          '<div class="adv-days" role="listbox" aria-label="' + escapeHtml(t('Elige un día')) + '">' + days.slice(0, 14).map(d =>
            '<button type="button" class="adv-day' + (d.k === ADV.day ? ' is-on' : '') + '" onclick="pickAdvDay(\'' + d.k + '\')">' +
              '<small>' + escapeHtml(d.date.toLocaleDateString(locale(), { weekday: 'short' })) + '</small><b>' + d.date.getDate() + '</b><small>' + escapeHtml(d.date.toLocaleDateString(locale(), { month: 'short' })) + '</small><i>' + d.n + '</i></button>').join('') + '</div>' +
          '<div class="adv-times">' + daySlots.map(s => '<button type="button" class="adv-time' + (ADV.slot === s.id ? ' is-on' : '') + '" onclick="pickAdvSlot(\'' + s.id + '\')">' + escapeHtml(fmtT(s.starts_at)) + '<small>' + s.minutes + ' min</small></button>').join('') + '</div>' +
          (ADV.slot ? '<form class="adv-confirm" onsubmit="event.preventDefault();confirmAdvisory()">' +
              '<label class="adm-field adm-field--wide"><span>' + escapeHtml(t('¿De qué quieres hablar?')) + '</span><textarea class="form-input" id="adv-topic" rows="2" maxlength="300" required placeholder="' + escapeHtml(t('Ej.: revisar mi primera app, ideas para vender mis servicios de IA…')) + '"></textarea></label>' +
              '<p class="modal-error" id="adv-error" hidden></p>' +
              '<button class="ui-btn ui-btn--primary" id="adv-btn" ' + ((info.left || 0) < 1 ? 'disabled' : '') + '>' + escapeHtml(t('Confirmar asesoría')) + ' · ' + escapeHtml(new Date((ADV.slots.find(x => x.id === ADV.slot) || {}).starts_at).toLocaleString(locale(), { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })) + '</button>' +
            '</form>' : '<p class="adv-hint">' + escapeHtml(t('Elige un horario para continuar.')) + '</p>')
        ) : '<div class="admin-empty">' + escapeHtml(t('Pronto publicaremos nuevos horarios. Mientras tanto, puedes pedir tu asesoría y te proponemos una fecha.')) + '<br><button class="ui-btn ui-btn--ghost ui-btn--sm" style="margin-top:10px" onclick="openRequest(\'meeting\')">' + escapeHtml(t('Pedir asesoría')) + '</button></div>') +
      '</div>' +
      '<aside class="adv-side"><h4>' + escapeHtml(t('Tus próximas asesorías')) + '</h4>' +
        (upcoming.length ? '<ul class="mb-list">' + upcoming.map(m => {
          const when = new Date(m.scheduled_at);
          const canCancel = when - Date.now() > 24 * 36e5;
          return '<li class="mb-item"><div class="mb-item-main"><b>' + escapeHtml(when.toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) + '</b><span>' + escapeHtml(m.topic) + '</span></div>' +
            '<div class="mb-item-actions">' + (/^https:\/\//.test(m.meet_url || '') ? '<a class="ui-btn ui-btn--primary ui-btn--sm" href="' + escapeHtml(m.meet_url) + '" target="_blank" rel="noopener">' + escapeHtml(t('Entrar a la reunión')) + '</a>' : '<span class="adv-note">' + escapeHtml(t('Te enviaremos el enlace por correo')) + '</span>') +
            (canCancel ? '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="cancelAdvisory(\'' + String(m.id).replace(/[^a-f0-9-]/g, '') + '\')">' + escapeHtml(t('Cancelar')) + '</button>' : '') + '</div></li>';
        }).join('') + '</ul>' : '<p class="adv-hint">' + escapeHtml(t('Aún no tienes asesorías agendadas.')) + '</p>') +
      '</aside>' +
    '</div>';
}

function pickAdvDay(k) { ADV.day = k; ADV.slot = null; renderAdvisory(); }
function pickAdvSlot(id) { ADV.slot = id; renderAdvisory(); const tp = document.getElementById('adv-topic'); if (tp) tp.focus(); }

async function confirmAdvisory() {
  const btn = document.getElementById('adv-btn'), err = document.getElementById('adv-error');
  btn.disabled = true; err.hidden = true;
  const { data, error } = await sb.rpc('book_slot', { slot: ADV.slot, topic: document.getElementById('adv-topic').value.trim() });
  if (error) { err.textContent = t(friendlyPayError(error)); err.hidden = false; btn.disabled = false; loadAdvisory(); return; }
  sb.functions.invoke('payments', { body: { action: 'member_request', type: 'meeting', id: data.id } }).catch(() => {});
  ADV.slot = null;
  toast(t('¡Asesoría agendada! Te esperamos.'));
  if (typeof loadMembership === 'function') await loadMembership().catch(() => {});
  loadAdvisory();
}

async function cancelAdvisory(id) {
  if (!confirm(t('¿Cancelar esta asesoría? El horario quedará libre para otra persona.'))) return;
  const { error } = await sb.rpc('cancel_my_meeting', { meeting: id });
  if (error) { toast(t(friendlyPayError(error))); return; }
  toast(t('Asesoría cancelada'));
  if (typeof loadMembership === 'function') await loadMembership().catch(() => {});
  loadAdvisory();
}

// Desde la membresía: lleva a la agenda (o al formulario si aún no hay horarios publicados)
function openBooking() {
  if (ADV.slots.length) { const s = document.getElementById('dash-advisory'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else openRequest('meeting');
}
