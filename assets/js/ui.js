// =========================================================
// DGP Academy — interfaz: landing, avisos y certificados
// =========================================================

// ── Avisos breves ────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Landing: menú móvil, anclas y animaciones de entrada ──────────────────────
function toggleLpMenu(force) {
  const nav = document.getElementById('lp-nav');
  const btn = document.getElementById('lp-nav-toggle');
  if (!nav) return;
  const open = typeof force === 'boolean' ? force : !nav.classList.contains('open');
  nav.classList.toggle('open', open);
  if (btn) {
    btn.setAttribute('aria-expanded', open);
    btn.innerHTML = '<svg><use href="#' + (open ? 'i-x' : 'i-menu') + '"/></svg>';
  }
}

(function initLanding() {
  const ls = document.getElementById('landing-screen');
  if (!ls) return;

  ls.addEventListener('click', e => {
    const a = e.target.closest('[data-scroll]');
    if (!a) return;
    e.preventDefault();
    toggleLpMenu(false);
    lpScrollTo(a.getAttribute('data-scroll'));
  });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    });
  }, { root: ls, threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('#landing-screen .reveal').forEach(el => io.observe(el));
})();

// ── Certificados ─────────────────────────────────────────────────────────────
const CERT_TYPES = {
  'web-dev': {
    code: 'WEB',
    title: 'Certificado',
    sub: 'de finalización',
    lead: 'por haber completado satisfactoriamente el programa',
    course: 'Diseño y Desarrollo Web con IA',
    detail: '16 lecciones en 5 módulos: fundamentos web, herramientas profesionales, integraciones con APIs, diseño responsive y estrategia digital.',
    label: 'Programa · 16 lecciones'
  },
  '7st': {
    code: '7ST',
    title: 'Certificado',
    sub: 'de lectura',
    lead: 'por haber leído y aprobado la evaluación final del libro',
    course: '7ST · Vol. 1 — Redes Sociales y Emprendimiento',
    detail: 'Diez capítulos sobre entorno digital, identidad de marca, contenido, comunidad, analítica, aspectos legales y mentalidad emprendedora.',
    label: 'Libro digital · Serie 7ST',
    book: true
  }
};
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(d) {
  return LANG === 'en'
    ? MONTHS_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear()
    : d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
}

