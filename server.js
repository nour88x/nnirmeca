// Serveur VisionGuide : connexion par code/IP, réception GPS du Raspberry, diffusion en direct
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
// Site hébergé derrière le serveur intermédiaire de l'hébergeur (Render, Railway, nginx...) : définissez
// TRUST_PROXY=1 pour voir la vraie IP des visiteurs. Sans cela, tous les visiteurs partagent la même IP
// et la limite de connexions (8 tentatives / 10 min) bloque tout le monde en même temps.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 h
const HISTORY_MAX = 500;

// Les codes sont relus à chaque connexion : le constructeur peut modifier codes.json sans redémarrer.
const loadCodes = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'codes.json'), 'utf8'));
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const sessions = new Map();   // token -> { deviceId, blindName, followerName, exp }
const locations = new Map();  // deviceId -> { last, history[] }
const streams = new Map();    // deviceId -> Set<res>
const attempts = new Map();   // ip -> { n, reset }
const geocoder = require('./geocode')();  // position -> rue, quartier, ville (voir geocode.js)

// Nombre optionnel envoyé par le Raspberry : null / absent / vide -> null (et non 0)
const optNum = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function tooManyAttempts(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 1, reset: now + 10 * 60 * 1000 }); return false; }
  a.n += 1;
  return a.n > 8;
}

function auth(req, res, next) {
  const token = req.headers['x-token'] || req.query.token;
  const s = sessions.get(token);
  if (!s || s.exp < Date.now()) return res.status(401).json({ error: 'Session expirée' });
  req.session = s;
  next();
}

// --- Connexion ---
app.post('/api/login', (req, res) => {
  if (tooManyAttempts(req.ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }
  const { identifier, blindName, followerName } = req.body || {};
  if (!identifier || !blindName || !followerName) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  const id = String(identifier).trim().toLowerCase();
  const device = loadCodes().find(
    (d) => d.code.toLowerCase() === id || (d.ip && d.ip.toLowerCase() === id)
  );
  if (!device || norm(device.blindName) !== norm(blindName)) {
    return res.status(401).json({ error: 'Code/IP ou nom du malvoyant incorrect.' });
  }
  const token = crypto.randomUUID();
  sessions.set(token, {
    deviceId: device.code,
    blindName: device.blindName,
    followerName: String(followerName).trim().slice(0, 60),
    exp: Date.now() + SESSION_TTL,
  });
  res.json({ token, blindName: device.blindName, followerName: String(followerName).trim().slice(0, 60) });
});

app.post('/api/logout', auth, (req, res) => {
  sessions.delete(req.headers['x-token']);
  res.json({ ok: true });
});

// --- Mémorisation d'un point + diffusion en direct + recherche de la rue (commun aux deux entrées ci-dessous) ---
function ingestPoint(device, f) {
  const point = {
    lat: f.lat, lng: f.lng,
    speed: optNum(f.speed),            // km/h
    battery: optNum(f.battery),        // %
    accuracy: optNum(f.accuracy),      // m
    altitude: optNum(f.altitude),      // m au-dessus du niveau de la mer
    satellites: optNum(f.satellites),  // nombre de satellites utilisés
    src: f.src === 'phone' ? 'phone' : 'pi',   // d'où vient la position : téléphone (Traccar) ou Raspberry
    ts: Date.now(),
  };
  const entry = locations.get(device.code) || { last: null, history: [] };
  entry.last = point;
  entry.history.push(point);
  if (entry.history.length > HISTORY_MAX) entry.history.shift();
  locations.set(device.code, entry);

  const set = streams.get(device.code);
  if (set) for (const r of set) r.write(`data: ${JSON.stringify(point)}\n\n`);

  // Rue + quartier : recherche en arrière-plan, puis envoi aux pages ouvertes (événement "address")
  geocoder.maybeUpdate(device.code, point, (address) => {
    const subs = streams.get(device.code);
    if (subs) for (const r of subs) r.write(`event: address\ndata: ${JSON.stringify(address)}\n\n`);
  });
}

// --- Réception de la position depuis le Raspberry (pfa_gps.py, pfa_gps_telephone.py) ---
app.post('/api/location', (req, res) => {
  const key = req.headers['x-device-key'];
  const device = loadCodes().find((d) => d.deviceKey && d.deviceKey === key);
  if (!device) return res.status(401).json({ error: 'Clé appareil invalide' });

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }
  ingestPoint(device, { lat, lng, speed: req.body.speed, battery: req.body.battery, accuracy: req.body.accuracy, altitude: req.body.altitude, satellites: req.body.satellites });
  res.json({ ok: true });
});

