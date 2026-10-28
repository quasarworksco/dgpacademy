const lessons = ['home','l1','l2','l3','l4','l5','l6','l7','l8','l9','l10','l11','l12','l13','l14','l15','l16'];
const TOTAL = 16;
let current = 'home';
let completed = [];

function save() {
  const uid = auth && auth.currentUser ? auth.currentUser.uid : null;
  if (uid) localStorage.setItem('curso_done_' + uid, JSON.stringify(completed));
  if (db && uid) {
    db.collection('users').doc(uid).update({
      'progress.web-dev': completed.filter(l => l !== 'home').length,
      'completedLessons.web-dev': completed,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
}

function updateProgress() {
  const n = completed.length;
  document.getElementById('prog-text').textContent = n + ' / ' + TOTAL;
  document.getElementById('prog-fill').style.width = (n / TOTAL * 100) + '%';
  lessons.forEach(id => {
    const btn = document.querySelector('[data-id="' + id + '"]');
    if (!btn) return;
    if (completed.includes(id)) btn.classList.add('done');
    else btn.classList.remove('done');
  });
}

function goTo(id) {
  document.querySelectorAll('.lesson').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const btn = document.querySelector('[data-id="' + id + '"]');
  if (btn) btn.classList.add('active');
  current = id;
  window.scrollTo(0,0);
  document.querySelector('.main').scrollTo(0,0);

  const labels = {
    home:'Inicio',l1:'Cómo funciona la web',l2:'HTML desde cero',
    l3:'CSS',l4:'JavaScript',l5:'GitHub',l6:'Claude y Gemini',
    l7:'Firebase',l8:'Herramientas extra',l9:'APIs',l10:'Flujo completo',
    l11:'Diseño y tipografía',l12:'CSS avanzado y animaciones',l13:'Responsive design',
    l14:'SEO y posicionamiento',l15:'Analítica y métricas',l16:'Portafolio y primeros clientes'
  };
  const mods = {l1:'Módulo 1',l2:'Módulo 1',l3:'Módulo 1',l4:'Módulo 1',
    l5:'Módulo 2',l6:'Módulo 2',l7:'Módulo 2',l8:'Módulo 2',
    l9:'Módulo 3',l10:'Módulo 3',
    l11:'Módulo 4',l12:'Módulo 4',l13:'Módulo 4',
    l14:'Módulo 5',l15:'Módulo 5',l16:'Módulo 5'};
  const bc = document.getElementById('breadcrumb');
  if (id === 'home') bc.innerHTML = 'Inicio → <span>Bienvenida</span>';
  else bc.innerHTML = (mods[id]||'Inicio') + ' → <span>' + (labels[id]||id) + '</span>';

  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  const bd = document.getElementById('sidebar-backdrop');
  if (bd) bd.classList.remove('show');
  // re-init animations for new lesson
  setTimeout(initAnimations, 50);
  // update finish button state if on l16
  if (id === 'l16') setTimeout(updateFinishBtn, 0);
}

function markDone() {
  if (current !== 'home' && !completed.includes(current)) {
    completed.push(current);
    save();
    updateProgress();
  }
}

function markDoneAndNext(curr, next) {
  if (!completed.includes(curr)) { completed.push(curr); save(); }
  updateProgress();
  goTo(next);
}

function markDoneAndFinish() {
  if (!completed.includes('l16')) { completed.push('l16'); save(); }
  updateProgress();
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({
      completedCourses: firebase.firestore.FieldValue.arrayUnion('web-dev')
    }).catch(() => {});
  }
  window._userDoc = window._userDoc || {};
  window._userDoc.completedCourses = Array.from(new Set([...(window._userDoc.completedCourses || []), 'web-dev']));
  updateFinishBtn();
  showCertificate();
}

function updateFinishBtn() {
  const btn = document.getElementById('btn-finish-course');
  const hint = document.getElementById('l16-done-hint');
  if (!btn) return;
  if (completed.includes('l16')) {
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2 7 22l5-3 5 3-1.5-7.8"/></svg> Ver mi certificado';
    btn.style.cssText = '';
    btn.setAttribute('onclick', 'showCertificate()');
    const nav = document.getElementById('l16-nav');
    if (nav && !document.getElementById('btn-restart')) {
      const restart = document.createElement('button');
      restart.id = 'btn-restart';
      restart.className = 'btn btn-ghost';
      restart.style.cssText = 'font-size:12px;';
      restart.textContent = 'Volver al inicio del curso';
      restart.onclick = () => goTo('home');
      nav.querySelector('div').appendChild(restart);
    }
    if (hint) hint.style.display = 'block';
  }
}

function showSettings() {
  const overlay = document.getElementById('settings-overlay');
  overlay.style.display = 'flex';
  const user = auth ? auth.currentUser : null;
  if (user && user.displayName) {
    const parts = user.displayName.split(' ');
    document.getElementById('settings-name').value = parts[0] || '';
    document.getElementById('settings-apellido').value = parts.slice(1).join(' ') || '';
  }
  if (db && user) {
    db.collection('users').doc(user.uid).get().then(doc => {
      if (doc.exists && doc.data().phone) {
        document.getElementById('settings-phone').value = doc.data().phone;
      }
    }).catch(() => {});
  }
}

function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
}

function saveSettingsName() {
  const name     = document.getElementById('settings-name').value.trim();
  const apellido = document.getElementById('settings-apellido').value.trim();
  if (!name) return;
  const fullName = `${name} ${apellido}`.trim();
  const user = auth ? auth.currentUser : null;
  if (!user) return;
  user.updateProfile({ displayName: fullName }).then(() => {
    if (db) db.collection('users').doc(user.uid).update({ name: fullName });
    fillUserUI(user);
    renderCertificates();
    const msg = document.getElementById('settings-name-msg');
    msg.style.display = 'inline-block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });
}

function saveSettingsPhone() {
  const phone = document.getElementById('settings-phone').value.trim();
  if (!phone) return;
  const user = auth ? auth.currentUser : null;
  if (!user || !db) return;
  db.collection('users').doc(user.uid).update({ phone }).then(() => {
    const msg = document.getElementById('settings-phone-msg');
    msg.style.display = 'inline-block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });
}

function sendPasswordReset() {
  const user = auth ? auth.currentUser : null;
  if (!user) return;
  auth.sendPasswordResetEmail(user.email).then(() => {
    const msg = document.getElementById('settings-pass-msg');
    msg.style.display = 'inline-block';
    setTimeout(() => { msg.style.display = 'none'; }, 4000);
  });
}

function nextLesson() {
  const idx = lessons.indexOf(current);
  if (idx < lessons.length - 1) goTo(lessons[idx + 1]);
}

function toggleCard(card) {
  card.classList.toggle('expanded');
}

function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  const isOpen = sidebar.classList.toggle('open');
  if (bd) bd.classList.toggle('show', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const bd = document.getElementById('sidebar-backdrop');
  if (bd) bd.classList.remove('show');
}

function resetProgress() {
  if (!confirm('¿Reiniciar todo el progreso? Esto borrará las lecciones completadas.')) return;
  completed = [];
  save();
  if (db && auth && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).update({
      'completedCourses': firebase.firestore.FieldValue.arrayRemove('web-dev'),
      'completedLessons.web-dev': []
    }).catch(() => {});
  }
  updateProgress();
  const btn = document.querySelector('.reset-btn');
  btn.textContent = '✓ Reiniciado';
  setTimeout(() => { btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Reiniciar progreso'; }, 2000);
}

// Scroll-triggered entrance animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function initAnimations() {
  document.querySelectorAll('.card, .step, .tool-card, .mod-card, .callout, .quiz-card, .compare-cell, .flow-node, .checklist li').forEach(el => {
    el.classList.add('anim-enter');
    observer.observe(el);
  });
}

function quiz(el, result) {
  const parent = el.closest('.quiz-card');
  parent.querySelectorAll('.quiz-opt').forEach(o => { o.classList.remove('correct','wrong'); o.style.pointerEvents='none'; });
  el.classList.add(result);
  const fb = document.getElementById('qfb');
  if (fb) fb.classList.add('show');
}

updateProgress();
initAnimations();
