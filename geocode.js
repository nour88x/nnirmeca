// geocode.js : transforme la position GPS (Traccar Client) en « lieu · village · ville », façon Google Maps.
//
// Principe (une seule logique, appliquée à chaque nouvelle position) :
//   1. LIEU NOMMÉ  : un lieu (faculté, école, mosquée, magasin...) est retenu s'il est à moins de quelques mètres
//                    du point (rayon adapté à la précision GPS), ou si le point est À L'INTÉRIEUR de son terrain
//                    (campus, hôpital...). Le plus proche gagne.
//   2. VILLAGE     : on cherche le village / hameau / quartier qui CONTIENT le point (polygone OpenStreetMap).
//                    S'il n'y en a pas, on prend le plus proche et on le signale (nearest = true + distance),
//                    l'affichage dit alors « village le plus proche : X (à 800 m) ».
//   3. RUE + VILLE : géocodage inverse Nominatim (rue et commune).
//
// Services : Overpass (lieux et villages, gratuit) + Nominatim (rue, ville). Les deux sont gratuits, sans clé.
// Si Overpass ne répond pas, on se rabat sur Nominatim seul : le site ne tombe jamais en panne à cause de lui.
//
// Variables d'environnement (toutes optionnelles) :
//     NOMINATIM_URL, NOMINATIM_SEARCH_URL, NOMINATIM_LANG (défaut fr), NOMINATIM_EMAIL
//     OVERPASS_URL     défaut : https://overpass-api.de/api/interpreter
//     NEAREST_MAX_M    distance max pour « village le plus proche » (défaut 5000 m)

