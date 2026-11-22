/* VisionGuide maj24 — Guide › 02 : panneau « Langue du retour vocal ».
   Fichier AJOUTÉ. Rôle : (1) lancer la démo animée quand le panneau est visible, (2) faire défiler
   jusqu'au panneau depuis la puce du haut de page, (3) halo qui suit le pointeur. */
(() => {
  const lg = document.getElementById('langue');
  if (!lg) return;

  // barres de l'égaliseur (décor)
  const eq = lg.querySelector('.lg-eq');
  if (eq) eq.innerHTML = Array.from({ length: 30 }, (_, i) => `<i style="--i:${i};--h:${28 + ((i * 53 + 17) % 68)}%"></i>`).join('');

  // la démo ne tourne (et ne redémarre au français) que lorsque le panneau est à l'écran
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => lg.classList.toggle('run', e.isIntersecting)), { threshold: 0.35 }).observe(lg);
  } else lg.classList.add('run');

  // puce « Voix en français par défaut… » → défilement doux (sans changer l'adresse : le routage du site n'est pas touché)
  document.querySelectorAll('[data-go="langue"]').forEach((b) => b.addEventListener('click', () => {
    lg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lg.classList.remove('flash'); void lg.offsetWidth; lg.classList.add('flash');
  }));
  lg.addEventListener('animationend', (e) => { if (e.animationName === 'lgFlash') lg.classList.remove('flash'); });

  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    lg.addEventListener('pointermove', (e) => {
      const r = lg.getBoundingClientRect();
      lg.style.setProperty('--mx', (e.clientX - r.left) + 'px'); lg.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
})();
