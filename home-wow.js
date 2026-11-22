/* VisionGuide maj24 — Onglet HOME : habillage dynamique.
   Fichier AJOUTÉ (app.js n'est pas modifié).
   - la « lentille » éclaire la photo au pointeur (ou se promène seule sur écran tactile / au repos)
     et verrouille les éléments qu'elle croise ;
   - les cadres de détection restent alignés sur la photo quelle que soit la taille de l'écran ;
   - parallaxe des chapitres, apparitions, boutons magnétiques, horloge du HUD. */
(() => {
  const home = document.getElementById('home');
  if (!home) return;
  const hv = home.querySelector('#hv');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ===== lentille + cadres ===== */
  const IW = 1376, IH = 768, MAN_X = 0.40, MAN_TO = 0.62;   // l'utilisateur est au centre-droit, photo retournée
  const imgs = [...hv.querySelectorAll('.hv-media img')], boxes = [...hv.querySelectorAll('.hv-box')];
  const lens = hv.querySelector('.hv-lens'), xy = hv.querySelector('#hvXY');
  let W = 0, H = 0, cx = 0, cy = 0, tx = 0, ty = 0, last = 0, frame = 0, run = false, centers = [];

  const layout = () => {
    const r = hv.getBoundingClientRect(); W = r.width; H = r.height;
    if (!W || !H) return;
    const s = Math.max(W / IW, H / IH), dw = IW * s, dh = IH * s;
    const px = dw > W + 1 ? clamp(((1 - MAN_TO) * W - MAN_X * dw) / (W - dw), 0, 1) : 0.5, py = 0.22;
    const ox = (W - dw) * px, oy = (H - dh) * py;
    imgs.forEach((i) => { i.style.objectPosition = px * 100 + '% ' + py * 100 + '%'; });
    centers = boxes.map((b) => {
      const [x, y, w, h] = b.dataset.b.split(',').map(Number);
      const l = W - ox - (x + w) * dw, t = oy + y * dh, bw = w * dw, bh = h * dh;
      Object.assign(b.style, { left: l + 'px', top: t + 'px', width: bw + 'px', height: bh + 'px' });
      return [l + bw / 2, t + bh / 2, Math.max(bw, bh) / 2];
    });
    if (!cx && !cy) { cx = tx = W * 0.6; cy = ty = H * 0.45; }
    if (calm || !run) paint();
  };

  const paint = () => {
    hv.style.setProperty('--mx', cx + 'px'); hv.style.setProperty('--my', cy + 'px');
    lens.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    boxes.forEach((b, k) => {
      const c = centers[k]; if (!c) return;
      b.classList.toggle('lock', calm || Math.hypot(cx - c[0], cy - c[1]) < 130 + c[2] * 0.55);
    });
    if (!(frame++ % 6)) xy.textContent = 'X ' + (cx / W).toFixed(2) + ' · Y ' + (cy / H).toFixed(2);
  };

  const tick = (t) => {
    if (!run) return;
    if (t - last > 3500) {   // au repos (ou écran tactile) : la lentille explore seule la scène
      tx = W * (0.56 + 0.3 * Math.sin(t * 0.00042)); ty = H * (0.46 + 0.24 * Math.sin(t * 0.00071 + 1));
    }
    cx += (tx - cx) * 0.085; cy += (ty - cy) * 0.085;
    paint(); requestAnimationFrame(tick);
  };
  const start = () => { if (run || calm) return; run = true; requestAnimationFrame(tick); };
  const stop = () => { run = false; };

  if (fine) hv.addEventListener('pointermove', (e) => {
    const r = hv.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; last = performance.now();
  });
  new IntersectionObserver((es) => { es[0].isIntersecting ? (layout(), start()) : stop(); }, { threshold: 0.05 }).observe(hv);
  new ResizeObserver(layout).observe(hv);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : (hv.getBoundingClientRect().height && start())));
  layout();

  /* horloge du HUD */
  const clock = hv.querySelector('#hvClock');
  const tock = () => { clock.textContent = new Date().toLocaleTimeString('fr-FR'); };
  tock(); setInterval(() => { if (run) tock(); }, 1000);

  /* boutons magnétiques */
  if (fine && !calm) home.querySelectorAll('.hv-cta .btn,.hx-cta .btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--tx', (e.clientX - r.left - r.width / 2) * 0.18 + 'px'); b.style.setProperty('--ty', (e.clientY - r.top - r.height / 2) * 0.3 + 'px');
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--tx', '0px'); b.style.setProperty('--ty', '0px'); });
  });

  /* ===== chapitres : apparition + parallaxe ===== */
  const rows = [...home.querySelectorAll('.hc-row')];
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('go'); seen.unobserve(e.target); } }), { threshold: 0.22 });
  rows.forEach((r) => seen.observe(r));
  let vis = false, pending = false;
  const para = () => {
    pending = false;
    rows.forEach((r) => {
      const b = r.getBoundingClientRect();
      r.style.setProperty('--p', clamp((b.top + b.height / 2 - innerHeight / 2) / innerHeight, -1, 1).toFixed(3));
    });
  };
  if (!calm) {
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) para(); }).observe(home.querySelector('.hc'));
    addEventListener('scroll', () => { if (vis && !pending) { pending = true; requestAnimationFrame(para); } }, { passive: true });
  }
})();
