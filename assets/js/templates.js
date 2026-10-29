// =========================================================
// Plantillas y prompts: bonus del pase completo (producto "plantillas").
// El índice es público; el texto de cada plantilla es contenido protegido (tabla content).
// Sin el pase solo se abre la plantilla de muestra; el resto invita a desbloquear.
// =========================================================
const TPL_META = [{"id": "t-tienda", "cat": "sitio", "ic": "🛒", "t": {"es": "Tienda online", "en": "Online store"}, "d": {"es": "Catálogo de productos con carrito, pedidos por WhatsApp o pago en línea.", "en": "Product catalog with a cart, orders via WhatsApp or online payment."}, "free": true}, {"id": "t-restaurante", "cat": "sitio", "ic": "🍽️", "t": {"es": "Restaurante o cafetería", "en": "Restaurant or café"}, "d": {"es": "Menú digital, reservas, ubicación y pedidos por WhatsApp.", "en": "Digital menu, reservations, location and WhatsApp orders."}, "free": false}, {"id": "t-clinica", "cat": "sitio", "ic": "🩺", "t": {"es": "Clínica o consultorio", "en": "Clinic or medical office"}, "d": {"es": "Servicios, especialistas, citas en línea y confianza para pacientes.", "en": "Services, specialists, online appointments and patient trust."}, "free": false}, {"id": "t-belleza", "cat": "sitio", "ic": "✂️", "t": {"es": "Salón de belleza o barbería", "en": "Beauty salon or barbershop"}, "d": {"es": "Servicios con precios, galería de trabajos y reservas.", "en": "Services with prices, work gallery and bookings."}, "free": false}, {"id": "t-inmobiliaria", "cat": "sitio", "ic": "🏠", "t": {"es": "Inmobiliaria o bienes raíces", "en": "Real estate agency"}, "d": {"es": "Listado de propiedades con filtros, fichas y contacto con agentes.", "en": "Property listings with filters, detail pages and agent contact."}, "free": false}, {"id": "t-profesional", "cat": "sitio", "ic": "💼", "t": {"es": "Servicios profesionales", "en": "Professional services"}, "d": {"es": "Abogado, contador, consultor o agencia: autoridad y captación de clientes.", "en": "Lawyer, accountant, consultant or agency: authority and lead generation."}, "free": false}, {"id": "t-gimnasio", "cat": "sitio", "ic": "🏋️", "t": {"es": "Gimnasio o entrenador personal", "en": "Gym or personal trainer"}, "d": {"es": "Planes, horarios de clases, transformaciones y clase de prueba.", "en": "Plans, class schedule, transformations and a free trial class."}, "free": false}, {"id": "t-portafolio", "cat": "sitio", "ic": "🎨", "t": {"es": "Portafolio personal o freelancer", "en": "Personal portfolio or freelancer"}, "d": {"es": "Muestra tus proyectos y consigue clientes como creador o vibecoder.", "en": "Show your projects and win clients as a creator or vibecoder."}, "free": false}, {"id": "t-lanzamiento", "cat": "sitio", "ic": "🚀", "t": {"es": "Landing de curso, evento o lanzamiento", "en": "Course, event or launch landing page"}, "d": {"es": "Página de venta de una sola página con cuenta regresiva y registro.", "en": "One-page sales page with a countdown and signup."}, "free": false}, {"id": "t-hogar", "cat": "sitio", "ic": "🔧", "t": {"es": "Construcción y servicios del hogar", "en": "Construction and home services"}, "d": {"es": "Remodelación, plomería, limpieza o jardinería: cotizaciones rápidas.", "en": "Remodeling, plumbing, cleaning or landscaping: quick quotes."}, "free": false}, {"id": "t-citas", "cat": "sistema", "ic": "📅", "t": {"es": "Sistema de citas y reservas", "en": "Booking and appointment system"}, "d": {"es": "Calendario de turnos con confirmación y panel para el negocio.", "en": "Calendar with confirmations and a dashboard for the business."}, "free": false}, {"id": "t-pedidos", "cat": "sistema", "ic": "💬", "t": {"es": "Catálogo con pedidos por WhatsApp", "en": "Catalog with WhatsApp orders"}, "d": {"es": "La forma más rápida de vender en línea sin pasarela de pago.", "en": "The fastest way to sell online without a payment gateway."}, "free": false}, {"id": "t-crm", "cat": "sistema", "ic": "📇", "t": {"es": "Mini CRM de clientes", "en": "Mini customer CRM"}, "d": {"es": "Organiza contactos, seguimientos y ventas en un solo lugar.", "en": "Organize contacts, follow-ups and sales in one place."}, "free": false}, {"id": "t-brief", "cat": "negocio", "ic": "📋", "t": {"es": "Cuestionario inicial para clientes (brief)", "en": "Client intake questionnaire (brief)"}, "d": {"es": "Las preguntas que debes hacerle a un cliente antes de crear su sitio.", "en": "The questions to ask a client before building their site."}, "free": false}, {"id": "t-propuesta", "cat": "negocio", "ic": "📄", "t": {"es": "Propuesta comercial para un cliente", "en": "Business proposal for a client"}, "d": {"es": "Documento profesional para presentar tu servicio, precio y tiempos.", "en": "A professional document presenting your service, price and timeline."}, "free": false}, {"id": "t-contrato", "cat": "negocio", "ic": "📝", "t": {"es": "Contrato simple de servicios web", "en": "Simple web services contract"}, "d": {"es": "Acuerdo básico para proteger tu trabajo y dejar claro lo que incluye.", "en": "A basic agreement to protect your work and set clear expectations."}, "free": false}, {"id": "t-prospeccion", "cat": "negocio", "ic": "📣", "t": {"es": "Mensajes para conseguir clientes", "en": "Messages to win clients"}, "d": {"es": "Textos listos para WhatsApp, correo y redes para ofrecer tus servicios.", "en": "Ready-made WhatsApp, email and social messages to offer your services."}, "free": false}];
const TPL_CATS = [
  { id: 'all', es: 'Todas', en: 'All' },
  { id: 'sitio', es: 'Sitios por tipo de negocio', en: 'Sites by business type' },
  { id: 'sistema', es: 'Sistemas a medida', en: 'Custom systems' },
  { id: 'negocio', es: 'Para tus clientes', en: 'For your clients' }
];
const TPL = { cat: 'all', html: {}, lang: null, all: false };
const TPL_SHOW = 6;

