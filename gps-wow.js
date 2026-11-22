/* VisionGuide maj24 — Onglet GPS : habillage dynamique.
   Fichier AJOUTÉ. app.js n'est PAS modifié : ce script se contente d'observer les champs que app.js remplit
   déjà (#vLat, #vLng, #vSpeed, #vBat, #vAcc, #status, #demoBtn) et en tire : jauges, boussole (cap calculé
   à partir de deux positions successives), niveau de précision, distance parcourue pendant la session. */
(() => {
  const g = document.getElementById('gps');
  if (!g) return;
  const $ = (s) => g.querySelector(s);
  const el = {
    lat: $('#vLat'), lng: $('#vLng'), spd: $('#vSpeed'), bat: $('#vBat'), acc: $('#vAcc'), dist: $('#vDist'),
    status: $('#status'), demo: $('#demoBtn'), panel: $('.panel'),
    spArc: $('#spArc'), spDot: $('#spDot'), spMax: $('#spMax'), batArc: $('#batArc'),
    accTile: $('#tileAcc'), compass: $('#hudCompass'), dir: $('#hudDir'), coord: $('#hudCoord'), ecg: $('.ecg-box'),
  };
  const num = (t) => { const m = String(t || '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const watch = (node, fn, opts) => { if (node) new MutationObserver(fn).observe(node, opts || { childList: true, characterData: true, subtree: true }); };
  const flash = (node) => { const t = node && node.closest('.tile'); if (!t) return; t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); };

  /* ---- état de la liaison : EN DIRECT / HORS LIGNE (pilote le HUD, le radar et le rythme cardiaque) ---- */
  const syncLive = () => { g.dataset.live = el.status && el.status.classList.contains('on') ? '1' : '0'; };
  watch(el.status, syncLive, { attributes: true, attributeFilter: ['class'] });
  syncLive();
  watch(el.demo, () => { el.demo.dataset.run = /arrêter/i.test(el.demo.textContent) ? '1' : '0'; });

  /* ---- vitesse : jauge en demi-cercle (échelle adaptée : 12 / 30 / 120 km/h) ---- */
  const ARC = 157.08;
  const drawSpeed = () => {
    const v = num(el.spd.textContent), ok = !isNaN(v);
    const max = !ok || v <= 12 ? 12 : v <= 30 ? 30 : 120;
    const p = ok ? Math.min(1, Math.max(0, v / max)) : 0;
    el.spArc.style.strokeDashoffset = ARC * (1 - p);
    el.spDot.style.transform = `rotate(${180 * p}deg)`;
    el.spMax.textContent = max;
  };
  watch(el.spd, drawSpeed); drawSpeed();

  /* ---- batterie : anneau + couleur selon le niveau ---- */
  const RING = 263.9;
  const drawBat = () => {
    const v = num(el.bat.textContent), ok = !isNaN(v);
    const p = ok ? Math.min(1, Math.max(0, v / 100)) : 0;
    el.batArc.style.strokeDashoffset = RING * (1 - p);
    el.panel.dataset.bat = !ok ? 'ok' : v < 20 ? 'low' : v < 50 ? 'mid' : 'ok';
  };
  watch(el.bat, drawBat); drawBat();

  /* ---- précision : 4 barres de signal (≤ 8 m = excellent) ---- */
  const drawAcc = () => {
    const m = num(el.acc.textContent);
    el.accTile.dataset.lv = isNaN(m) ? '0' : m <= 8 ? '4' : m <= 20 ? '3' : m <= 50 ? '2' : '1';
  };
  watch(el.acc, drawAcc); drawAcc();

  /* ---- position : cap, distance, coordonnées du HUD, impulsions ---- */
  const rad = Math.PI / 180;
  const meters = (a, b) => {
    const dLa = (b.lat - a.lat) * rad, dLo = (b.lng - a.lng) * rad;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(h));
  };
  const bearing = (a, b) => {
    const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  };
  const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  let prev = null, total = 0, shown = 0, queued = false;

  const onPoint = () => {
    queued = false;
    const p = { lat: parseFloat(el.lat.textContent), lng: parseFloat(el.lng.textContent) };
    if (isNaN(p.lat) || isNaN(p.lng)) return;
    el.coord.textContent = p.lat.toFixed(4) + '° ' + p.lng.toFixed(4) + '°';
    flash(el.lat); flash(el.lng);
    el.ecg.classList.remove('beat'); void el.ecg.offsetWidth; el.ecg.classList.add('beat');
    if (prev) {
      const d = meters(prev, p);
      if (d >= 1000) prev = p;                         // saut (démo, reprise après coupure) : on repart d'ici sans compter la distance
      else if (d > 1.5) {
        total += d;
        const b = bearing(prev, p);
        const diff = ((b - shown) % 360 + 540) % 360 - 180;   // rotation par le chemin le plus court
        shown += diff;
        el.compass.style.setProperty('--hd', shown + 'deg');
        el.dir.textContent = CARD[Math.round(b / 45) % 8] + ' ' + Math.round(b) + '°';
        el.dist.textContent = total < 1000 ? Math.round(total) + ' m' : (total / 1000).toFixed(2).replace('.', ',') + ' km';
        flash(el.dist);
        prev = p;
      }
    } else prev = p;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(onPoint); } };
  watch(el.lat, queue); watch(el.lng, queue);
})();
