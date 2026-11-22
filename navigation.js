// navigation.js : guidage à pied pour l'agent vocal (destination -> itinéraire -> instructions parlées).
//
// Méthode (100 % gratuite, sans compte Google) :
//   1. destination  : recherche dans OpenStreetMap (Nominatim), centrée sur la position actuelle, on garde
//                     le résultat le plus proche  ("la pharmacie la plus proche", "gare de Casa Voyageurs"...)
//   2. itinéraire   : moteur piéton Valhalla (OpenStreetMap)
//   3. instructions : fabriquées ici en français / anglais / arabe à partir des types de manœuvre,
//                     puis recalculées à partir de la position GPS reçue du Raspberry à chaque question.
//
// Le guidage se fait À LA DEMANDE ("prochaine étape ?") : pendant la marche, la détection d'obstacles (PFA)
// continue de tourner, l'agent ne la gèle que le temps d'une question. Rien n'est dit sans que la personne ne demande.
//
// Variables d'environnement (optionnelles) :
//     VALHALLA_URL    défaut : https://valhalla1.openstreetmap.de/route   (instance publique, usage modéré ;
//                     pour un usage intensif, installez votre propre Valhalla et changez cette adresse)
//     NAV_MAX_KM      distance maximale à pied acceptée (défaut 15)
//     NAV_OFF_ROUTE_M écart au trajet qui déclenche un nouveau calcul (défaut 40)

const VALHALLA = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de/route';
const MAX_KM = Number(process.env.NAV_MAX_KM) || 15;
const OFF_ROUTE_M = Number(process.env.NAV_OFF_ROUTE_M) || 40;
const ARRIVED_M = 20;
const ROUTE_TTL = 3 * 60 * 60 * 1000;

// ---------- Géométrie ----------
const RAD = Math.PI / 180;
function haversine(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Polyline encodée (Valhalla : précision 6) -> [{lat, lon}]
function decodePolyline(str, precision = 6) {
  const f = 10 ** precision;
  let i = 0, lat = 0, lon = 0;
  const out = [];
  const next = () => {
    let b, shift = 0, res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32 && i <= str.length);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < str.length) { lat += next(); lon += next(); out.push({ lat: lat / f, lon: lon / f }); }
  return out;
}

// Point du trajet le plus proche de p : distance parcourue sur le trajet (s) et écart au trajet (off), en mètres
function nearestOnRoute(shape, cum, p) {
  const k = Math.cos(p.lat * RAD) * 111320, kLat = 110540;
  let best = { off: Infinity, s: 0 };
  for (let i = 0; i < shape.length - 1; i++) {
    const ax = (shape[i].lon - p.lon) * k, ay = (shape[i].lat - p.lat) * kLat;
    const bx = (shape[i + 1].lon - p.lon) * k, by = (shape[i + 1].lat - p.lat) * kLat;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.off) best = { off, s: cum[i] + t * (cum[i + 1] - cum[i]) };
  }
  return best;
}

// ---------- Phrases (français / anglais / arabe) ----------
const ACT = {
  fr: { start: 'Commencez à marcher', straight: 'Continuez tout droit', right: 'Tournez à droite', left: 'Tournez à gauche',
        slr: 'Tournez légèrement à droite', sll: 'Tournez légèrement à gauche', shr: 'Tournez franchement à droite', shl: 'Tournez franchement à gauche',
        uturn: 'Faites demi-tour', round: 'Prenez le rond-point', dest: 'Vous êtes arrivé à destination',
        dest_r: 'Vous êtes arrivé, la destination est à votre droite', dest_l: 'Vous êtes arrivé, la destination est à votre gauche', onto: ' sur ' },
  en: { start: 'Start walking', straight: 'Continue straight', right: 'Turn right', left: 'Turn left',
        slr: 'Turn slightly right', sll: 'Turn slightly left', shr: 'Turn sharp right', shl: 'Turn sharp left',
        uturn: 'Make a U-turn', round: 'Take the roundabout', dest: 'You have arrived at your destination',
        dest_r: 'You have arrived, the destination is on your right', dest_l: 'You have arrived, the destination is on your left', onto: ' onto ' },
  ar: { start: 'ابدأ المشي', straight: 'تابع بشكل مستقيم', right: 'انعطف يميناً', left: 'انعطف يساراً',
        slr: 'انعطف قليلاً إلى اليمين', sll: 'انعطف قليلاً إلى اليسار', shr: 'انعطف بحدة إلى اليمين', shl: 'انعطف بحدة إلى اليسار',
        uturn: 'قم بالاستدارة', round: 'ادخل الدوار', dest: 'لقد وصلت إلى وجهتك',
        dest_r: 'لقد وصلت، الوجهة على يمينك', dest_l: 'لقد وصلت، الوجهة على يسارك', onto: ' إلى ' },
};