const tplL = o => (LANG === 'en' ? o.en : o.es);

async function loadTemplates() {
  if (!STATE.user) return;
  if (TPL.lang === LANG + (hasAccess('plantillas') ? '' : ':free')) return;
  let { data } = await sb.from('content').select('item_id, html').eq('product_id', 'plantillas').eq('lang', LANG);
  if ((!data || !data.length) && LANG !== 'es') ({ data } = await sb.from('content').select('item_id, html').eq('product_id', 'plantillas').eq('lang', 'es'));
  TPL.html = {};
  (data || []).forEach(r => { TPL.html[r.item_id] = r.html; });
  TPL.lang = LANG + (hasAccess('plantillas') ? '' : ':free');
}

async function renderTemplates() {
  const root = document.getElementById('tpl-root');
  if (!root || !STATE.user) return;
  try { await loadTemplates(); } catch (e) { /* se muestra el índice igualmente */ }
  const full = hasAccess('plantillas');
  const list = TPL_META.filter(m => TPL.cat === 'all' || m.cat === TPL.cat);
  const shown = TPL.all ? list : list.slice(0, TPL_SHOW);
  const lock = '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  root.innerHTML =
    '<div class="tpl-bar"><div class="tpl-cats" role="tablist">' + TPL_CATS.map(c => '<button type="button" class="tpl-cat' + (c.id === TPL.cat ? ' is-on' : '') + '" onclick="TPL.cat=\'' + c.id + '\';TPL.all=false;renderTemplates()">' + escapeHtml(tplL(c)) + '</button>').join('') + '</div>' +
      (full ? '' : '<button type="button" class="tpl-unlock" onclick="openCheckout(\'pase\')">' + lock + escapeHtml(t('Incluidas en el pase completo')) + priceTag('pase') + '</button>') + '</div>' +
    '<div class="tpl-grid">' + shown.map(m => {
      const open = !!TPL.html[m.id];
      return '<button type="button" class="tpl-card' + (open ? '' : ' is-locked') + '" onclick="openTemplate(\'' + m.id + '\')" title="' + escapeHtml(tplL(m.d)) + '">' +
        '<span class="tpl-ic">' + (emojiIcon(m.ic) || '') + '</span>' +
        '<span class="tpl-txt"><b>' + escapeHtml(tplL(m.t)) + '</b><small>' + escapeHtml(tplL(m.d)) + '</small></span>' +
        (open ? (m.free && !full ? '<span class="tpl-tag">' + escapeHtml(t('Gratis')) + '</span>' : '<span class="tpl-arrow">→</span>') : '<span class="tpl-lockic">' + lock + '</span>') + '</button>';
    }).join('') + '</div>' +
    (list.length > TPL_SHOW ? '<button type="button" class="tpl-more" onclick="TPL.all=!TPL.all;renderTemplates()">' + escapeHtml(TPL.all ? t('Ver menos') : t('Ver todas') + ' (' + list.length + ')') + '</button>' : '');
}

