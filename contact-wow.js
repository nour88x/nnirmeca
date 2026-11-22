/* VisionGuide maj24 — Onglet Contact : habillage dynamique (version sobre).
   Fichier AJOUTÉ. app.js n'est PAS modifié : l'envoi réel (POST /api/contact) reste géré par app.js.
   Ajoute : sujets rapides, compteur de caractères, copie des coordonnées, projecteur sous le pointeur,
   écran de succès (il observe #contactMsg, que app.js remplit après l'envoi). */
(() => {
  const root = document.getElementById('contact');
  if (!root) return;
  const form = root.querySelector('#contactForm'), card = root.querySelector('#ctCard'), msg = root.querySelector('#contactMsg');
  const ta = form.elements.message, btn = form.querySelector('.ct-btn');

  /* compteur de caractères */
  const count = root.querySelector('.cf-count b');
  const upd = () => { count.textContent = ta.value.length; count.parentElement.classList.toggle('hot', ta.value.length > 1800); };
  ta.addEventListener('input', upd);

  /* sujets rapides : pré-remplissent le message sans jamais écraser ce que la personne a écrit */
  let tpl = '';
  root.querySelectorAll('.ct-topics button').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('.ct-topics button').forEach((x) => x.classList.toggle('on', x === b));
    if (!ta.value.trim() || ta.value === tpl) { ta.value = tpl = b.dataset.t; ta.dispatchEvent(new Event('input')); }
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }));

  /* copier e-mail / téléphone / adresse */
  root.querySelectorAll('.ct-copy').forEach((c) => c.addEventListener('click', async () => {
    const t = c.dataset.copy;
    try { await navigator.clipboard.writeText(t); }
    catch { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); } catch {} x.remove(); }
    c.classList.add('ok'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('ok'), 1700);
  }));

  /* projecteur lumineux sur les cartes (souris uniquement) */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    root.querySelectorAll('.ct-ch').forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
  }

  /* envoi : on bloque le bouton le temps de la requête (faite par app.js) */
  form.addEventListener('submit', () => { btn.disabled = true; msg.textContent = ''; });

  /* résultat : app.js écrit dans #contactMsg → succès (✓) ou erreur */
  new MutationObserver(() => {
    const t = msg.textContent.trim();
    if (!t) return;
    btn.disabled = false;
    if (t.startsWith('✓')) {
      msg.textContent = '';
      upd(); tpl = '';
      root.querySelectorAll('.ct-topics button').forEach((x) => x.classList.remove('on'));
      card.classList.add('sent');
    } else { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
  }).observe(msg, { childList: true, characterData: true, subtree: true });

  root.querySelector('#ctAgain').addEventListener('click', () => { card.classList.remove('sent'); form.elements.name.focus(); });
  card.addEventListener('animationend', (e) => { if (e.animationName === 'shake') card.classList.remove('shake'); });
})();