const URL_BASE = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse';
const SEARCH_URL = process.env.NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const LANG = process.env.NOMINATIM_LANG || 'fr';
const EMAIL = process.env.NOMINATIM_EMAIL || '';
const NEAREST_MAX_M = Number(process.env.NEAREST_MAX_M || 5000);
const MIN_MOVE_M = 40;
const MIN_INTERVAL = 15000;   // par appareil
const MIN_GLOBAL = 1100;      // entre deux requêtes Nominatim (politique : 1 / s)
const USER_AGENT = 'VisionGuide/1.1 (suivi GPS pour malvoyants)';
const LANGS = LANG.split(',').map((s) => s.trim().split(/[-;]/)[0]).filter(Boolean);

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- Noms en français ----------
// OpenStreetMap contient parfois des noms écrits en anglais. On traduit les mots courants (Street -> Rue, Faculty -> Faculté...).
const PHRASES = [
  [/\bFaculty of Sciences? and (?:Technolog(?:y|ies)|Techni(?:ques?|cs))\b/gi, 'Faculté des sciences et techniques'],
  [/\bFaculty of Sciences?\b/gi, 'Faculté des sciences'],
  [/\bFaculty of Medicine\b/gi, 'Faculté de médecine'],
  [/\bFaculty of Law\b/gi, 'Faculté de droit'],
  [/\bFaculty of Arts and Humanities\b/gi, 'Faculté des lettres et sciences humaines'],
  [/\bFaculty of (?:Letters|Literature)\b/gi, 'Faculté des lettres'],
  [/\bFaculty of Economics?\b/gi, "Faculté d'économie"],
  [/\bSchool of (?:Engineering|Technology)\b/gi, "École d'ingénieurs"],
  [/\bCity Hall\b/gi, 'Mairie'], [/\bTown Hall\b/gi, 'Mairie'],
  [/\bPolice Station\b/gi, 'Commissariat'], [/\bFire Station\b/gi, 'Caserne de pompiers'],
  [/\bBus Station\b/gi, 'Gare routière'], [/\bTrain Station\b/gi, 'Gare'],
  [/\bPost Office\b/gi, 'Bureau de poste'], [/\bGas Station\b/gi, 'Station-service'],
];
const WORDS = {
  faculty: 'Faculté', university: 'Université', college: 'Collège', school: 'École', hospital: 'Hôpital', clinic: 'Clinique',
  pharmacy: 'Pharmacie', mosque: 'Mosquée', market: 'Marché', bakery: 'Boulangerie', restaurant: 'Restaurant', bank: 'Banque',
  library: 'Bibliothèque', garden: 'Jardin', park: 'Parc', stadium: 'Stade', street: 'Rue', road: 'Route', avenue: 'Avenue',
  boulevard: 'Boulevard', highway: 'Autoroute', square: 'Place', bridge: 'Pont', district: 'Quartier', neighborhood: 'Quartier',
  neighbourhood: 'Quartier', village: 'Village', city: 'Ville', airport: 'Aéroport', station: 'Gare', hotel: 'Hôtel',
  cemetery: 'Cimetière', museum: 'Musée', center: 'Centre', centre: 'Centre', institute: 'Institut', court: 'Tribunal',
  supermarket: 'Supermarché', cafe: 'Café', mall: 'Centre commercial', gate: 'Porte', palace: 'Palais', mausoleum: 'Mausolée',
  garage: 'Garage', bookstore: 'Librairie', butcher: 'Boucherie', grocery: 'Épicerie',
};
const ENGLISH_ONLY = new Set(['of', 'the', 'and', 'for']);
function frenchify(name) {
  if (!name) return name;
  let t = String(name);
  if (!/[A-Za-z]/.test(t)) return t;                       // écriture arabe : on ne touche pas
  for (const [re, fr] of PHRASES) t = t.replace(re, fr);
  // En anglais le type vient APRÈS le nom (« Hassan II Street », « Cadi Ayyad University ») ; en français, AVANT.
  const TRAIL = { street: 'Rue', road: 'Route', avenue: 'Avenue', boulevard: 'Boulevard', university: 'Université', hospital: 'Hôpital',
    mosque: 'Mosquée', market: 'Marché', park: 'Parc', square: 'Place', garden: 'Jardin', bridge: 'Pont', stadium: 'Stade',
    library: 'Bibliothèque', museum: 'Musée', pharmacy: 'Pharmacie', clinic: 'Clinique', hotel: 'Hôtel', airport: 'Aéroport' };
  t = t.replace(/^(.+?)\s+(Street|Road|Avenue|Boulevard|University|Hospital|Mosque|Market|Park|Square|Garden|Bridge|Stadium|Library|Museum|Pharmacy|Clinic|Hotel|Airport)$/i,
    (m, n, k) => (/[a-zà-ÿ]/i.test(n) && !/^(Rue|Route|Avenue|Boulevard|Place)\b/i.test(n) ? `${TRAIL[k.toLowerCase()]} ${n}` : m));
  t = t.replace(/^(.+?)\s+(Primary|High|Middle|Elementary) School$/i, (m, n, k) => `${{ primary: 'École primaire', elementary: 'École primaire', high: 'Lycée', middle: 'Collège' }[k.toLowerCase()]} ${n}`);
  // mots isolés (seulement s'il reste des mots anglais connus)
  t = t.replace(/\b([A-Za-z]+)\b/g, (w) => WORDS[w.toLowerCase()] || w);
  t = t.replace(/\b(Rue|Route|Avenue|Boulevard|Place|Quartier)\b ([A-Z][^ ]*)/g, '$1 $2');
  return t;
}

// Nom dans la langue préférée, sinon nom local ; un nom anglais est traduit autant que possible
function nameOf(tags) {
  if (!tags) return null;
  for (const l of LANGS) if (tags['name:' + l]) return String(tags['name:' + l]);
  for (const k of ['official_name:fr', 'alt_name:fr', 'short_name:fr']) if (tags[k]) return String(tags[k]);
  if (!tags.name) return null;
  return frenchify(String(tags.name));
}

// Du plus petit (le plus précis) au plus grand
const PLACE_RANK = { neighbourhood: 1, quarter: 1, hamlet: 2, isolated_dwelling: 2, locality: 3, village: 4, suburb: 5, town: 6, city: 7 };
const PLACE_RE = '^(neighbourhood|quarter|hamlet|isolated_dwelling|locality|village|suburb|town|city)$';
const POI_KEY_RE = '^(amenity|leisure|tourism|shop|office|historic|craft)$';
const IGNORED_POI = new Set(['parking', 'bench', 'waste_basket', 'bicycle_parking', 'parking_space', 'parking_entrance', 'shelter',
  'toilets', 'fountain', 'drinking_water', 'post_box', 'atm', 'vending_machine', 'street_lamp', 'taxi', 'bus_station']);

function poiTagOk(t) {
  for (const k of ['amenity', 'leisure', 'tourism', 'shop', 'office', 'historic', 'craft']) {
    if (t[k] && !IGNORED_POI.has(t[k])) return true;
  }
  return false;
}

