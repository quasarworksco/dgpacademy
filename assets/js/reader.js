// =========================================================
// Experiencia de lectura: barra de progreso, tamaño de letra y tiempo de lectura
// =========================================================
const READ_SIZES = ['md', 'lg', 'xl'];
function readSize() { try { return localStorage.getItem('dgp-read-size') || 'md'; } catch (e) { return 'md'; } }
function applyReadSize(s) {
  document.documentElement.dataset.readSize = s;
  document.querySelectorAll('.read-size-btn').forEach(b => b.setAttribute('data-size', s));
}
function cycleReadSize() {
  const s = READ_SIZES[(READ_SIZES.indexOf(readSize()) + 1) % READ_SIZES.length];
  try { localStorage.setItem('dgp-read-size', s); } catch (e) {}
  applyReadSize(s);
}

function initReaderUX() {
  applyReadSize(readSize());
  [
    { scroller: '#book-content', bar: '#book-screen .book-topbar' },
    { scroller: '#book-content-2', bar: '#book-screen-2 .book-topbar' },
    { scroller: null, bar: '.main > .topbar' },
  ].forEach(({ scroller, bar }) => {
    const b = document.querySelector(bar);
    if (!b || b.querySelector('.read-progress')) return;
    const line = document.createElement('div');
    line.className = 'read-progress';
    line.innerHTML = '<span></span>';
    b.appendChild(line);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'read-size-btn';
    btn.setAttribute('aria-label', t('Tamaño de letra'));
    btn.title = t('Tamaño de letra');
    btn.innerHTML = '<span class="a1">A</span><span class="a2">A</span>';
    btn.addEventListener('click', e => { e.stopPropagation(); cycleReadSize(); });
    const actions = b.querySelector('.topbar-actions');
    if (actions) actions.prepend(btn);
    else { const slot = b.querySelector('[data-lang-slot]'); slot ? b.insertBefore(btn, slot) : b.appendChild(btn); }
    const el = scroller ? document.querySelector(scroller) : null;
    const update = () => {
      const top = el ? el.scrollTop : window.scrollY;
      const max = el ? el.scrollHeight - el.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
      line.firstChild.style.transform = 'scaleX(' + (max > 40 ? Math.min(1, top / max) : 0) + ')';
    };
    (el || window).addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  });
  applyReadSize(readSize());
}

// Tiempo estimado de lectura al inicio de cada capítulo o lección
function addReadingTime(el) {
  if (el.querySelector('.read-meta')) return;
  const words = (el.textContent || '').trim().split(/\s+/).length;
  if (words < 120) return;
  const mins = Math.max(1, Math.round(words / 210));
  const hasWb = !!el.querySelector('.wb');
  const html = '<div class="read-meta"><span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
    mins + ' ' + escapeHtml(t('min de lectura')) + '</span>' +
    (hasWb ? '<span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>' + escapeHtml(t('Incluye cuaderno de trabajo')) + '</span>' : '') + '</div>';
  const title = el.querySelector('.book-ch-title');
  const lessonHead = el.querySelector('.lesson-header');
  if (title) title.insertAdjacentHTML('afterend', html);
  else if (lessonHead) lessonHead.insertAdjacentHTML('beforeend', html);
}

document.addEventListener('DOMContentLoaded', initReaderUX);
