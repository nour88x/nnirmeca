/* VisionGuide maj24 — Guide › 02 : animations en temps réel des étapes 4 à 8 et du « Dictionnaire des temps d'attente ».
   Fichier AJOUTÉ. (1) Chaque bande .pl déroule ses étapes avec leur vraie durée (data-d, en secondes) et pose
   data-ph (numéro de phase) sur l'étape : les illustrations réagissent en CSS. --live = compte à rebours affiché.
   (2) Le dictionnaire fait tourner les anneaux (durée réelle) et la chronologie complète (lecture ×5).
   Rien ne tourne hors écran ; prefers-reduced-motion : tout reste affiché, sans mouvement. */
(() => {
  'use strict';
  const sec = document.getElementById('utilisation');
  if (!sec) return;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const $$ = (s, r = sec) => Array.from(r.querySelectorAll(s));

  /* ---------- 1. Séquenceurs des étapes ---------- */
  $$('.pl').forEach((pl) => {
    const step = pl.closest('.use-step');
    const nodes = $$('.pl-n', pl);
    const chipOf = (n) => n.querySelector('.pl-chip');
    nodes.forEach((n) => { const c = chipOf(n); if (c) c.dataset.o = c.textContent; });
    const setPh = (i) => { if (step) step.setAttribute('data-ph', String(i)); };
    let run = false, tok = 0, timer = 0, raf = 0;

    if (reduce) { nodes.forEach((n) => n.classList.add('done')); setPh(nodes.length - 1); return; }

    function reset() {
      cancelAnimationFrame(raf);
      nodes.forEach((n) => { n.classList.remove('on', 'done'); const c = chipOf(n); if (c && c.dataset.o) c.textContent = c.dataset.o; });
      pl.classList.remove('end'); setPh(-1);
      if (step) step.style.removeProperty('--live');
    }
    function tick(n, d, t0, t) {
      if (!run || t !== tok || !n.classList.contains('on')) return;
      const rem = Math.max(0, d - (performance.now() - t0) / 1000), txt = rem.toFixed(1);
      if (step) step.style.setProperty('--live', '"' + txt + '"');
      const c = chipOf(n); if (c) c.textContent = txt + ' s';
      if (rem > 0) raf = requestAnimationFrame(() => tick(n, d, t0, t));
    }
    function go(i, t) {
      if (!run || t !== tok) return;
      if (i >= nodes.length) {
        pl.classList.add('end');
        timer = setTimeout(() => { reset(); timer = setTimeout(() => { tok++; go(0, tok); }, 150); }, 2800);
        return;
      }
      const n = nodes[i], d = parseFloat(n.dataset.d) || 1;
      n.style.setProperty('--d', d + 's');
      n.classList.add('on'); setPh(i);
      if (n.hasAttribute('data-cnt')) tick(n, d, performance.now(), t);
      timer = setTimeout(() => {
        n.classList.remove('on'); n.classList.add('done');
        const c = chipOf(n); if (c && c.dataset.o) c.textContent = c.dataset.o;
        go(i + 1, t);
      }, d * 1000);
    }
    const start = () => { run = true; tok++; reset(); const t = tok; timer = setTimeout(() => go(0, t), 200); };
    const stop = () => { run = false; clearTimeout(timer); cancelAnimationFrame(raf); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? (!run && start()) : stop())), { threshold: 0.45 }).observe(pl);
    } else start();
  });

  /* ---------- 2. Dictionnaire des temps d'attente ---------- */
  const dl = document.getElementById('delais');
  if (!dl) return;
  const rings = $$('.rg[data-t]', dl);
  const segs = $$('.tm-s, .tm-pin', dl);
  const board = dl.querySelector('.tm-board');
  const out = dl.querySelector('.tm-now');
  const T = board ? parseFloat(board.dataset.t) : 0;
  const SPEED = 5;

  if (reduce) {
    rings.forEach((r) => r.style.setProperty('--v', '100'));
    segs.forEach((s) => s.classList.add('lit'));
    if (out) out.textContent = 'Session complète';
    return;
  }
  let run = false, raf = 0, t0 = 0;
  function frame(now) {
    if (!run) return;
    rings.forEach((r) => {
      const d = parseFloat(r.dataset.t), cyc = d + 0.9;
      const p = Math.min(1, ((now / 1000 + (parseFloat(r.dataset.o) || 0)) % cyc) / d);
      r.style.setProperty('--v', (p * 100).toFixed(1));
    });
    if (board) {
      const cyc = T / SPEED + 2.4, e = ((now - t0) / 1000) % cyc, t = Math.min(T, e * SPEED);
      board.style.setProperty('--t', t.toFixed(2));
      let cur = null;
      segs.forEach((s) => {
        const st = +s.dataset.s, du = +s.dataset.d, isNow = t >= st && t < st + du;
        s.classList.toggle('lit', t >= st);
        s.classList.toggle('now', isNow);
        if (isNow && !s.classList.contains('k-ghost') && (!cur || st >= +cur.dataset.s)) cur = s;
      });
      if (out) out.textContent = 't = ' + Math.round(t) + ' s' + (cur ? ' · ' + cur.dataset.n : '');
    }
    raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !run) { run = true; t0 = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting) { run = false; cancelAnimationFrame(raf); }
    }), { threshold: 0.12 }).observe(dl);
  } else { run = true; t0 = performance.now(); raf = requestAnimationFrame(frame); }

  /* halo qui suit le pointeur sur les cartes du dictionnaire (souris uniquement) */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    dl.addEventListener('pointermove', (e) => {
      const c = e.target.closest && e.target.closest('.dc');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
})();
