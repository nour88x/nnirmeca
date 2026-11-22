// agent-api.js : pont entre le Raspberry et un modèle d'IA GRATUIT, hébergé par le site VisionGuide.
//
// Le Raspberry ne connaît aucune clé d'IA : il envoie seulement sa deviceKey (déjà dans codes.json).
//
// Branchement dans server.js (une seule ligne, juste avant app.listen) :
//     require('./agent-api')(app, { loadCodes, locations, geocoder });
//
// Le modèle est joint par une API "compatible OpenAI" (POST /chat/completions) : Groq, OpenRouter,
// Ollama (local), llama.cpp server... Pour changer de fournisseur, on change seulement ces variables :
//
//     LLM_API_KEY     clé du fournisseur (inutile pour un serveur local comme Ollama)
//     LLM_MODEL       (obligatoire) identifiant du modèle, tel qu'affiché dans la console du fournisseur
//     LLM_BASE_URL    défaut : https://api.groq.com/openai/v1
//                     Ollama sur la même machine : http://localhost:11434/v1
//     LLM_EXTRA_JSON  (optionnel) paramètres ajoutés à la requête, ex : {"reasoning_effort":"low"}
//
// Ce que le site traite lui-même (sans IA, instantané) : où suis-je (rue, quartier, ville), guidage à pied
// (voir navigation.js). Les questions sur le dispositif sont répondues par l'IA à partir du texte de l'onglet
// Guide du site (public/index.html), relu automatiquement s'il change. L'IA répond au reste.
// L'heure, la date et la météo sont désormais traitées directement par le Raspberry (agent_local.py) ; le
// site sait encore les donner en secours.
//
// Fuseau horaire (secours heure/date) : champ "timezone" (nom IANA, ex : "Africa/Casablanca") dans l'entrée
// de l'appareil de codes.json, ou variable AGENT_TIMEZONE.

const fs = require('fs');
const path = require('path');
const makeNavigator = require('./navigation');

const BASE = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || '';
const API_KEY = process.env.LLM_API_KEY || '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.|192\.168\.|10\.)/.test(BASE);
let EXTRA = {};
try { EXTRA = JSON.parse(process.env.LLM_EXTRA_JSON || '{}'); } catch { console.error('[agent] LLM_EXTRA_JSON invalide, ignoré'); }

const WEATHER_URL = process.env.WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = process.env.GEOCODING_API_URL || 'https://geocoding-api.open-meteo.com/v1/search';

const HISTORY_TURNS = 6;              // échanges gardés par appareil (peu : un petit modèle est plus rapide)
const HISTORY_TTL = 30 * 60 * 1000;   // la conversation est oubliée après 30 min
const RATE_MAX = 20;                  // requêtes / minute / appareil
const GPS_MAX_AGE = 10 * 60 * 1000;   // position GPS considérée valide 10 min

const LANG_NAMES = { fr: 'français', en: 'English', ar: 'العربية (arabe)' };
const LOCALES = { fr: 'fr-FR', en: 'en-US', ar: 'ar-MA' };

const WMO = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'heavy freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'heavy freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'violent showers', 85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'severe thunderstorm with hail',
};

// minuscules, sans accents ni voyelles brèves arabes
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '');

const WEATHER_LATIN = /\b(meteo|quel temps|temperature|pleu\w*|pluie|parapluie|weather|forecast|rain|umbrella)\b/;
const WEATHER_AR = /(الطقس|طقس|الجو|الحرارة|المطر|مطر)/;
const isWeatherQuestion = (t) => { const n = norm(t); return WEATHER_LATIN.test(n) || WEATHER_AR.test(n); };

const STOP = new Set(["aujourd'hui", 'aujourd', 'demain', 'maintenant', 'ce', 'cet', 'cette', 'soir', 'matin', 'svp',
  'today', 'tomorrow', 'now', 'tonight', 'this', 'please', 'اليوم', 'غدا', 'الان', 'الآن']);