// --- Réception DIRECTE depuis l'application Traccar Client du téléphone (sans le Raspberry) ---
// Adresse à mettre dans Traccar Client :   https://VOTRE-SITE/api/phone-location?key=LA_deviceKey
// Traccar ne sait pas envoyer d'en-tête secret : la clé de l'appareil (deviceKey de codes.json) est donc dans l'adresse.
// Mêmes règles que pfa_gps_telephone.py : formats Traccar (JSON) et OsmAnd (lat / lon), vitesse m/s -> km/h,
// batterie 0..1 -> %, positions de plus de PHONE_MAX_AGE secondes ignorées, et filtre de distance
// (moins de PHONE_MIN_MOVE_M mètres depuis le dernier point : ignoré, sauf un point toutes les PHONE_HEARTBEAT secondes
// pour que le site reste "En ligne").
const PHONE_MAX_AGE = Number(process.env.PHONE_MAX_AGE ?? 120);
const PHONE_MIN_MOVE_M = Number(process.env.PHONE_MIN_MOVE_M ?? 4);
const PHONE_HEARTBEAT = Number(process.env.PHONE_HEARTBEAT ?? 20);
const phoneLast = new Map();      // deviceId -> { lat, lng, t }  (dernier point retenu)
const badKeys = new Map();        // ip -> { n, reset }  (clés fausses seulement)

const num = (v) => (v === null || v === undefined || v === '' || typeof v === 'object' || !Number.isFinite(Number(v)) ? null : Number(v));
function metres(a, b) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function convertPhone(body, query) {
  const src = body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length ? body : query;
  if (!src || typeof src !== 'object') return null;
  let lat, lng, p;
  if (src.location && typeof src.location === 'object') {                    // JSON de Traccar Client
    const loc = src.location, c = loc.coords;
    if (!c || typeof c !== 'object') return null;
    lat = num(c.latitude); lng = num(c.longitude);
    const v = num(c.speed), lvl = loc.battery && typeof loc.battery === 'object' ? num(loc.battery.level) : null;
    const t = Date.parse(loc.timestamp);
    p = { speed: v === null || v < 0 ? null : Math.round(v * 36) / 10, accuracy: num(c.accuracy), altitude: num(c.altitude),
          battery: lvl === null || lvl < 0 ? null : Math.round(lvl * 100), age: Number.isFinite(t) ? (Date.now() - t) / 1000 : null };
  } else if ('lat' in src && ('lon' in src || 'lng' in src)) {              // format OsmAnd
    lat = num(src.lat); lng = num('lon' in src ? src.lon : src.lng);
    const b = num(src.batt);
    p = { speed: null, accuracy: num(src.accuracy), altitude: num(src.altitude), battery: b !== null && b >= 0 && b <= 100 ? Math.round(b) : null, age: null };
  } else return null;
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, ...p };
}

