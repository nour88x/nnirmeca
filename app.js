(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
  };
  let token = store.get('vg_token');
  let user = null;

  /* ---------- Fond animé : particules reliées ---------- */
  (function particles() {
    const c = $('#bg'), x = c.getContext('2d');
    let w, h, pts = [], mouse = { x: -999, y: -999 };
    const resize = () => {
      w = c.width = innerWidth; h = c.height = innerHeight;
      pts = Array.from({ length: Math.min(90, Math.floor(w * h / 18000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      }));
    };
    addEventListener('resize', resize);
    addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    resize();
    (function loop() {
      x.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dm < 130) { p.x += (p.x - mouse.x) * .02; p.y += (p.y - mouse.y) * .02; }
        x.fillStyle = 'rgba(0,229,255,.8)';
        x.beginPath(); x.arc(p.x, p.y, 1.6, 0, 7); x.fill();
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 120) {
          x.strokeStyle = `rgba(124,77,255,${.35 * (1 - d / 120)})`;
          x.beginPath(); x.moveTo(pts[i].x, pts[i].y); x.lineTo(pts[j].x, pts[j].y); x.stroke();
        }
      }
      requestAnimationFrame(loop);
    })();
  })();

  /* ---------- Apparitions au scroll, compteurs, effet tilt ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    const n = $('[data-count]', e.target) || (e.target.dataset.count ? e.target : null);
    if (n && !n.done) { n.done = true; countUp(n); }
    io.unobserve(e.target);
  }), { threshold: .12 });
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  function observeReveals(root = document) {
    $$('.reveal', root).forEach((el, i) => { el.style.transitionDelay = (i % 6) * 70 + 'ms'; io.observe(el); });
  }
  $$('.tilt').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(700px) rotateX(${-py * 10}deg) rotateY(${px * 12}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  /* ---------- Connexion ---------- */
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'x-token': token || '', ...(opts.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'Erreur'), { status: r.status });
    return data;
  };

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr'); err.textContent = '';
    try {
      const d = await api('/api/login', { method: 'POST', body: JSON.stringify({
        identifier: $('#fId').value, blindName: $('#fBlind').value, followerName: $('#fFollower').value,
      }) });
      token = d.token; store.set('vg_token', token);
      user = { blind: d.blindName, follower: d.followerName };
      store.set('vg_user', JSON.stringify(user));
      enterApp();
    } catch (ex) {
      err.textContent = ex.message;
      const card = $('.login-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
  });

  $('#logout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    store.del('vg_token'); store.del('vg_user'); token = null;
    stopStream(); stopDemo();
    location.hash = ''; location.reload();
  });

  function enterApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#whoTxt').textContent = `${user.follower} suit ${user.blind}`;
    $('#gpsLead').textContent = `Position en direct de ${user.blind}.`;
    $('#year').textContent = new Date().getFullYear();
    route();
    observeReveals();
    startStream();
  }

  /* ---------- Onglets ---------- */
  const tabs = ['home', 'guide', 'gps', 'contact'];
  function moveInk() {
    const a = $('#tabs a.active'), ink = $('.ink');
    if (!a) return;
    ink.style.left = a.offsetLeft + 'px'; ink.style.width = a.offsetWidth + 'px';
  }
  function route() {
    const [seg, sub] = location.hash.slice(1).split('/');
    let t = tabs.includes(seg) ? seg : 'home';
    let view = t;
    // Sous-pages du Guide : #composants (page panoramique) et #composant/<id> (fiche détaillée)
    if (seg === 'composants' && window.VGComp) { t = 'guide'; view = 'composants'; VGComp.renderList(); }
    else if (seg === 'utilisation' && window.VGUse) { t = 'guide'; view = 'utilisation'; VGUse.enter(); }
    else if (seg === 'composant' && window.VGComp) {
      if (VGComp.renderDetail(sub)) { t = 'guide'; view = 'composant'; }
      else { location.hash = '#composants'; return; }
    }
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === view));
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === t));
    moveInk();
    scrollTo({ top: 0 });
    if (t === 'gps') initMap();
    $$('.view.active .reveal').forEach((el) => io.observe(el));
  }
  addEventListener('hashchange', () => token && route());
  addEventListener('resize', moveInk);

  /* ---------- Carte GPS (Leaflet + OpenStreetMap) ---------- */
  let map, marker, trail, trailOn = true, last = null, demoTimer = null, es = null;
  function initMap() {
    if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
    map = L.map('map', { zoomControl: true }).setView([48.8566, 2.3522], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
    trail = L.polyline([], { color: '#00e5ff', weight: 5, opacity: .85 }).addTo(map);
    marker = L.marker([48.8566, 2.3522], {
      icon: L.divIcon({ className: '', html: '<div class="pin"><i></i><b></b></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    });
    if (window.__hist) trail.setLatLngs(window.__hist.map((p) => [p.lat, p.lng]));
    if (last) applyPoint(last, true);
    bindAddrTip();
    setTimeout(() => map.invalidateSize(), 80);
  }

  /* ---------- Rue et quartier (reçus du site, trouvés à partir de la position GPS) ---------- */
  let lastAddr = null;
  function bindAddrTip() {
    if (!marker) return;
    marker.unbindTooltip();
    if (!lastAddr) return;
    const el = document.createElement('span');      // textContent : jamais de HTML venant d'un service externe
    el.textContent = lastAddr.poi || lastAddr.street || lastAddr.display;
    marker.bindTooltip(el, { permanent: true, direction: 'top', offset: [0, -14], className: 'addr-tip' });
  }
  function applyAddress(a) {
    if (!a) return;
    lastAddr = a;
    // Ligne 1 : le lieu précis (faculté, école...) sinon la rue. Ligne 2 : rue, village (ou « village le plus proche »), ville.
    const loc = a.district ? (a.nearest ? 'Village le plus proche : ' + a.district + (a.distance != null ? ' (à ' + (a.distance >= 1000 ? (a.distance / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(a.distance / 10) * 10 + ' m') + ')' : '') : a.district) : null;
    $('#vStreet').textContent = a.poi || a.street || a.display || '—';
    $('#vDistrict').textContent = [a.poi ? a.street : null, loc, a.city, a.approx ? 'position approximative' : null].filter(Boolean).join(' · ');
    bindAddrTip();
  }

  function applyPoint(p, first = false) {
    last = p;
    $('#vLat').textContent = p.lat.toFixed(6);
    $('#vLng').textContent = p.lng.toFixed(6);
    $('#vAlt').textContent = p.altitude != null ? Math.round(p.altitude) + ' m' : '—';
    $('#vSpeed').textContent = p.speed != null ? p.speed.toFixed(1) + ' km/h' : '—';
    $('#vAcc').textContent = p.accuracy != null ? '± ' + Math.round(p.accuracy) + ' m' : '—';
    $('#vBat').textContent = p.battery != null ? Math.round(p.battery) + ' %' : '—';
    $('#batBar').style.width = (p.battery ?? 0) + '%';
    $('#gmapsBtn').href = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
    if (map) {
      const ll = [p.lat, p.lng];
      if (!map.hasLayer(marker)) marker.addTo(map);
      marker.setLatLng(ll);
      if (trailOn) trail.addLatLng(ll);
      if (first) map.setView(ll, 17); else map.panTo(ll, { animate: true, duration: 1 });
    }
    refreshStatus();
  }

  function refreshStatus() {
    const chip = $('#status');
    if (!last) { chip.className = 'chip off'; $('b', chip).textContent = 'En attente du dispositif'; $('#vAgo').textContent = '—'; return; }
    const s = Math.round((Date.now() - last.ts) / 1000);
    // Téléphone (Traccar) : à l'arrêt il n'envoie presque plus rien -> on tolère 2 min avant « Hors ligne »
    const on = s < (last.src === 'phone' ? 120 : 30);
    chip.className = 'chip ' + (on ? 'on' : 'off');
    $('b', chip).textContent = on ? 'En ligne' : 'Hors ligne';
    $('#vAgo').textContent = s < 60 ? `il y a ${s} s` : `il y a ${Math.floor(s / 60)} min`;
  }
  setInterval(refreshStatus, 1000);

  $('#centerBtn').addEventListener('click', () => last && map && map.flyTo([last.lat, last.lng], 17, { duration: 1.2 }));
  $('#trailBtn').addEventListener('click', (e) => {
    trailOn = !trailOn;
    e.target.textContent = trailOn ? 'Masquer le trajet' : 'Afficher le trajet';
    if (!trailOn) trail.setLatLngs([]);
  });

  async function startStream() {
    stopStream();
    try {
      const d = await api('/api/location');
      if (d.history?.length) {
        if (map) trail.setLatLngs(d.history.map((p) => [p.lat, p.lng]));
        else window.__hist = d.history;
      }
      if (d.last) applyPoint(d.last, true);
      if (d.address) applyAddress(d.address);
    } catch (e) { if (e.status === 401) return forceLogout(); }
    es = new EventSource('/api/stream?token=' + encodeURIComponent(token));
    es.onmessage = (m) => { if (!demoTimer) applyPoint(JSON.parse(m.data)); };
    es.addEventListener('address', (m) => { if (!demoTimer) applyAddress(JSON.parse(m.data)); });
  }
  function stopStream() { if (es) { es.close(); es = null; } }
  function forceLogout() { store.del('vg_token'); store.del('vg_user'); location.reload(); }

  /* ---------- Mode démo (simule un trajet sans Raspberry) ---------- */
  function stopDemo() { if (demoTimer) { clearInterval(demoTimer); demoTimer = null; } $('#demoBtn').textContent = 'Mode démo'; }
  $('#demoBtn').addEventListener('click', () => {
    if (demoTimer) return stopDemo();
    initMap();
    let lat = 48.8566, lng = 2.3522, a = 0;
    $('#demoBtn').textContent = 'Arrêter la démo';
    if (trail) trail.setLatLngs([]);
    let first = true;
    demoTimer = setInterval(() => {
      a += .22;
      lat += Math.cos(a) * 0.00006; lng += Math.sin(a * .7) * 0.00008;
      applyPoint({ lat, lng, speed: 3.5 + Math.sin(a) * 1.2, accuracy: 6, battery: 78, ts: Date.now() }, first);
      first = false;
    }, 1000);
  });

  /* ---------- Contact ---------- */
  $('#contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, msg = $('#contactMsg');
    try {
      await api('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) });
      msg.textContent = '✓ Message envoyé, merci !'; msg.style.color = '#2dff8f'; f.reset();
    } catch (ex) { msg.textContent = ex.message; msg.style.color = '#ff6b8b'; }
  });

  /* ---------- Reprise de session ---------- */
  (async () => {
    const saved = store.get('vg_user');
    if (token && saved) {
      try { await api('/api/location'); user = JSON.parse(saved); return enterApp(); } catch {}
      store.del('vg_token'); store.del('vg_user'); token = null;
    }
  })();
})();
