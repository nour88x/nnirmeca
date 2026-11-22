/* Guide › 02 — Procédure d'utilisation : apparition des étapes et ligne de parcours qui se remplit au défilement */
(function () {
  'use strict';
  const sec = document.getElementById('utilisation');
  if (!sec) return;
  let io = null, raf = 0;
  /* barre de progression : placée dans <body> pour rester fixée en haut de l'écran */
  const bar = sec.querySelector('.use-progress');
  if (bar) {
    document.body.appendChild(bar);
    const sync = () => bar.classList.toggle('on', sec.classList.contains('active'));
    new MutationObserver(sync).observe(sec, { attributes: true, attributeFilter: ['class'] }); sync();
  }
  const steps = () => Array.from(sec.querySelectorAll('.use-step'));

  function update() {
    raf = 0;
    if (!sec.classList.contains('active')) return;
    const route = sec.querySelector('.use-route');
    if (!route) return;
    const r = route.getBoundingClientRect(), line = innerHeight * 0.6;
    route.style.setProperty('--p', Math.min(1, Math.max(0, (line - r.top) / r.height)).toFixed(4));
    bar.style.setProperty('--pg', Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4));
    steps().forEach((s) => {
      const n = s.querySelector('.use-node').getBoundingClientRect();
      s.classList.toggle('reached', n.top + n.height / 2 < line);
    });
  }
  const tick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);

  function enter() {
    sec.classList.add('anim');                       // sans JavaScript, tout reste visible
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) { steps().forEach((s) => s.classList.add('on')); update(); return; }
    io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    steps().forEach((s) => { s.classList.remove('on', 'reached'); io.observe(s); });
    setTimeout(update, 60);
  }
  /* Halo lumineux qui suit le pointeur sur les cartes ; légère inclinaison 3D des visuels (souris uniquement) */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    sec.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.use-card');
      if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
      const vis = e.target.closest && e.target.closest('.use-vis');
      if (vis) { const r = vis.getBoundingClientRect(); vis.classList.add('tilt');
        vis.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 9).toFixed(2) + 'deg');
        vis.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 7).toFixed(2) + 'deg'); }
    });
    sec.addEventListener('pointerout', (e) => { const v = e.target.closest && e.target.closest('.use-vis'); if (v && !v.contains(e.relatedTarget)) { v.style.setProperty('--rx', '0deg'); v.style.setProperty('--ry', '0deg'); } });
  }
  window.VGUse = { enter };
})();