function cityFrom(raw) {
  const t = norm(raw).replace(/[?!.,;]/g, ' ');
  const m = t.match(/\b(?:a|au|aux|de|du|pour|sur|dans|in|for|at)\s+([a-z'’ -]{3,})/) || t.match(/في\s+([؀-ۿ ]{2,})/);
  if (!m) return null;
  const words = [];
  for (const w of m[1].trim().split(/\s+/)) { if (STOP.has(w)) break; words.push(w); }
  return words.slice(0, 3).join(' ') || null;
}

// ---------- Date et heure : lues sur l'HORLOGE DU SITE, jamais devinées par l'IA ----------
// Fuseau horaire : champ optionnel "timezone" de l'appareil dans codes.json (ex : "Africa/Casablanca"),
// sinon variable AGENT_TIMEZONE, sinon l'heure locale envoyée par le Raspberry (réglée par Internet).
function nowParts(tz, localTime) {
  if (tz) {
    try {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
      return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
    } catch { /* fuseau invalide : on passe au suivant */ }
  }
  const m = String(localTime || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
  const n = new Date();
  return { y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), h: n.getHours(), mi: n.getMinutes() };
}
const asDate = (p) => new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi));
const dayText = (p, lang) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(asDate(p));

function timeSentence(p, lang) {
  const mm = String(p.mi).padStart(2, '0');
  if (lang === 'en') return `It is ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(asDate(p))}.`;
  if (lang === 'ar') {
    const h12 = p.h % 12 || 12, per = p.h < 12 ? 'صباحاً' : 'مساءً';
    return p.mi === 0 ? `الساعة الآن ${h12} تماماً ${per}.` : `الساعة الآن ${h12} و${p.mi} دقيقة ${per}.`;
  }
  const hs = `${p.h} heure${p.h > 1 ? 's' : ''}`;
  return p.mi === 0 ? `Il est ${hs} pile.` : `Il est ${hs} ${mm}.`;
}
const dateSentence = (p, lang) => (lang === 'en' ? 'Today is ' : lang === 'ar' ? 'اليوم ' : 'Nous sommes ') + dayText(p, lang) + '.';

// Questions courtes et sans ambiguïté seulement ("à quelle heure ouvre la pharmacie ?" va à l'IA)
const normI = (s) => norm(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const NOT_TODAY = /\b(demain|hier|tomorrow|yesterday)\b|غدا|امس|بعد غد/;
const TIME_Q = [
  /^(l )?heure( s il (te|vous) plait)?$/, /\bquelle heure (est il|il est|on est)\b/, /\bil est quelle heure\b/, /\b(dis|donne) moi l heure\b/, /\bheure (actuelle|exacte)\b/,
  /\bwhat time is it\b/, /\bwhat s the time\b/, /\bwhat is the time\b/, /\bwhat time do you have\b/, /\bcurrent time\b/, /\btell me the time\b/,
  /(كم الساعة|الساعة كم|كم الوقت|الوقت الان|الساعة الان|ما هي الساعة|ما الوقت)/,
];
const DATE_Q = [
  /\bquel jour (sommes nous|on est|est on|est ce|est il|nous sommes)\b/, /\bon est quel jour\b/, /\bnous sommes quel jour\b/,
  /\bquelle est la date\b/, /\bquelle date (sommes nous|on est|est on|est il)\b/, /\bla date (du jour|d aujourd hui|actuelle)\b/, /\bdate d aujourd hui\b/,
  /\bwhat day is (it|today)\b/, /\bwhat s the date\b/, /\bwhat is the date\b/, /\btoday s date\b/, /\bwhat date is it\b/, /\bwhich day is it\b/,
  /(اي يوم|ما التاريخ|ما هو التاريخ|تاريخ اليوم|كم التاريخ|اي تاريخ)/,
];
function directTimeDate(text) {
  const t = normI(text);
  if (!t || t.split(' ').length > 10 || NOT_TODAY.test(t)) return { time: false, date: false };
  const shortTime = t.split(' ').length <= 3 && /(\bheure\b|\btime\b|الساعة|الوقت)/.test(t) && !/\b(a quelle heure|at what time)\b/.test(t);
  return { time: shortTime || TIME_Q.some((r) => r.test(t)), date: DATE_Q.some((r) => r.test(t)) };
}

// ---------- Guide du dispositif : texte de l'onglet Guide du site ----------
const GUIDE_FILE = path.join(__dirname, 'public', 'index.html');
let guideCache = { mtime: 0, text: '' };
function guideText() {
  try {
    const st = fs.statSync(GUIDE_FILE);
    if (st.mtimeMs !== guideCache.mtime) {
      const html = fs.readFileSync(GUIDE_FILE, 'utf8');
      const parts = ['guide', 'utilisation'].map((id) => (html.match(new RegExp('<section id="' + id + '"[\\s\\S]*?</section>')) || [''])[0]);
      const text = parts.join('\n')
        .replace(/<em>[\s\S]*?<\/em>/g, '')
        .replace(/<\/(h3|summary)>/g, ' : ')
        .replace(/<\/(p|div|details|h2)>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
        .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
      guideCache = { mtime: st.mtimeMs, text };
    }
  } catch { /* fichier absent : on continue sans guide */ }
  return guideCache.text;
}

// ---------- Intentions traitées par le site (texte normalisé : minuscules, sans accents ni ponctuation) ----------
const fold = (s) => normI(s).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const WHERE_Q = [
  /\bou (suis je|je suis|sommes nous)\b/, /\bma (position|localisation|adresse)\b/, /\b(quelle|dans quelle) (rue|ville|quartier)\b.*\b(suis|trouve|sommes)\b/,
  /\bwhere am i\b/, /\bmy (current )?(location|position|address)\b/, /\bwhat (street|city|town|district|neighbou?rhood)\b.*\b(am i|are we|i am)\b/,
  /(اين انا|وين انا|اين اتواجد|اين نحن|موقعي|عنواني|اي شارع)/,
];
const CANCEL_Q = [
  /\b(annul\w*|arret\w*|stop|termin\w*)\b.*\b(guidage|navigation|itineraire|trajet)\b/,
  /\b(cancel|stop|end)\b.*\b(navigation|guidance|guiding|route|directions)\b/,
  /(الغاء|وقف|ايقاف|انهاء).*(التوجيه|الملاحه|المسار|الطريق)/,
];
const PROGRESS_Q = [
  /\b(prochaine (etape|direction|indication|instruction)|dois je (tourner|aller)|ou dois je (aller|tourner|marcher)|quelle direction|il reste combien|combien (de distance )?(reste|il reste)|encore loin|suis je arrive|on est arrive|repete\w*)\b/,
  /\b(next (step|turn|direction|instruction)|which way|how far|how much (is )?left|where (do|should) i (go|turn)|am i there|are we there|repeat)\b/,
  /(الخطوه التاليه|اين اتجه|الى اين|كم بقي|كم تبقى|كم المسافه|هل وصلت|كرر|وين نمشي)/,
];
const NAV_ONLY_Q = [   // ces phrases ne parlent que de guidage : sans trajet en cours, on le dit au lieu de les envoyer à l'IA
  /\b(prochaine (etape|direction|indication|instruction)|dois je tourner)\b/, /\b(next (step|turn|direction|instruction)|which way)\b/, /(الخطوه التاليه|اين اتجه)/,
];
const START_Q = [
  /\b(aller|emmene\w*|conduis\w*|conduisez|guide|guidez|amene\w*|itineraire|chemin|direction|le plus proche|la plus proche|les plus proches|me rendre|rejoindre|marcher vers)\b/, /\bje vais (a|au|aux|vers)\b/,
  /\b(take me|bring me|navigate|directions?|route to|guide me|how (do|can) i (get|go|reach)|(want|need|like) to (go|get|walk)|go to|walk to|nearest|closest|find the way)\b/,
  /(خذني|وجهني|دلني|اريد الذهاب|اريد ان اذهب|اذهب الى|اوصلني|كيف اصل|كيف اذهب|ابغي نمشي|بغيت نمشي|اقرب|الطريق الى|اريد الوصول)/,
];
const anyOf = (list, t) => list.some((r) => r.test(t));

function placeText(a, lang) {
  const { poi, street, district, city, nearest, distance } = a;
  const d = distance != null ? (distance >= 1000 ? (distance / 1000).toFixed(1) + ' km' : Math.round(distance / 10) * 10 + ' m') : '';
  const approx = a.approx;
  if (lang === 'en') {
    const bits = [poi && 'at ' + poi, !poi && street && 'on ' + street, district && (nearest ? 'the nearest village is ' + district + (d ? ', ' + d + ' away' : '') : 'in ' + district), city && 'in ' + city].filter(Boolean);
    return `You are ${bits.join(', ')}.${approx ? ' The GPS position is approximate.' : ''}`;
  }
  if (lang === 'ar') {
    const bits = [poi && 'عند ' + poi, !poi && street && 'في ' + street, district && (nearest ? 'أقرب قرية هي ' + district + (d ? ' على بعد ' + d : '') : 'في ' + district), city && 'في ' + city].filter(Boolean);
    return `أنت ${bits.join('، ')}.${approx ? ' موقع GPS تقريبي.' : ''}`;
  }
  const bits = [poi && 'à ' + poi, !poi && street && 'sur ' + street, district && (nearest ? 'le village le plus proche est ' + district + (d ? ', à ' + d : '') : 'à ' + district), city && 'commune de ' + city].filter(Boolean);
  return `Vous êtes ${bits.join(', ')}.${approx ? ' La position GPS est approximative.' : ''}`;
}
const WHERE_MSG = {
  fr: { noPos: "Je n'ai pas de position GPS récente. Vérifiez que le téléphone envoie sa position.", noAddr: "Je connais votre position GPS, mais je n'ai pas encore trouvé l'adresse. Réessayez dans quelques secondes." },
  en: { noPos: 'I have no recent GPS position. Check that the phone is sending its position.', noAddr: 'I have your GPS position but I have not found the address yet. Try again in a few seconds.' },
  ar: { noPos: 'لا يوجد موقع GPS حديث. تأكد من أن الهاتف يرسل موقعه.', noAddr: 'أعرف موقعك لكنني لم أجد العنوان بعد. حاول بعد ثوان.' },
};

module.exports = function mountAgent(app, { loadCodes, locations, geocoder }) {
  const navigator = makeNavigator(geocoder);
  const histories = new Map();  // deviceId -> { msgs: [{role, content}], ts }
  const rates = new Map();      // deviceId -> { n, reset }

  const rateLimited = (id) => {
    const now = Date.now();
    const r = rates.get(id);
    if (!r || r.reset < now) { rates.set(id, { n: 1, reset: now + 60000 }); return false; }
    return ++r.n > RATE_MAX;
  };

  // ---------- Météo (Open-Meteo : gratuit pour un usage non commercial, sans clé) ----------
  async function getWeather(deviceId, city) {
    try {
      let lat, lon, place;
      if (city) {
        const g = await fetch(`${GEO_URL}?count=1&name=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.json());
        const hit = g.results && g.results[0];
        if (hit) { lat = hit.latitude; lon = hit.longitude; place = hit.name; }
      }
      if (lat === undefined) {                       // pas de ville (ou introuvable) : position GPS du dispositif
        const last = locations.get(deviceId)?.last;
        if (!last || Date.now() - last.ts > GPS_MAX_AGE) {
          return { error: "Position GPS indisponible. Demande à l'utilisateur dans quelle ville il se trouve." };
        }
        lat = last.lat; lon = last.lng; place = 'sa position actuelle';
      }
      const u = new URL(WEATHER_URL);
      u.search = new URLSearchParams({
        latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 1,
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      });
      const j = await fetch(u, { signal: AbortSignal.timeout(6000) }).then((r) => r.json());
      const c = j.current, d = j.daily;
      return {
        place,
        conditions: WMO[c.weather_code] || 'unknown',
        temperature_c: Math.round(c.temperature_2m),
        feels_like_c: Math.round(c.apparent_temperature),
        min_c: Math.round(d.temperature_2m_min[0]),
        max_c: Math.round(d.temperature_2m_max[0]),
        rain_probability_percent: d.precipitation_probability_max[0] ?? 0,
        wind_kmh: Math.round(c.wind_speed_10m),
      };
    } catch (e) {
      return { error: 'Service météo indisponible' };
    }
  }

  // ---------- Appel au modèle (API compatible OpenAI) ----------
  async function callLLM(messages, maxTokens = 400, temperature = 0.3) {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(API_KEY ? { authorization: 'Bearer ' + API_KEY } : {}) },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature, ...EXTRA }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`Modèle ${r.status}`);
    const j = await r.json();
    const raw = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();   // certains modèles montrent leur raisonnement
  }

  const llmReady = () => !!MODEL && (!!API_KEY || IS_LOCAL);

  // Destination demandée : petite question à l'IA, uniquement quand la phrase ressemble à une demande de trajet
  async function extractDestination(text) {
    const sys = 'Extract the place the user wants to walk to from their request. Reply with ONLY the place name, or the place type ' +
      'to search on a map (for example: pharmacie, Gare Casa Voyageurs, mosquée Hassan II), in the language of the request, and nothing else. ' +
      'If the request names no destination, reply NONE.';
    const out = await callLLM([{ role: 'system', content: sys }, { role: 'user', content: text }], 40, 0);
    const d = out.replace(/["«»\n.]/g, '').trim().slice(0, 100);
    return !d || /^none$/i.test(d) ? null : d;
  }

  // GET /api/agent/position : dernière position reçue par le site (le Raspberry s'en sert pour la météo
  // quand le téléphone envoie directement au site et que le Raspberry ne reçoit donc rien lui-même)
  app.get('/api/agent/position', (req, res) => {
    const device = loadCodes().find((d) => d.deviceKey && d.deviceKey === req.headers['x-device-key']);
    if (!device) return res.status(401).json({ error: 'Clé appareil invalide' });
    const last = locations.get(device.code) && locations.get(device.code).last;
    if (!last) return res.status(404).json({ error: 'Aucune position' });
    res.json({ lat: last.lat, lng: last.lng, age: Math.round((Date.now() - last.ts) / 1000) });
  });

  // ---------- Route utilisée par le Raspberry ----------
  // POST /api/agent   en-tête x-device-key
  // corps : { text, lang?: "fr|en|ar", localTime?: ISO }      réponse : { reply, lang, source }
  app.post('/api/agent', async (req, res) => {
    const device = loadCodes().find((d) => d.deviceKey && d.deviceKey === req.headers['x-device-key']);
    if (!device) return res.status(401).json({ error: 'Clé appareil invalide' });
    if (rateLimited(device.code)) return res.status(429).json({ error: 'Trop de requêtes' });

    const text = String((req.body && req.body.text) || '').trim().slice(0, 600);
    if (!text) return res.status(400).json({ error: 'Texte vide' });
    const lang = LANG_NAMES[req.body.lang] ? req.body.lang : 'fr';

    let h = histories.get(device.code);
    if (!h || Date.now() - h.ts > HISTORY_TTL) h = { msgs: [], ts: Date.now() };
    const answer = (reply, source) => {
      h.msgs.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
      h.msgs = h.msgs.slice(-HISTORY_TURNS * 2); h.ts = Date.now(); histories.set(device.code, h);
      return res.json({ reply, lang, source });
    };

    // 1. Heure et date : horloge du site (secours : le Raspberry les donne normalement lui-même)
    const now = nowParts(device.timezone || process.env.AGENT_TIMEZONE, req.body.localTime);
    const direct = directTimeDate(text);
    if (direct.time || direct.date) {
      return answer([direct.time && timeSentence(now, lang), direct.date && dateSentence(now, lang)].filter(Boolean).join(' '), 'site-clock');
    }

    // 2. Localisation et guidage : traités par le site, sans IA (sauf pour comprendre le nom de la destination)
    const t = fold(text);
    const id = device.code;
    const pos = (() => {
      const last = locations.get(id) && locations.get(id).last;
      return last && Date.now() - last.ts < GPS_MAX_AGE ? { lat: last.lat, lon: last.lng } : null;
    })();
    try {
      if (anyOf(WHERE_Q, t)) {
        const a = geocoder && geocoder.get(id);
        return answer(!pos ? WHERE_MSG[lang].noPos : a ? placeText(a, lang) : WHERE_MSG[lang].noAddr, 'site-position');
      }
      if (navigator.has(id) && anyOf(CANCEL_Q, t)) { navigator.cancel(id); return answer(navigator.MSG[lang].cancelled, 'site-nav'); }
      if (navigator.has(id) && anyOf(PROGRESS_Q, t)) {
        return answer(pos ? await navigator.progress(id, lang, pos) : navigator.MSG[lang].noPos, 'site-nav');
      }
      if (!navigator.has(id) && anyOf(NAV_ONLY_Q, t)) return answer(navigator.MSG[lang].none, 'site-nav');
      if (anyOf(START_Q, t) && llmReady()) {
        const dest = await extractDestination(text);
        if (dest) return answer(pos ? await navigator.start(id, dest, lang, pos) : navigator.MSG[lang].noPos, 'site-nav');
        // pas de destination dans la phrase : on laisse l'IA répondre normalement
      }
    } catch (e) {
      console.error('[agent/nav]', e.message);
      return answer(navigator.MSG[lang].offline, 'site-nav');
    }

    // 3. Tout le reste : l'IA, avec le guide du dispositif et la météo éventuelle
    if (!llmReady()) return res.status(503).json({ error: 'Agent non configuré sur le serveur' });
    const guide = guideText();
    const system =
      `Tu es l'assistant vocal du dispositif VisionGuide, porté par ${device.blindName}, une personne malvoyante. ` +
      `Réponds TOUJOURS en ${LANG_NAMES[lang]}. Ta réponse sera lue à voix haute : une à trois phrases courtes, ` +
      `sans markdown, sans liste, sans emoji, sans symboles. Dis les nombres et les unités en toutes lettres. ` +
      `Date et heure locales de l'utilisateur : ${dayText(now, lang)}, ${now.h}:${String(now.mi).padStart(2, '0')}. Pour l'heure ou la date, lis exactement cette information. ` +
      `Pour la météo, utilise uniquement les données fournies entre crochets ; sans données, n'invente jamais la météo. ` +
      `Tu ne vois rien de l'environnement du malvoyant : la détection d'obstacles est gérée par un autre système, ` +
      `ne prétends jamais décrire ce qui l'entoure. Si tu ne sais pas, dis-le.` +
      (guide ? ` Guide officiel du dispositif (onglet Guide du site VisionGuide) :\n${guide}\n` +
        `Pour toute question sur le dispositif (mise en route, charge, port, alertes, GPS, entretien, sécurité), réponds uniquement à partir de ce guide, ` +
        `en le résumant et en le traduisant si besoin ; si l'information n'y figure pas, dis-le et conseille de contacter le constructeur par l'onglet Contact du site.` : '');

    let context = '';
    if (isWeatherQuestion(text)) {
      const w = await getWeather(device.code, cityFrom(text));
      context = `[Données météo réelles à utiliser pour répondre : ${JSON.stringify(w)}]\n`;
    }

    const messages = [{ role: 'system', content: system }, ...h.msgs, { role: 'user', content: context + text }];

    try {
      const reply = await callLLM(messages);
      if (!reply) throw new Error('Réponse vide');
      answer(reply, 'ia');
    } catch (e) {
      console.error('[agent]', e.message);
      res.status(502).json({ error: "L'agent n'a pas pu répondre" });
    }
  });
};