// Requête Overpass : zones qui contiennent le point + villages proches + lieux nommés tout près
function overpassQuery(lat, lon, poiRadius) {
  return `[out:json][timeout:12];
is_in(${lat},${lon})->.a;
(area.a[place][name]; area.a[name][~"${POI_KEY_RE}"~"."];);
out tags;
node(around:${NEAREST_MAX_M},${lat},${lon})[place~"${PLACE_RE}"][name];
out tags;
nwr(around:${poiRadius},${lat},${lon})[name][~"${POI_KEY_RE}"~"."];
out tags center;`;
}

// Choisit lieu + village à partir des éléments Overpass. Pur (sans réseau) : facile à tester.
function pickFromOverpass(elements, lat, lon, poiRadius) {
  const here = { lat, lon };
  const areas = [], places = [], near = [];
  for (const e of elements || []) {
    const t = e.tags || {};
    if (!nameOf(t)) continue;
    if (e.type === 'area') areas.push(e);
    else if (t.place) places.push(e);
    else near.push(e);
  }

  // --- Lieu nommé ---
  let poi = null;
  const nearby = near.filter((e) => poiTagOk(e.tags)).map((e) => {
    const p = e.type === 'node' ? e : e.center;
    return { name: nameOf(e.tags), d: p ? distanceM(here, { lat: p.lat, lon: p.lon }) : Infinity };
  }).sort((a, b) => a.d - b.d);
  const inside = areas.filter((e) => !e.tags.place && poiTagOk(e.tags)).map((e) => nameOf(e.tags));
  if (nearby[0] && nearby[0].d <= Math.min(20, poiRadius)) poi = nearby[0].name;   // pile dessus
  else if (inside.length) poi = inside[0];                                       // dans l'enceinte (campus, hôpital...)
  else if (nearby[0] && nearby[0].d <= poiRadius) poi = nearby[0].name;            // juste à côté

  // --- Village / quartier ---
  let locality = null, nearest = false, distance = null;
  const containing = areas.filter((e) => e.tags.place && PLACE_RANK[e.tags.place])
    .sort((a, b) => PLACE_RANK[a.tags.place] - PLACE_RANK[b.tags.place]);
  if (containing.length) {
    locality = { name: nameOf(containing[0].tags), kind: containing[0].tags.place };
  } else {
    const cand = places.filter((e) => PLACE_RANK[e.tags.place]).map((e) => ({
      name: nameOf(e.tags), kind: e.tags.place, d: distanceM(here, { lat: e.lat, lon: e.lon }),
    })).sort((a, b) => a.d - b.d)[0];
    if (cand && cand.d <= NEAREST_MAX_M) { locality = { name: cand.name, kind: cand.kind }; nearest = true; distance = Math.round(cand.d); }
  }
  // La commune (ville) ne doit pas être présentée comme « village » si c'est la même chose que la ville
  return { poi, locality, nearest, distance };
}

function parseNominatim(j) {
  const a = (j && j.address) || {};
  const street = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.residential || null;
  const city = a.city || a.town || a.village || a.municipality || a.county || null;
  const district = a.hamlet || a.neighbourhood || a.suburb || a.quarter || a.city_district || null;
  let poi = null;
  if (j && j.name && ['amenity', 'tourism', 'leisure', 'shop', 'office'].includes(j.category)) poi = String(j.name);
  const fr = (v) => (v ? frenchify(v) : v);
  return { street: fr(street), city: fr(city), district: fr(district), poi: fr(poi), raw: j };
}