app.all('/api/phone-location', express.urlencoded({ extended: false, limit: '50kb' }), (req, res) => {
  const refuse = (code, msg) => {
    console.log(`[phone-location] refusé ${code} : ${msg} | type=${req.headers['content-type']} | corps=${JSON.stringify(req.body).slice(0, 300)}`);
    return res.status(code).json({ status: 'error', message: msg });
  };
  const key = String(req.query.key || '');
  const device = key && loadCodes().find((d) => d.deviceKey && d.deviceKey === key);
  if (!device) {
    const now = Date.now(), a = badKeys.get(req.ip);
    if (!a || a.reset < now) badKeys.set(req.ip, { n: 1, reset: now + 10 * 60 * 1000 }); else a.n += 1;
    return res.status((badKeys.get(req.ip).n > 30) ? 429 : 401).json({ status: 'error', message: 'Clé appareil invalide' });
  }
  const f = convertPhone(req.body, req.query);
  if (!f) return refuse(400, 'latitude/longitude absentes ou invalides');
  if (PHONE_MAX_AGE && f.age !== null && f.age > PHONE_MAX_AGE) {
    return res.json({ status: 'success', forwarded: false, reason: 'position trop ancienne' });
  }
  const prev = phoneLast.get(device.code);
  if (prev && Date.now() - prev.t < PHONE_HEARTBEAT * 1000 && metres(prev, f) < PHONE_MIN_MOVE_M) {
    return res.json({ status: 'success', forwarded: false, reason: 'sous le seuil' });
  }
  phoneLast.set(device.code, { lat: f.lat, lng: f.lng, t: Date.now() });
  ingestPoint(device, { ...f, src: 'phone' });
  res.json({ status: 'success', forwarded: true });
});

// Vérification rapide depuis le navigateur du téléphone :  https://VOTRE-SITE/api/phone-status?key=LA_deviceKey
// Répond « dernière position reçue il y a X secondes » : permet de savoir si Traccar Client envoie bien au site.
app.get('/api/phone-status', (req, res) => {
  const key = String(req.query.key || '');
  const device = key && loadCodes().find((d) => d.deviceKey && d.deviceKey === key);
  if (!device) return res.status(401).json({ ok: false, message: 'Clé appareil invalide' });
  const last = (locations.get(device.code) || {}).last;
  if (!last) return res.json({ ok: true, received: false, message: 'Clé valide, mais aucune position reçue pour le moment.' });
  res.json({ ok: true, received: true, source: last.src, secondsAgo: Math.round((Date.now() - last.ts) / 1000), lat: last.lat, lng: last.lng, accuracy: last.accuracy, battery: last.battery });
});

// --- Dernière position + historique ---
app.get('/api/location', auth, (req, res) => {
  res.json({ ...(locations.get(req.session.deviceId) || { last: null, history: [] }), address: geocoder.get(req.session.deviceId) });
});

// --- Flux temps réel (Server-Sent Events) ---
app.get('/api/stream', auth, (req, res) => {
  // X-Accel-Buffering : empêche nginx et la plupart des hébergeurs de retenir le flux en direct
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const id = req.session.deviceId;
  if (!streams.has(id)) streams.set(id, new Set());
  streams.get(id).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); streams.get(id)?.delete(res); });
});

// --- Contact ---
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Formulaire incomplet ou e-mail invalide.' });
  }
  const file = path.join(__dirname, 'messages.json');
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  list.push({
    name: String(name).slice(0, 80),
    email: String(email).slice(0, 120),
    message: String(message).slice(0, 2000),
    date: new Date().toISOString(),
  });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
  res.json({ ok: true });
});

// Agent vocal : pont Raspberry -> modèle d'IA gratuit (voir agent-api.js)
require('./agent-api')(app, { loadCodes, locations, geocoder });

app.listen(PORT, () => {
  console.log(`VisionGuide prêt sur http://localhost:${PORT}`);
  // Aide : adresse à saisir dans Traccar Client (champ « Server URL ») quand le téléphone est sur le même réseau que ce PC.
  // La clé est masquée dans les journaux (qui peuvent être lisibles chez l'hébergeur) ; SHOW_KEYS=1 pour l'afficher en entier.
  try {
    const ips = Object.values(require('os').networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    for (const d of loadCodes().filter((x) => x.deviceKey)) {
      const k = process.env.SHOW_KEYS ? d.deviceKey : d.deviceKey.slice(0, 4) + '…';
      for (const ip of ips) console.log(`  Traccar Client (${d.code}) : http://${ip}:${PORT}/api/phone-location?key=${k}`);
    }
  } catch { /* codes.json absent ou illisible : sans importance ici */ }
});
