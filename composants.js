/* VisionGuide — Guide › 01 Composants du dispositif
   Données + affichage de la page panoramique (#composants) et des pages détail (#composant/<id>).
   Pour modifier un texte ou une image, éditez simplement la liste COMPONENTS ci-dessous. */
(() => {
  const IMG = 'img/';

  const COMPONENTS = [
    /* ------------------------------------------------------------------ GILET */
    {
      id: 'gilet', num: '01', title: 'Gilet', icon: '🦺',
      tag: 'Le support porté : tout le système tient sur la poitrine.',
      shots: [
        { src: 'gilet.jpg', ar: '1/1', left: 50, h: 88, rot: 0, d: 14 },
        { src: 'gilet-produit.jpg', ar: '8/9', left: 24, h: 64, rot: -7, d: 28 },
        { src: 'gilet-porte.jpg', ar: '1.1/1', left: 80, h: 58, rot: 6, d: 24 },
      ],
      hero: 'gilet.jpg', heroFit: 'cover',
      pano: 'pano-gilet.jpg', panoPos: '50% 10%',
      badges: ['Bandes réfléchissantes', 'Filet respirant', 'Sangle ajustable'],
      intro: "Un gilet de course noir, léger et aéré, qui sert de « châssis » au dispositif. Il maintient la caméra à hauteur de poitrine, orientée vers l'avant, et répartit le poids de l'électronique sur le torse plutôt que dans les mains. Ses bandes réfléchissantes rendent aussi l'utilisateur beaucoup plus visible des autres usagers, de jour comme de nuit.",
      specs: [
        ['Type', 'Gilet de course / jogging, coupe près du corps'],
        ['Matière', 'Textile noir + filet aéré sur les épaules et le dos'],
        ['Visibilité', 'Bandes réfléchissantes sur la poitrine et à la taille'],
        ['Réglage', 'Sangle de taille ajustable, bretelles souples'],
        ['Rangement', 'Poche zippée sur la poitrine'],
        ['Position visée', 'Centre de la poitrine, objectif vers l\'avant'],
      ],
      role: [
        'Porte la caméra à une hauteur stable, proche du regard d\'un piéton.',
        'Accueille le Raspberry Pi et la batterie pour un port mains libres.',
        'Rend l\'utilisateur visible grâce aux bandes réfléchissantes.',
      ],
      tips: [
        'Évitez de poser vos mains sur la poitrine, là où se trouve la caméra : vous risqueriez de la recouvrir.',
        'Ne cachez jamais la caméra avec quoi que ce soit (veste, manteau, écharpe, sac, vêtement ample ou autre accessoire) : même partiellement masquée, elle ne voit plus correctement devant vous.',
        'Le système n\'est pas imperméable : en cas de pluie, accompagnez-vous d\'un parapluie pour protéger l\'électronique.',
        'Tenez le parapluie bien droit, sans l\'incliner excessivement vers l\'avant, afin qu\'il ne masque pas le champ de la caméra.',
        'Les composants du dispositif (gilet, Raspberry Pi, caméra, power bank, casque) sont des éléments du fournisseur, fixés tels quels : ne les percez pas, ne les modifiez pas et ne forcez pas sur les fixations ni sur les câbles.',
        'Ne couvrez pas le Raspberry Pi ni la power bank : ils chauffent et ont besoin d\'air. Évitez aussi de les laisser longtemps en plein soleil.',
        'Avant de sortir, vérifiez que l\'objectif est propre et que les câbles sont bien branchés et ne pendent pas.',
      ],
      warn: 'Les bandes réfléchissantes ne doivent jamais être recouvertes par le matériel : elles font partie de la sécurité de l\'utilisateur.',
      gallery: [
        { src: 'pano-gilet.jpg', cap: 'Vue panoramique du gilet' },
        { src: 'gilet.jpg', cap: 'Gilet porté et vue produit' },
        { src: 'gilet-produit.jpg', cap: 'Le gilet seul : filet, poche, sangle de taille' },
        { src: 'gilet-porte.jpg', cap: 'Porté : bandes réfléchissantes sur la poitrine' },
      ],
    },

    /* ------------------------------------------------------------------ RASPBERRY PI 5 */
    {
      id: 'raspberry-pi-5', num: '02', title: 'Raspberry Pi 5 · 8 Go', icon: '🧠',
      tag: 'Le cerveau : il voit, décide et parle.',
      shots: [
        { src: 'pi-carte.jpg', ar: '3/4', left: 50, h: 90, rot: 0, d: 14 },
        { src: 'pi-puce.jpg', ar: '1.6/1', left: 24, h: 44, rot: -7, d: 30 },
        { src: 'pi-boite.jpg', ar: '4/3', left: 80, h: 50, rot: 6, d: 24 },
      ],
      hero: 'pi-carte.jpg', heroFit: 'contain',
      pano: 'pano-pi5.jpg', panoPos: '50% 50%',
      badges: ['Cortex-A76 · 2,4 GHz', '8 Go LPDDR4X', 'Wi-Fi · Bluetooth 5.0'],
      intro: "Le Raspberry Pi 5 est l'ordinateur monocarte qui orchestre tout le dispositif : il lit le flux de la caméra, exécute la détection d'obstacles, génère les messages vocaux, surveille les boutons et envoie la position au site de suivi. Sur la photo, il est installé dans le boîtier officiel rouge et blanc, avec son ventilateur branché sur le connecteur FAN.",
      specs: [
        ['Processeur', 'Broadcom BCM2712, 4 cœurs Arm Cortex-A76 à 2,4 GHz'],
        ['Mémoire', '8 Go LPDDR4X'],
        ['Graphique', 'VideoCore VII, double sortie HDMI 4Kp60 (2 ports HDMI)'],
        ['USB', '2 ports USB 3.0 + 2 ports USB 2.0'],
        ['Réseau', '1 port Gigabit Ethernet, Wi-Fi 802.11ac, Bluetooth 5.0 / BLE'],
        ['Caméra / écran', '2 ports MIPI à 4 voies, caméra ou écran (interchangeables)'],
        ['GPIO', 'Port GPIO à 40 broches, logique 3,3 V'],
        ['Stockage', 'Port carte microSD (mode SDR104) ; interface PCIe 2.0 ×1 pour périphériques rapides (adaptateur M.2 HAT ou autre, vendu séparément)'],
        ['Alimentation', 'Port USB-C, 5 V / 5 A avec Power Delivery ; bloc officiel de 27 W recommandé. Avec un bloc de 3 A, le démarrage USB est désactivé par défaut'],
        ['Refroidissement', 'Port ventilateur à 4 broches (JST-SH 1 mm : +5 V, PWM, GND, tachymètre) ; boîtier officiel avec ventilateur intégré ; refroidissement actif conseillé'],
      ],
      role: [
        'Capture les images de la caméra et exécute la détection d\'obstacles (réseau de type YOLO26 nano et modèle d\'intelligence artificielle Moondream).',
        'Produit l\'audio vocal envoyé au casque Bluetooth.',
        'Lit les boutons branchés sur les broches GPIO.',
      ],
      gallery: [
        { src: 'pano-pi5.jpg', cap: 'Vue panoramique du Raspberry Pi 5 et de son boîtier' },
        { src: 'pi-boitier-officiel.jpg', cap: 'Boîtier officiel du Raspberry Pi 5 (rouge / blanc), avec ventilateur intégré' },
        { src: 'pi-active-cooler.jpg', cap: 'Raspberry Pi 5 avec son Active Cooler (dissipateur + ventilateur)' },
        { src: 'pi-puce.jpg', cap: 'Processeur, mémoire, puce sans fil et GPIO' },
        { src: 'pi-usb.jpg', cap: 'Ports Ethernet et USB (récepteurs sans fil branchés)' },
        { src: 'pi-fan.jpg', cap: 'Ventilateur 5 V 0,18 A, 4 fils, dans le couvercle' },
      ],
    },

    /* ------------------------------------------------------------------ CAMERA MODULE 3 */
    {
      id: 'camera-module-3', num: '03', title: 'Raspberry Pi Camera Module 3', icon: '📷',
      tag: 'Les yeux du dispositif, avec mise au point automatique.',
      shots: [
        { src: 'cam-carte.jpg', ar: '4/3', left: 50, h: 62, rot: 0, d: 14 },
        { src: 'cam-objectif.jpg', ar: '14/15', left: 24, h: 70, rot: -7, d: 30 },
        { src: 'cam-boite.jpg', ar: '4/3', left: 80, h: 50, rot: 6, d: 24 },
      ],
      hero: 'cam-objectif.jpg', heroFit: 'contain',
      pano: 'pano-camera.jpg', panoPos: '50% 50%',
      badges: ['Sony IMX708 · 12 Mpx', 'Autofocus', 'HDR'],
      intro: "Le Camera Module 3 est la caméra officielle Raspberry Pi à objectif motorisé. Son autofocus à détection de phase garde nets les obstacles entre 10 cm et l'infini, ce qui est idéal pour un dispositif porté qui voit à la fois des objets proches et lointains. Elle se branche directement sur un connecteur caméra du Pi 5 par une nappe plate.",
      specs: [
        ['Capteur', 'Sony IMX708, 12 mégapixels'],
        ['Résolution max', '4608 × 2592 pixels'],
        ['Mise au point', 'Autofocus à détection de phase (PDAF), de 10 cm à l\'infini'],
        ['HDR', 'Jusqu\'à 3 mégapixels (2304 × 1296)'],
        ['Vidéo', '1080p50, 720p100, 480p120'],
        ['Champ de vision', 'Environ 66° horizontal, 41° vertical (75° en diagonale), version standard'],
        ['Interface', 'MIPI CSI-2 par nappe flexible'],
        ['Dimensions', 'Environ 25 × 24 mm'],
      ],
      role: [
        'Capture le flux vidéo analysé par le modèle de détection d\'obstacles.',
        'Garde les objets nets à toutes les distances grâce à l\'autofocus.',
        'Reste compacte et légère pour se fixer sur le gilet à hauteur de poitrine.',
      ],
      gallery: [
        { src: 'pano-camera.jpg', cap: 'Vue panoramique du Camera Module 3' },
        { src: 'cam-carte.jpg', cap: 'Module caméra avec sa nappe flexible' },
        { src: 'cam-objectif.jpg', cap: 'Objectif motorisé du Camera Module 3' },
        { src: 'cam-nappe.jpg', cap: 'Nappe plate vers le connecteur CSI du Pi' },
      ],
    },

    /* ------------------------------------------------------------------ POWER BANK */
    {
      id: 'power-bank', num: '04', title: 'Power Bank oraimo 10 000 mAh', icon: '🔋',
      tag: 'L\'énergie portable : le dispositif devient autonome.',
      shots: [
        { src: 'pb-boite.jpg', ar: '3/4', left: 50, h: 90, rot: 0, d: 14 },
        { src: 'pb-face.jpg', ar: '4/3', left: 80, h: 46, rot: 6, d: 26 },
        { src: 'pb-specs.jpg', ar: '3/1', left: 24, h: 28, rot: -6, d: 32 },
      ],
      hero: 'pb-boite.jpg', heroFit: 'contain',
      pano: 'pano-powerbank.jpg', panoPos: '50% 50%',
      badges: ['PowerFlow B11', '10 000 mAh', 'Charge 15 W USB-C'],
      intro: "La batterie externe oraimo PowerFlow B11 (référence OPB-1102) alimente le Raspberry Pi, la caméra et le reste du montage sans prise secteur. Son boîtier fin et strié se glisse facilement dans la poche du gilet. Elle est livrée avec un câble USB-C et une garantie de 365 jours.",
      specs: [
        ['Modèle', 'oraimo PowerFlow B11 (OPB-1102)'],
        ['Capacité', '10 000 mAh'],
        ['Sortie / charge', '• 1 port USB-C bidirectionnel (sert à la fois à recharger la batterie externe et à charger un appareil, jusqu\'à 15 W).\n• 2 ports USB-A (jusqu\'à 15 W chacun).'],
        ['Accessoire', 'Câble USB-C offert'],
        ['Autonomie', 'Offre entre 3,5 et 10,5 heures d\'autonomie selon la charge, mais elle présente des limitations importantes à pleine puissance'],
        ['Énergie estimée', 'Environ 37 Wh (10 000 mAh × 3,7 V)'],
      ],
      role: [
        'Fournit le 5 V USB-C au Raspberry Pi pendant les déplacements.',
        'Se recharge à la maison pendant que le dispositif est rangé.',
      ],
      gallery: [
        { src: 'pano-powerbank.jpg', cap: 'Vue panoramique de la power bank oraimo' },
      ],
    },

    /* ------------------------------------------------------------------ CASQUE */
    {
      id: 'casque-bluetooth', num: '05', title: 'Casque Bluetooth', icon: '🎧',
      tag: 'La voix du dispositif : alertes et guidage à l\'oreille.',
      shots: [
        { src: 'casque.jpg', ar: '3/4', left: 50, h: 90, rot: 0, d: 14 },
        { src: 'casque-coque.jpg', ar: '1/1', left: 24, h: 56, rot: -7, d: 30 },
        { src: 'casque-arceau.jpg', ar: '0.68/1', left: 80, h: 62, rot: 6, d: 24 },
      ],
      hero: 'casque.jpg', heroFit: 'contain',
      pano: 'pano-casque.jpg', panoPos: '50% 50%',
      badges: ['Sans fil', 'Circum-auriculaire', 'Appairage direct au Pi'],
      intro: "Le casque Bluetooth est la sortie audio du système : il diffuse sans fil les annonces vocales (obstacles, direction, langue choisie) générées par le Raspberry Pi. Il saisit également la voix du malvoyant comme entrée du système. Il s'agit d'un casque supra-auriculaire gris métallisé, avec un arceau rembourré en tissu maille et des branches métalliques. Le Pi 5 intègre le Bluetooth 5.0 : aucun adaptateur n'est nécessaire.",
      role: [
        'Il saisit la voix de l\'utilisateur comme entrée.',
        'Restitue la voix de synthèse multilingue (arabe, français, anglais).',
        'Libère l\'utilisateur de tout câble (liaison Bluetooth).',
      ],
      tips: [
        'Chargez le casque avant chaque sortie : il doit tenir plus longtemps que la batterie du Pi.',
        'Assurez-vous de la connexion du casque avant de l\'utiliser (écoutez les annonces « power on » puis « connected »).',
      ],
      gallery: [
        { src: 'pano-casque.jpg', cap: 'Vue panoramique du casque Bluetooth' },
        { src: 'casque.jpg', cap: 'Casque Bluetooth, vue d\'ensemble' },
        { src: 'casque-ports.jpg', cap: 'Port USB-C et prise jack 3,5 mm de la coque' },
        { src: 'casque-boutons.jpg', cap: 'Boutons +, − et marche/arrêt de la coque' },
      ],
    },

    /* ------------------------------------------------------------------ COMMANDE & CONNEXION */
    {
      id: 'commande-connexion', num: '06', title: 'Éléments de commande et de connexion', icon: '🎛️',
      sub: 'Boutons poussoirs · Fils de connexion · Plaque d\'essai',
      tag: 'Boutons poussoirs, fils et plaque d\'essai : le lien entre l\'humain et la carte.',
      shots: [
        { src: 'pano-commande.jpg', ar: '2.36/1', left: 50, h: 70, rot: 0, d: 14 },
        { src: 'photo-bouton.jpg', ar: '2.36/1', left: 24, h: 40, rot: -7, d: 30 },
        { src: 'photo-fils.jpg', ar: '2.36/1', left: 80, h: 40, rot: 6, d: 24 },
      ],
      hero: 'pano-commande.jpg', heroFit: 'contain',
      pano: 'pano-commande.jpg', panoPos: '50% 50%',
      badges: ['Boutons poussoirs', 'Fils Dupont', 'Breadboard'],
      intro: "Ce sont les petits éléments qui rendent le dispositif pilotable : les boutons poussoirs permettent à l'utilisateur de commander le système sans écran (par exemple choisir la langue), les fils de connexion relient les boutons aux broches GPIO du Raspberry Pi, et la plaque d'essai (breadboard) permet de monter et de modifier le circuit sans soudure.",
      parts: [
        { title: 'Boutons poussoirs', img: 'photo-bouton.jpg', text: '2 boutons poussoirs sont utilisés : celui du dessus change la langue à chaque clic, dans l\'ordre français, anglais, arabe ; celui du dessous appelle le modèle d\'intelligence artificielle pour donner des descriptions détaillées de l\'environnement.' },
        { title: 'Fils de connexion', img: 'photo-fils.jpg', text: 'Fils « Dupont » à embouts mâles ou femelles. Les femelles se plantent sur les broches du Pi, les mâles dans la plaque d\'essai.' },
        { title: 'Plaque d\'essai', img: 'photo-plaque.jpg', text: 'Plaque à trous reliés par rangées, avec rails d\'alimentation rouge et bleu sur les bords. Elle permet de tester un montage avant de le figer, sans soudure.' },
      ],
      specs: [
        ['Boutons', 'Poussoirs tactiles, contact normalement ouvert'],
        ['Fils', 'Dupont mâle-mâle, mâle-femelle ou femelle-femelle'],
        ['Plaque', 'Breadboard sans soudure avec rails d\'alimentation'],
        ['Niveau logique GPIO', '3,3 V (jamais de 5 V sur une broche GPIO)'],
        ['Câblage d\'un bouton', 'GPIO ↔ bouton ↔ GND, avec résistance de tirage interne'],
      ],
      role: [
        'Permettent de commander le système sans écran : choix de la langue, activation/désactivation du modèle d\'intelligence artificielle.',
        'Relient physiquement les boutons aux broches GPIO du Raspberry Pi 5.',
      ],
      gallery: [
        { src: 'pano-commande.jpg', cap: 'Vue panoramique : plaque d\'essai, boutons poussoirs et fils de connexion' },
        { src: 'photo-bouton.jpg', cap: 'Bouton poussoir tactile' },
        { src: 'photo-fils.jpg', cap: 'Fils de connexion mâle-mâle, rouge et bleu' },
        { src: 'photo-plaque.jpg', cap: 'Plaque d\'essai 830 points, rails +/−' },
      ],
    },
  ];

  const byId = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Page panoramique (liste des composants) ---------- */
  function renderList() {
    const host = $('#panoList');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.innerHTML = COMPONENTS.map((c, i) => {
      const full = !!c.pano;
      const shots = full ? '' : c.shots.map((s, k) =>
        `<img class="shot s${k}" src="${IMG + s.src}" alt="" loading="lazy" style="--ar:${s.ar};--l:${s.left}%;--h:${s.h}%;--rot:${s.rot}deg;--d:${s.d}">`
      ).join('');
      const node = i < COMPONENTS.length - 1 ? '<div class="pano-node" aria-hidden="true"><i></i></div>' : '';
      return `
        <div class="pano-item reveal">
          <a class="pano${full ? ' full' : (i % 2 ? ' flip' : '')}" href="#composant/${c.id}" aria-label="${esc(c.title)} : voir en détail">
            ${full
              ? `<span class="photo"><img src="${IMG + c.pano}" alt="" loading="lazy" style="object-position:${c.panoPos}"></span>`
              : `<span class="bg" style="background-image:url('${IMG + c.shots[0].src}')"></span>`}
            <span class="veil"></span>
            <span class="grid-fx"></span>
            ${full ? '' : `<span class="stack">${shots}</span>`}
            <span class="copy">
              <span class="num">${c.num}</span>
              <h3>${esc(c.title)}</h3>
              <p>${esc(c.tag)}</p>
              <span class="more">Découvrir en détail <b>→</b></span>
            </span>
            <i class="sheen"></i>
          </a>
        </div>${node}`;
    }).join('');

    // parallaxe au survol (les photos flottent à des profondeurs différentes)
    host.querySelectorAll('.pano').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5) * 2);
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5) * 2);
      });
      el.addEventListener('mouseleave', () => { el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0); });
    });
  }

  /* ---------- Page détail d'un composant ---------- */
  function renderDetail(id) {
    const c = byId[id];
    const host = $('#composant');
    if (!c) return false;
    const i = COMPONENTS.indexOf(c);
    const prev = COMPONENTS[(i + COMPONENTS.length - 1) % COMPONENTS.length];
    const next = COMPONENTS[(i + 1) % COMPONENTS.length];
    const list = (arr) => `<ul class="d-list">${arr.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

    host.dataset.c = c.id; // chaque composant a son propre univers visuel (voir style.css)
    host.dataset.c = c.id; // chaque composant a son propre univers visuel (voir style.css)
    host.innerHTML = `
      <a class="back-link reveal" href="#composants">← Composants du dispositif</a>

      <header class="d-hero reveal${c.pano ? ' full' : ''}">
        ${c.pano
          ? `<div class="d-photo"><img src="${IMG + c.pano}" alt="${esc(c.title)}" style="object-position:${c.panoPos}"></div>`
          : `<span class="bg" style="background-image:url('${IMG + c.hero}')"></span>`}
        <span class="veil"></span>
        <div class="d-txt">
          <span class="d-num">${c.num} <small>/ 0${COMPONENTS.length}</small></span>
          <h2 class="d-title">${esc(c.title)}</h2>
          ${c.sub ? `<p class="d-sub">${esc(c.sub)}</p>` : ''}
          <p class="d-tag">${esc(c.tag)}</p>
          <div class="d-badges">${c.badges.map((b) => `<span>${esc(b)}</span>`).join('')}</div>
        </div>
        ${c.pano ? '' : `<div class="d-art"><img src="${IMG + c.hero}" alt="${esc(c.title)}" class="fit-${c.heroFit}"></div>`}
      </header>

      <section class="d-block glass reveal d-intro">
        <h3>Présentation</h3>
        <p>${esc(c.intro)}</p>
      </section>

      ${c.parts ? `
      <section class="reveal">
        <h3 class="sub">Les trois éléments</h3>
        <div class="parts">${c.parts.map((p) => `
          <article class="part glass">
            <img src="${IMG + p.img}" alt="${esc(p.title)}" loading="lazy">
            <div><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p></div>
          </article>`).join('')}</div>
      </section>` : ''}

      ${c.specs ? `<div class="d-grid">
        <section class="d-block glass reveal">
          <h3>Caractéristiques</h3>
          <dl class="spec">${c.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd>`).join('')}</dl>
        </section>
        <div class="d-col">
          <section class="d-block glass reveal"><h3>Rôle dans le dispositif</h3>${list(c.role)}</section>
          ${c.tips ? `<section class="d-block glass reveal"><h3>Conseils d'utilisation</h3>${list(c.tips)}</section>` : ''}
        </div>
      </div>` : `<div class="d-grid">
        <section class="d-block glass reveal"><h3>Rôle dans le dispositif</h3>${list(c.role)}</section>
        ${c.tips ? `<section class="d-block glass reveal"><h3>Conseils d'utilisation</h3>${list(c.tips)}</section>` : ''}
      </div>`}

      ${c.warn ? `<aside class="callout reveal"><b>Point d'attention</b><p>${esc(c.warn)}</p></aside>` : ''}

      ${c.code ? `<section class="d-block glass reveal"><h3>${esc(c.code.title)}</h3><pre class="code"><code>${esc(c.code.text)}</code></pre></section>` : ''}

      <section class="reveal">
        <h3 class="sub">Galerie</h3>
        <div class="gallery">${c.gallery.map((g) => `
          <figure tabindex="0" role="button" aria-label="Agrandir : ${esc(g.cap)}" data-src="${IMG + g.src}" data-cap="${esc(g.cap)}">
            <img src="${IMG + g.src}" alt="${esc(g.cap)}" loading="lazy">
            <figcaption>${esc(g.cap)}</figcaption>
          </figure>`).join('')}</div>
        ${c.illustrated ? '<p class="muted small" style="margin-top:.8rem">Illustrations : remplacez-les par vos propres photos en déposant les fichiers dans public/img/ (voir composants.js).</p>' : ''}
      </section>

      <nav class="d-nav reveal" aria-label="Composants">
        <a class="glass" href="#composant/${prev.id}"><small>← Précédent</small><b>${esc(prev.title)}</b></a>
        <a class="glass right" href="#composant/${next.id}"><small>Suivant →</small><b>${esc(next.title)}</b></a>
      </nav>`;

    host.querySelectorAll('.gallery figure').forEach((f) => {
      const open = () => openLightbox(f.dataset.src, f.dataset.cap);
      f.addEventListener('click', open);
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    return true;
  }

  /* ---------- Agrandissement des photos ---------- */
  function openLightbox(src, cap) {
    closeLightbox();
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.id = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = `<button class="lb-close" aria-label="Fermer">✕</button><figure><img alt=""><figcaption></figcaption></figure>`;
    $('img', lb).src = src; $('img', lb).alt = cap; $('figcaption', lb).textContent = cap;
    lb.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') closeLightbox(); });
    document.body.appendChild(lb);
    $('.lb-close', lb).focus();
  }
  function closeLightbox() { const l = $('#lightbox'); if (l) l.remove(); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  addEventListener('hashchange', closeLightbox);

  window.VGComp = { ids: COMPONENTS.map((c) => c.id), renderList, renderDetail };
})();