// Types de manœuvre Valhalla -> clé de phrase
const TYPE = {};
[[1, 'start'], [2, 'start'], [3, 'start'], [4, 'dest'], [5, 'dest_r'], [6, 'dest_l'],
  [7, 'straight'], [8, 'straight'], [9, 'slr'], [10, 'right'], [11, 'shr'], [12, 'uturn'], [13, 'uturn'],
  [14, 'shl'], [15, 'left'], [16, 'sll'], [17, 'straight'], [18, 'right'], [19, 'left'], [20, 'right'], [21, 'left'],
  [22, 'straight'], [23, 'right'], [24, 'left'], [25, 'straight'], [26, 'round'], [27, 'straight']].forEach(([t, k]) => { TYPE[t] = k; });
const isDest = (key) => key === 'dest' || key === 'dest_r' || key === 'dest_l';

function distText(m, lang) {
  if (m < 1000) {
    const r = m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
    return lang === 'fr' ? `${r} mètres` : lang === 'en' ? `${r} meters` : `${r} متر`;
  }
  const k = Math.round(m / 100) / 10;
  if (lang === 'fr') return `${String(k).replace('.', ',')} kilomètre${k >= 2 ? 's' : ''}`;
  if (lang === 'en') return `${k} kilometer${k > 1 ? 's' : ''}`;
  return `${k} كيلومتر`;
}
const minText = (s, lang) => {
  const n = Math.max(1, Math.round(s / 60));
  const ar = n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتين' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
  return lang === 'fr' ? `environ ${n} minute${n > 1 ? 's' : ''} à pied` : lang === 'en' ? `about ${n} minute${n > 1 ? 's' : ''} on foot` : `حوالي ${ar} سيراً`;
};

function actionText(man, lang) {
  const a = ACT[lang], key = TYPE[man.type] || 'straight';
  const street = (man.street_names && man.street_names[0]) || '';
  return { key, text: a[key] + (street && !isDest(key) ? a.onto + street : '') };
}

function stepSentence(man, d, lang) {
  const { key, text } = actionText(man, lang);
  const lead = lang === 'fr' ? 'Dans ' : lang === 'en' ? 'In ' : 'بعد ';
  if (d < 15) return text + '.';
  return `${lead}${distText(d, lang)}${lang === 'ar' ? '،' : ','} ${text.charAt(0).toLowerCase() + text.slice(1)}.`;
}

const MSG = {
  fr: { noPos: "Je n'ai pas de position GPS récente. Vérifiez que le téléphone envoie sa position.",
        notFound: (q) => `Je n'ai trouvé aucun lieu correspondant à ${q} près de vous.`,
        noRoute: "Je n'ai pas trouvé d'itinéraire à pied.", tooFar: (d) => `C'est trop loin pour y aller à pied : ${d}.`,
        offline: "Je n'arrive pas à calculer l'itinéraire en ce moment. Réessayez dans un instant.",
        none: "Aucun guidage n'est en cours. Dites-moi où vous voulez aller.", cancelled: 'Guidage annulé.',
        guide: (name, d, t) => `Je vous guide vers ${name}, à ${d}, ${t}.`, rest: (d) => `Il reste ${d} au total.`,
        recalc: 'Vous vous êtes écarté du trajet, je recalcule.', arrived: 'Vous êtes arrivé à destination. Guidage terminé.',
        noDest: "Je n'ai pas compris où vous voulez aller. Pouvez-vous répéter le nom du lieu ?" },
  en: { noPos: 'I have no recent GPS position. Check that the phone is sending its position.',
        notFound: (q) => `I could not find any place matching ${q} near you.`,
        noRoute: 'I could not find a walking route.', tooFar: (d) => `That is too far to walk: ${d}.`,
        offline: 'I cannot compute the route right now. Please try again in a moment.',
        none: 'No guidance is in progress. Tell me where you want to go.', cancelled: 'Guidance cancelled.',
        guide: (name, d, t) => `I am guiding you to ${name}, ${d} away, ${t}.`, rest: (d) => `${d} left in total.`,
        recalc: 'You left the route, I am recalculating.', arrived: 'You have arrived at your destination. Guidance finished.',
        noDest: 'I did not understand where you want to go. Could you repeat the place name?' },
  ar: { noPos: 'لا يوجد موقع GPS حديث. تأكد من أن الهاتف يرسل موقعه.',
        notFound: (q) => `لم أجد أي مكان يطابق ${q} بالقرب منك.`,
        noRoute: 'لم أجد طريقاً للمشي.', tooFar: (d) => `المكان بعيد جداً للذهاب إليه سيراً: ${d}.`,
        offline: 'لا أستطيع حساب الطريق الآن. حاول مرة أخرى بعد قليل.',
        none: 'لا يوجد توجيه جارٍ. قل لي إلى أين تريد الذهاب.', cancelled: 'تم إلغاء التوجيه.',
        guide: (name, d, t) => `أوجهك إلى ${name}، على بعد ${d}، ${t}.`, rest: (d) => `بقي ${d} في المجموع.`,
        recalc: 'ابتعدت عن المسار، أعيد الحساب.', arrived: 'لقد وصلت إلى وجهتك. انتهى التوجيه.',
        noDest: 'لم أفهم إلى أين تريد الذهاب. هل يمكنك إعادة اسم المكان؟' },
};

