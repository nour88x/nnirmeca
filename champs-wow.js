/* VisionGuide maj24 — Guide › 02 : section « Dictionnaire des champs et Champ détecté ».
   Fichier AJOUTÉ. (1) Simulation : une question, le champ détecté, puis l'analyse — 4 exemples en boucle,
   uniquement quand la section est à l'écran. (2) Halo qui suit le pointeur sur les fiches (souris uniquement).
   prefers-reduced-motion : le premier exemple reste affiché, sans mouvement. */
(() => {
  'use strict';
  const sec = document.getElementById('champs');
  if (!sec) return;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const SC = [
    { q: 'Où est la <mark>porte</mark> ?', d: 'Champ détecté : les portes.', k: 'porte', a: 'Analyse de l\'image en cours.' },
    { q: 'Qu\'est-ce qui est <mark>écrit</mark> ?', d: 'Champ détecté : la lecture du texte.', k: 'lecture', a: 'Analyse de l\'image en cours.' },
    { q: 'Où est la <mark>salle d\'attente</mark> ?', d: 'Champ détecté : la salle d\'attente.', k: 'attente', a: 'Analyse de l\'image en cours.' },
    { q: 'Raconte-moi une histoire.', d: 'Aucun champ détecté. Je décris ce que je vois en détail.', k: '', a: 'Description de la scène, puis lecture du texte visible.' }
  ];
  const you = sec.querySelector('.ch-you'), det = sec.querySelector('.ch-det'), ana = sec.querySelector('.ch-ana');
  const dots = Array.from(sec.querySelectorAll('.ch-dots li'));
  if (!you || !det || !ana) return;
  const put = (el, html) => { el.querySelector('.ch-txt').innerHTML = html; };

  function show(i) {
    const s = SC[i];
    put(you, s.q); put(det, s.d); put(ana, s.a);
    const tag = det.querySelector('.ch-tag'); tag.textContent = s.k;
    dots.forEach((x, j) => x.classList.toggle('on', j === i));
  }
  if (reduce) { show(0); [you, det, ana].forEach((b) => b.classList.add('on')); return; }

  let run = false, i = 0, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function cycle() {
    if (!run) return;
    [you, det, ana].forEach((b) => b.classList.remove('on'));
    later(() => {
      show(i);
      you.classList.add('on');
      later(() => det.classList.add('on'), 1300);
      later(() => ana.classList.add('on'), 2800);
      later(() => { i = (i + 1) % SC.length; cycle(); }, 6200);
    }, 450);
  }
  const start = () => { if (run) return; run = true; cycle(); };
  const stop = () => { run = false; timers.forEach(clearTimeout); timers = []; };
  show(0);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0.2 }).observe(sec.querySelector('.ch-demo'));
  } else start();

  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    sec.addEventListener('pointermove', (e) => {
      const c = e.target.closest && e.target.closest('.ch-f, .dc');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
})();