module.exports = function makeGeocoder() {
  const state = new Map();   // deviceId -> { lat, lon, t, address }
  let lastGlobal = 0;

  async function reserve() {
    const t = Math.max(Date.now(), lastGlobal + MIN_GLOBAL);
    lastGlobal = t;
    if (t > Date.now()) await new Promise((r) => setTimeout(r, t - Date.now()));
  }

  async function reverse(lat, lon) {
    const u = new URL(URL_BASE);
    u.search = new URLSearchParams({
      format: 'jsonv2', lat, lon, zoom: 18, addressdetails: 1, namedetails: 1, 'accept-language': LANG,
      ...(EMAIL ? { email: EMAIL } : {}),
    });
    const r = await fetch(u, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('Nominatim ' + r.status);
    return r.json();
  }

  async function overpass(lat, lon, poiRadius) {
    const r = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
      body: 'data=' + encodeURIComponent(overpassQuery(lat, lon, poiRadius)),
      signal: AbortSignal.timeout(14000),
    });
    if (!r.ok) throw new Error('Overpass ' + r.status);
    return (await r.json()).elements || [];
  }

  async function lookup(lat, lon, accuracy) {
    // Rayon de recherche d'un lieu : suit la précision GPS, entre 25 et 60 m (un GPS à ±100 m ne permet pas d'être affirmatif)
    const poiRadius = Math.min(60, Math.max(25, Number.isFinite(accuracy) ? accuracy : 25));
    const [nomi, ovp] = await Promise.allSettled([
      (async () => { await reserve(); return reverse(lat, lon); })(),
      overpass(lat, lon, poiRadius),
    ]);
    if (nomi.status === 'rejected') console.error('[geocode] Nominatim :', nomi.reason.message);
    if (ovp.status === 'rejected') console.error('[geocode] Overpass :', ovp.reason.message);
    if (nomi.status === 'rejected' && ovp.status === 'rejected') return null;
    return build(nomi.status === 'fulfilled' ? nomi.value : null, ovp.status === 'fulfilled' ? ovp.value : null, lat, lon, poiRadius, accuracy);
  }

  return {
    lookup, searchUrl: SEARCH_URL, userAgent: USER_AGENT, lang: LANG, email: EMAIL, reserve,

    get(deviceId) {
      const s = state.get(deviceId);
      return s && s.address ? { ...s.address, ts: s.addrTs } : null;
    },

    // Appelé à chaque position reçue ; ne bloque jamais la réponse au téléphone.
    maybeUpdate(deviceId, point, onAddress) {
      const now = Date.now();
      const s = state.get(deviceId) || { lat: null, lon: null, t: 0, address: null };
      const moved = s.lat === null || distanceM({ lat: s.lat, lon: s.lon }, { lat: point.lat, lon: point.lng }) >= MIN_MOVE_M;
      if (!moved && s.address) return;
      if (now - s.t < MIN_INTERVAL) return;
      s.t = now;
      state.set(deviceId, s);
      lookup(point.lat, point.lng, point.accuracy).then((address) => {
        if (!address) return;
        s.lat = point.lat; s.lon = point.lng; s.address = address; s.addrTs = Date.now();
        onAddress({ ...address, ts: s.addrTs });
      }).catch((e) => console.error('[geocode]', e.message));
    },
  };
};

// Assemble le résultat final (aussi exporté pour les tests)
function build(nomiJson, elements, lat, lon, poiRadius, accuracy) {
  const n = parseNominatim(nomiJson);
  const o = elements ? pickFromOverpass(elements, lat, lon, poiRadius) : { poi: null, locality: null, nearest: false, distance: null };
  const poi = o.poi || n.poi || null;
  let district = null, nearest = false, distance = null;
  if (o.locality) { district = o.locality.name; nearest = o.nearest; distance = o.distance; }
  else if (n.district) district = n.district;
  const city = n.city && n.city !== district ? n.city : (n.city || null);
  // Pas de doublon « Mrila, Mrila »
  const sameAsCity = district && city && district === city;
  const approx = Number.isFinite(accuracy) && accuracy > 100;

  const head = poi || n.street || null;
  const parts = [];
  if (poi) parts.push(poi);
  if (n.street && !poi) parts.push(n.street);
  if (district) parts.push(nearest ? `village le plus proche : ${district}${distance != null ? ' (à ' + fmtDist(distance) + ')' : ''}` : district);
  if (city && !sameAsCity && !(district && !nearest)) parts.push(city);   // village connu : « Faculté…, Mrila » suffit, comme Google Maps
  let display = parts.join(', ');
  if (!display && nomiJson && nomiJson.display_name) display = String(nomiJson.display_name).split(',').slice(0, 3).join(',').trim();
  if (!display) return null;
  return { poi, street: n.street, district, city: sameAsCity ? null : city, nearest, distance, approx, head, display };
}
function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m'; }

module.exports.pickFromOverpass = pickFromOverpass;
module.exports.build = build;
module.exports.fmtDist = fmtDist;
module.exports.frenchify = frenchify;
module.exports.nameOf = nameOf;
