/* VisionGuide maj23 — Guide › 01 : effets « WOW » des fiches composants.
   Fichier AJOUTÉ : il n'altère aucun code existant. Il observe #composant (rempli par composants.js)
   et ajoute, après chaque affichage, des calques d'animation propres à chaque composant. */
(() => {
  const host = document.getElementById('composant');
  if (!host) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = (k, f) => Array.from({ length: k }, (_, i) => f(i)).join('');
  const r = (i, m) => (i * 53 + 17) % m;                       // pseudo-aléatoire stable
  const esc = (s) => s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const wave = (cls) => `<svg class="wf-wave ${cls}" viewBox="0 0 1600 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60Q100 ${cls ? 120 : 0} 200 60T400 60T600 60T800 60T1000 60T1200 60T1400 60T1600 60"/></svg>`;

  /* ---- calques par composant (insérés dans .d-photo) ---- */
  const FX = {
    gilet: () => '<i class="wf-siren"></i><i class="wf-beam"></i>' +
      n(18, (i) => `<b class="wf-ember" style="--x:${r(i, 100)}%;--d:${3 + r(i, 5)}s;--w:${-r(i, 7)}s;--s:${4 + r(i, 6)}px"></b>`),

    'raspberry-pi-5': () => `<svg class="wf-pcb" viewBox="0 0 800 380" preserveAspectRatio="none" aria-hidden="true">${
      ['M0 70H190L230 110H430L470 70H800', 'M0 190H120L160 230H360L400 190H640L680 230H800', 'M0 300H260L300 340H540L580 300H800',
        'M200 0V60L240 100', 'M600 380V320L560 280H480', 'M720 0V110L680 150H560']
        .map((d, i) => `<path pathLength="1" d="${d}" style="--i:${i}"/>`).join('')}</svg><b class="wf-led"></b><b class="wf-led l2"></b>`,

    'camera-module-3': () => '<i class="wf-grid"></i><i class="wf-flare"></i><i class="wf-grain"></i><i class="wf-bar t"></i><i class="wf-bar b"></i>' +
      '<div class="wf-hud"><span>ISO 100</span><span>f/1.8</span><span>1/60</span><span class="tc">00:00:00:00</span></div>' +
      '<div class="wf-hist">' + n(14, (i) => `<b style="--h:${20 + r(i, 70)}%;--i:${i}"></b>`) + '</div>',

    'power-bank': () => '<svg class="wf-arc" viewBox="0 0 800 380" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="40,320 90,270 70,250 140,190 120,170 190,110"/><polyline points="760,60 700,110 720,130 650,190 670,210 600,270"/><polyline points="400,0 380,60 410,80 385,140"/></svg>' +
      '<div class="wf-gauge" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="g0" cx="50" cy="50" r="42"/><circle class="g1" cx="50" cy="50" r="42" pathLength="100"/></svg><b></b></div>' +
      n(14, (i) => `<b class="wf-spark" style="--x:${r(i, 100)}%;--d:${2 + r(i, 4)}s;--w:${-r(i, 6)}s"></b>`),

    'casque-bluetooth': () => '<i class="wf-ring"></i><i class="wf-ring r2"></i><i class="wf-ring r3"></i>' + wave('') + wave('b') +
      '<div class="wf-eq">' + n(36, (i) => `<i style="--i:${i};--h:${25 + r(i, 70)}%"></i>`) + '</div>' +
      n(6, (i) => `<b class="wf-note" style="--x:${10 + i * 15}%;--w:${-i * 1.3}s">${i % 2 ? '♫' : '♪'}</b>`),

    'commande-connexion': () => '<svg class="wf-wires" viewBox="0 0 800 380" preserveAspectRatio="none" aria-hidden="true">' +
      ['M0 300C160 300 200 80 380 80S600 300 800 240', 'M0 120C140 120 260 330 420 300S660 60 800 120', 'M120 380C140 250 330 250 400 160S640 40 700 0']
        .map((d, i) => `<path class="w w${i + 1}" pathLength="1" d="${d}"/><path class="sig s${i + 1}" pathLength="1" d="${d}"/>`).join('') +
      '</svg><div class="wf-leds">' + n(14, (i) => `<b style="--i:${i}"></b>`) + '</div>',
  };

  const BOOT = '<p class="wf-boot" aria-hidden="true"><span>[ OK ] CPU Cortex-A76 · 2,4 GHz</span><span>[ OK ] Caméra détectée · IMX708</span><span>[ OK ] Bluetooth · casque connecté</span><span>[ OK ] Détection d\'obstacles prête</span></p>';

  /* ---- décoration d'une fiche fraîchement affichée ---- */
  function decorate() {
    const hero = host.querySelector('.d-hero');
    if (!hero || hero.dataset.wow) return;
    hero.dataset.wow = '1';
    const id = host.dataset.c, ph = hero.querySelector('.d-photo');
    if (ph && FX[id]) ph.insertAdjacentHTML('beforeend', `<div class="wow-fx" aria-hidden="true"><i class="wf-glare"></i>${FX[id]()}</div>`);
    if (id === 'raspberry-pi-5') { const t = hero.querySelector('.d-tag'); if (t) t.insertAdjacentHTML('afterend', BOOT); }

    // titre découpé en lettres (animation individuelle) — le texte reste lisible par les lecteurs d'écran
    const t = hero.querySelector('.d-title');
    if (t) {
      const txt = t.textContent; let k = 0;
      t.setAttribute('aria-label', txt);
      t.innerHTML = txt.split(' ').map((w) => `<span class="wow-w" aria-hidden="true">${[...w].map((ch) => `<span class="wl" style="--k:${k++}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
    }

    // index d'apparition en cascade
    host.querySelectorAll('.d-list,.gallery,.parts,.d-badges').forEach((l) => [...l.children].forEach((e, i) => e.style.setProperty('--i', i)));
    host.querySelectorAll('.spec').forEach((l) => [...l.children].forEach((e, i) => e.style.setProperty('--i', i >> 1)));

    if (still) return;
    // parallaxe + reflet qui suivent le pointeur
    hero.addEventListener('pointermove', (e) => {
      const b = hero.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      hero.style.setProperty('--px', (x - .5).toFixed(3)); hero.style.setProperty('--py', (y - .5).toFixed(3));
      hero.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); hero.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--px', 0); hero.style.setProperty('--py', 0); });

    // caméra : timecode vivant
    const tc = hero.querySelector('.tc');
    if (tc) {
      const t0 = performance.now(), p = (v) => String(v).padStart(2, '0');
      const iv = setInterval(() => {
        if (!tc.isConnected) return clearInterval(iv);
        const s = (performance.now() - t0) / 1000;
        tc.textContent = `00:${p((s / 60) | 0)}:${p(s % 60 | 0)}:${p(((s % 1) * 24) | 0)}`;
      }, 80);
    }
  }

  /* ---- barre de progression de lecture (couleur du composant) ---- */
  const bar = document.createElement('div');
  bar.id = 'wowBar'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const sync = () => {
    const on = host.classList.contains('active');
    bar.classList.toggle('on', on);
    if (!on) return;
    bar.style.setProperty('--p', (scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4));
    host.style.setProperty('--sy', Math.min(scrollY, 600) + 'px');
  };
  addEventListener('scroll', sync, { passive: true });
  addEventListener('hashchange', () => setTimeout(sync, 60));

  new MutationObserver(() => {
    decorate();
    const cs = getComputedStyle(host);
    bar.style.setProperty('--c1', cs.getPropertyValue('--c1')); bar.style.setProperty('--c2', cs.getPropertyValue('--c2'));
    sync();
  }).observe(host, { childList: true });
  decorate();
})();