// Curva guilloché (hipotrocoide), como en papel de seguridad
function guilloche(cx, cy, R, r, d, steps) {
  let p = '';
  const k = (R - r) / r;
  const turns = Math.round(r / gcd(Math.round(R), Math.round(r)));
  const total = Math.PI * 2 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = total * i / steps;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    p += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return p;
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

let CERT_ART = null;
function certArt() {
  if (CERT_ART) return CERT_ART;
  const rose = guilloche(148.5, 108, 60, 22, 34, 1400);
  const rose2 = guilloche(148.5, 108, 44, 16, 26, 1000);
  const corner = (x, y) => guilloche(x, y, 12, 4, 7, 300);
  const bg =
    '<svg class="c-guilloche" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs>' +
        '<pattern id="cw" width="5" height="2.6" patternUnits="userSpaceOnUse"><path d="M0 1.3 Q1.25 0 2.5 1.3 T5 1.3" fill="none" stroke="#1a56e8" stroke-opacity=".38" stroke-width=".22"/><path d="M0 1.3 Q1.25 2.6 2.5 1.3 T5 1.3" fill="none" stroke="#b8913a" stroke-opacity=".55" stroke-width=".22"/></pattern>' +
        '<radialGradient id="cbg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#fffefb"/><stop offset="1" stop-color="#fbf6ea"/></radialGradient>' +
      '</defs>' +
      '<rect width="297" height="210" fill="#0a1430"/>' +
      '<rect x="1.6" y="1.6" width="293.8" height="206.8" fill="url(#cw)"/>' +
      '<rect x="1.6" y="1.6" width="293.8" height="206.8" fill="none" stroke="#b8913a" stroke-width=".35"/>' +
      '<rect x="10.1" y="10.1" width="276.8" height="189.8" fill="url(#cbg)"/>' +
      '<path d="' + rose + '" fill="none" stroke="#1a56e8" stroke-opacity=".07" stroke-width=".25"/>' +
      '<path d="' + rose2 + '" fill="none" stroke="#b8913a" stroke-opacity=".12" stroke-width=".22"/>' +
      '<g fill="none" stroke="#b8913a" stroke-opacity=".45" stroke-width=".2">' +
        '<path d="' + corner(22, 22) + '"/><path d="' + corner(275, 22) + '"/><path d="' + corner(22, 188) + '"/><path d="' + corner(275, 188) + '"/>' +
      '</g>' +
    '</svg>';

  let scallop = '';
  for (let i = 0; i < 72; i++) {
    const a = Math.PI * 2 * i / 72, rr = i % 2 ? 56 : 59.5;
    scallop += (i ? 'L' : 'M') + (60 + rr * Math.cos(a)).toFixed(2) + ' ' + (60 + rr * Math.sin(a)).toFixed(2);
  }
  const sealRose = guilloche(60, 60, 30, 11, 17, 1300);
  const seal =
    '<svg class="c-seal" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="sg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f1dda4"/><stop offset=".55" stop-color="#c9a24c"/><stop offset="1" stop-color="#8a6a22"/></radialGradient>' +
        '<path id="sealText" d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0"/>' +
      '</defs>' +
      '<path d="' + scallop + 'Z" fill="url(#sg)"/>' +
      '<circle cx="60" cy="60" r="50" fill="none" stroke="#fff6dd" stroke-opacity=".8" stroke-width=".8"/>' +
      '<circle cx="60" cy="60" r="33" fill="#0a1430"/>' +
      '<path d="' + sealRose + '" fill="none" stroke="#c9a24c" stroke-opacity=".55" stroke-width=".35"/>' +
      '<text font-family="JetBrains Mono, monospace" font-size="6.4" font-weight="500" fill="#3d2c08" letter-spacing="1.3"><textPath href="#sealText" startOffset="0">DGP ACADEMY · CERTIFICADO OFICIAL · DGP GLOBAL GROUP ·</textPath></text>' +
      '<g transform="translate(47 47)"><path d="M3 2h7a11 11 0 0 1 0 22H3z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="23" r="2.6" fill="#4d7cff"/></g>' +
    '</svg>';

  const signature =
    '<svg viewBox="0 0 220 60" aria-hidden="true"><path d="M8 42c10-2 18-20 26-26 6-4 8 2 4 10-5 10-12 20-6 20 8 0 16-22 24-22 5 0-2 14 4 14 7 0 10-12 16-12 4 0 2 8 6 8 6 0 9-9 15-9 4 0 3 6 7 6 9 0 14-14 22-16 6-1 2 12 8 12 8 0 14-8 22-8 9 0 20 4 40 1" fill="none" stroke="#13224a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 50c40-6 90-8 150-6" fill="none" stroke="#13224a" stroke-width=".9" stroke-linecap="round" opacity=".55"/></svg>';

  CERT_ART = { bg, seal, signature };
  return CERT_ART;
}

let certSeq = 0;
function certHTML(data) {
  const t = CERT_TYPES[data.kind];
  const base = certArt();
  // IDs únicos por documento: un <pattern> dentro de una pantalla oculta no se pinta en las demás
  const n = ++certSeq;
  const uniq = str => str.replace(/(id="|url\(#|href="#)(cw|cbg|sg|sealText)/g, '$1$2-' + n);
  const art = { bg: uniq(base.bg), seal: uniq(base.seal), signature: base.signature };
  const name = data.name || 'Tu nombre aquí';
  const size = name.length > 34 ? 3.5 : name.length > 24 ? 4.3 : 5.4;
  return '<div class="cert-doc' + (t.book ? ' is-book' : '') + '">' +
    art.bg +
    '<div class="c-frame"></div>' +
    '<div class="c-inner">' +
      '<div class="c-top">' +
        '<div class="c-brand"><svg><use href="#dgp-mark"/></svg><div><b>DGP Academy</b><span>DGP Global Group</span></div></div>' +
        '<div class="c-no">Certificado N.º<b>' + escapeHtml(data.number) + '</b></div>' +
      '</div>' +
      '<div class="c-title">' + t.title + '</div>' +
      '<div class="c-sub">' + t.sub + '</div>' +
      '<div class="c-given">Se otorga el presente a</div>' +
      '<div class="c-name" style="font-size:' + size + 'cqw">' + escapeHtml(name) + '</div>' +
      '<div class="c-for">' + t.lead + '</div>' +
      '<div class="c-course">' + escapeHtml(t.course) + '</div>' +
      '<div class="c-detail"><span>' + escapeHtml(t.detail) + '</span>' + (data.detail ? ' <span>' + escapeHtml(data.detail) + '</span>' : '') + '</div>' +
      '<div class="c-bottom">' +
        '<div class="c-sig">' + art.signature + '<div class="c-sig-line">Dirección Académica</div><div class="c-sig-role">DGP Global Group</div></div>' +
        art.seal +
        '<div class="c-sig"><div class="c-date">' + escapeHtml(data.date) + '</div><div class="c-sig-line">Fecha de emisión</div><div class="c-sig-role">Verifícalo en academy.dgpglobalgroup.com</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// Certificados emitidos (o ya ganados y pendientes de emitir)
function earnedCertificates() {
  return ['web-dev', '7st'].filter(k => STATE.certificates[k] || isEligible(k));
}

function certData(kind) {
  const c = STATE.certificates[kind];
  const issued = c ? new Date(c.issued_at) : new Date();
  let detail = '';
  const r = STATE.reading['7st'];
  if (kind === '7st' && r && r.quiz_score != null) {
    detail = 'Evaluación final aprobada con ' + r.quiz_score + '/10.';
  }
  return {
    kind,
    name: c ? c.full_name : displayName(),
    date: formatDate(issued),
    number: c ? c.number : 'Pendiente de emisión',
    detail
  };
}

async function openCertificate(kind) {
  kind = kind || 'web-dev';
  try {
    await issueCertificate(kind);
  } catch (e) {
    toast(e.message || 'Aún no puedes obtener este certificado.');
    return;
  }
  document.getElementById('cert-stage').innerHTML = certHTML(certData(kind));
  document.getElementById('cert-modal-title').textContent = CERT_TYPES[kind].course;
  document.getElementById('cert-overlay').classList.add('show');
  renderCertificates();
}
function showCertificate() { openCertificate('web-dev'); }
function closeCert() { document.getElementById('cert-overlay').classList.remove('show'); }
function printCertificate() {
  const prev = document.title;
  document.title = t('Certificado DGP Academy') + (STATE.user ? ' — ' + displayName() : '');
  window.print();
  setTimeout(() => { document.title = prev; }, 500);
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeCert();
  if (typeof closeSettings === 'function') closeSettings();
  toggleLpMenu(false);
});

function renderCertificates() {
  const box = document.getElementById('dash-certs');
  if (!box) return;
  const list = earnedCertificates();
  const count = document.getElementById('dash-cert-count');
  if (count) count.textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<div class="dash-cert-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2 7 22l5-3 5 3-1.5-7.8"/></svg><div><strong>Aún no tienes certificados</strong>Completa las 16 lecciones del programa o aprueba la evaluación final de 7ST para obtener el primero.</div></div>';
    return;
  }
  box.innerHTML = list.map(kind => {
    const d = certData(kind);
    return '<div class="dash-cert">' +
      '<div class="dash-cert-thumb"><div class="cert-stage">' + certHTML(d) + '</div></div>' +
      '<div><div class="dash-cert-title">' + escapeHtml(CERT_TYPES[kind].course) + '</div>' +
      '<div class="dash-cert-meta">' + escapeHtml(d.number) + '<br>' + escapeHtml(d.date) + '</div>' +
      '<button class="ui-btn ui-btn--ghost ui-btn--sm" onclick="openCertificate(\'' + kind + '\')"><svg><use href="#i-award"/></svg>Ver y descargar</button></div>' +
    '</div>';
  }).join('');
}

// Vista previa en la landing
function previewCertificate() {
  const el = document.getElementById('lp-cert-preview');
  if (!el) return;
  el.innerHTML = certHTML({ kind: 'web-dev', name: t('Tu nombre aquí'), date: formatDate(new Date()), number: 'DGP-WEB-' + new Date().getFullYear() + '-0000000' });
}
previewCertificate();

// ── Verificación pública de certificados ─────────────────────────────────────
function openVerify(prefill) {
  const o = document.getElementById('verify-overlay');
  if (!o) return;
  o.style.display = 'flex';
  const input = document.getElementById('verify-input');
  if (prefill) input.value = prefill;
  document.getElementById('verify-result').innerHTML = '';
  if (prefill) verifyCertificate(); else input.focus();
}
function closeVerify() { const o = document.getElementById('verify-overlay'); if (o) o.style.display = 'none'; }

async function verifyCertificate(e) {
  if (e) e.preventDefault();
  const num = document.getElementById('verify-input').value.trim().toUpperCase();
  const box = document.getElementById('verify-result');
  if (!num) { box.innerHTML = '<p class="modal-error">Escribe el número del certificado.</p>'; return; }
  box.innerHTML = '<p class="modal-hint">Buscando…</p>';
  const { data, error } = await sb.rpc('verify_certificate', { num });
  if (error) { box.innerHTML = '<p class="modal-error">No se pudo verificar. Intenta de nuevo.</p>'; return; }
  if (!data || !data.length) {
    box.innerHTML = '<div class="verify-card is-bad"><strong>No encontrado</strong><span>No existe un certificado con el número ' + escapeHtml(num) + '.</span></div>';
    return;
  }
  const c = data[0];
  box.innerHTML = '<div class="verify-card is-ok"><strong>Certificado válido</strong>' +
    '<span>' + escapeHtml(c.full_name) + '</span>' +
    '<span>' + escapeHtml(LANG === 'en' && c.product_title_en ? c.product_title_en : c.product_title) + '</span>' +
    '<span>Emitido el ' + escapeHtml(formatDate(new Date(c.issued_at))) + '</span></div>';
}

(function verifyFromUrl() {
  const q = new URLSearchParams(location.search).get('verificar');
  if (q) setTimeout(() => openVerify(q), 300);
})();