function ensureTplModal() {
  if (document.getElementById('tpl-modal')) return;
  const el = document.createElement('div');
  el.id = 'tpl-modal'; el.className = 'tpl-modal'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="tpl-modal-bg" onclick="closeTemplate()"></div><div class="tpl-sheet"><button type="button" class="icon-btn tpl-x" onclick="closeTemplate()" aria-label="' + escapeHtml(t('Cerrar')) + '"><svg><use href="#i-x"/></svg></button><div id="tpl-body"></div></div>';
  document.body.appendChild(el);
}

function openTemplate(id) {
  const m = TPL_META.find(x => x.id === id);
  if (!m) return;
  ensureTplModal();
  const body = document.getElementById('tpl-body');
  const html = TPL.html[id];
  if (!html) {
    body.innerHTML = '<div class="tpl-head"><span class="tpl-ic">' + m.ic + '</span><div><h3>' + escapeHtml(tplL(m.t)) + '</h3><p>' + escapeHtml(tplL(m.d)) + '</p></div></div>' +
      '<div class="tpl-lock"><b>' + escapeHtml(t('Esta plantilla está incluida en el pase completo')) + '</b><p>' + escapeHtml(t('Con el pase completo desbloqueas las 17 plantillas, todos los programas, los libros, asesorías y certificados.')) + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary" onclick="closeTemplate();openCheckout(\'pase\')">' + escapeHtml(t('Obtener el pase completo')) + priceTag('pase') + '</button></div>';
  } else {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = [...doc.querySelectorAll('.tpl-b')].map(b => ({ label: b.dataset.label, text: b.querySelector('pre').textContent }));
    body.innerHTML = '<div class="tpl-head"><span class="tpl-ic">' + m.ic + '</span><div><h3>' + escapeHtml(tplL(m.t)) + '</h3><p>' + escapeHtml(tplL(m.d)) + '</p></div></div>' +
      '<p class="tpl-tip">' + escapeHtml(t('Cambia lo que está entre [corchetes] por los datos de tu negocio o de tu cliente, copia y pégalo en Claude.')) + '</p>' +
      blocks.map((b, i) => '<div class="ai-prompt"><div class="ai-prompt-head"><span class="ai-prompt-kicker">' + (i + 1) + '</span><b>' + escapeHtml(b.label) + '</b><button type="button" class="ai-copy" onclick="copyPrompt(this)">' + escapeHtml(t('Copiar')) + '</button></div><pre class="ai-prompt-text">' + escapeHtml(b.text) + '</pre></div>').join('') +
      '<div class="tpl-actions"><a class="ui-btn ui-btn--primary" href="https://claude.ai/new" target="_blank" rel="noopener">' + escapeHtml(t('Abrir Claude')) + '</a><a class="ui-btn ui-btn--ghost" href="https://claude.ai/code" target="_blank" rel="noopener">' + escapeHtml(t('Abrir Claude Code en la web')) + '</a></div>';
  }
  document.getElementById('tpl-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  body.parentElement.scrollTop = 0;
}

function closeTemplate() {
  const m = document.getElementById('tpl-modal');
  if (m) m.hidden = true;
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTemplate(); });