// ---------- Module ----------
module.exports = function makeNavigator(geocoder) {
  const routes = new Map();   // deviceId -> { dest, route, ts }

  async function search(query, near) {
    const attempts = [{ bounded: 1, box: 0.1 }, { bounded: 0, box: 0.5 }];   // ~11 km autour, puis plus large
    for (const t of attempts) {
      await geocoder.reserve();
      const u = new URL(geocoder.searchUrl);
      u.search = new URLSearchParams({
        q: query, format: 'jsonv2', limit: 5, 'accept-language': geocoder.lang, bounded: t.bounded,
        viewbox: `${near.lon - t.box},${near.lat + t.box},${near.lon + t.box},${near.lat - t.box}`,
        ...(geocoder.email ? { email: geocoder.email } : {}),
      });
      const r = await fetch(u, { headers: { 'user-agent': geocoder.userAgent }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('Nominatim ' + r.status);
      const list = (await r.json()).filter((x) => Number.isFinite(+x.lat) && Number.isFinite(+x.lon));
      if (list.length) {
        const withD = list.map((x) => ({ x, d: haversine(near, { lat: +x.lat, lon: +x.lon }) })).sort((a, b) => a.d - b.d);
        const x = withD[0].x;
        const name = x.name || String(x.display_name || query).split(',')[0].trim();
        return { name, lat: +x.lat, lon: +x.lon };
      }
    }
    return null;
  }

  async function computeRoute(from, to) {
    const r = await fetch(VALHALLA, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': geocoder.userAgent },
      body: JSON.stringify({
        locations: [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }],
        costing: 'pedestrian', directions_options: { units: 'kilometers', language: 'en-US' },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error('Valhalla ' + r.status);
    const j = await r.json();
    const leg = j.trip && j.trip.status === 0 && j.trip.legs && j.trip.legs[0];
    if (!leg || !leg.shape || !leg.maneuvers || !leg.maneuvers.length) return null;
    const shape = decodePolyline(leg.shape);
    const cum = [0];
    for (let i = 1; i < shape.length; i++) cum.push(cum[i - 1] + haversine(shape[i - 1], shape[i]));
    return { shape, cum, maneuvers: leg.maneuvers, total: cum[cum.length - 1], time: (j.trip.summary && j.trip.summary.time) || 0 };
  }

  // Phrase "dans X mètres, ..." à partir de la position actuelle. Renvoie { text, off, arrived }.
  function describe(route, pos, lang) {
    const near = nearestOnRoute(route.shape, route.cum, pos);
    const remaining = route.total - near.s;
    if (remaining < ARRIVED_M) return { arrived: true, off: near.off };
    const mans = route.maneuvers;
    let n = mans.findIndex((m) => route.cum[Math.min(m.begin_shape_index, route.cum.length - 1)] > near.s + 1);
    if (n < 0) n = mans.length - 1;
    const d = Math.max(0, route.cum[Math.min(mans[n].begin_shape_index, route.cum.length - 1)] - near.s);
    let text = stepSentence(mans[n], d, lang);
    if (!isDest(TYPE[mans[n].type] || '') && remaining > d + 30) text += ' ' + MSG[lang].rest(distText(remaining, lang));
    return { text, off: near.off, remaining };
  }

  const gc = (id) => { const e = routes.get(id); if (e && Date.now() - e.ts > ROUTE_TTL) { routes.delete(id); return null; } return e || null; };

  return {
    MSG,
    has: (id) => !!gc(id),
    cancel(id) { return routes.delete(id); },

    // Nouvelle destination
    async start(id, query, lang, pos) {
      const m = MSG[lang];
      const dest = await search(query, pos);
      if (!dest) return m.notFound(query);
      const route = await computeRoute(pos, dest);
      if (!route) return m.noRoute;
      if (route.total > MAX_KM * 1000) return m.tooFar(distText(route.total, lang));
      routes.set(id, { dest, route, ts: Date.now() });
      const d = describe(route, pos, lang);
      return [m.guide(dest.name, distText(route.total, lang), minText(route.time, lang)), d.arrived ? m.arrived : d.text].join(' ');
    },

    // Prochaine étape, à partir de la position actuelle (recalcule si la personne s'est écartée)
    async progress(id, lang, pos) {
      const m = MSG[lang], e = gc(id);
      if (!e) return m.none;
      let d = describe(e.route, pos, lang), prefix = '';
      if (!d.arrived && d.off > OFF_ROUTE_M) {
        const route = await computeRoute(pos, e.dest);
        if (!route) return m.offline;
        e.route = route; e.ts = Date.now();
        d = describe(route, pos, lang); prefix = m.recalc + ' ';
      }
      if (d.arrived) { routes.delete(id); return m.arrived; }
      e.ts = Date.now();
      return prefix + d.text;
    },
  };
};
module.exports.decodePolyline = decodePolyline;
