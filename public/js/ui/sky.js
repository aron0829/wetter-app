// Animierter Himmel hinter der App. Gezeichnet wird auf ein Canvas; die Grundfarben (Verlauf)
// kommen aus app.css, die Szene aus js/scene.js.
//
// Was sich bewegt:
// - Tag: Sonne mit Strahlen, Linsenreflexen und schwebendem Staub im Licht
// - Nacht: funkelnde Sterne, Sternschnuppen, Mond in seiner echten Phase
// - Wolken in drei Tiefenebenen, vom gemessenen Wind getrieben
// - Regen und Schnee in drei Tiefenebenen, Neigung und Drift folgen dem Wind
// - Gewitter: verzweigte Blitze mit Wetterleuchten
// - Dämmerung: warmer Horizont rund um Sonnenauf- und -untergang
// - Beim Scrollen verschieben sich die Ebenen unterschiedlich stark (Parallaxe)

const TAU = Math.PI * 2;
const MAX_DPR = 1.5; // weiche Formen brauchen keine volle Auflösung
const CALM_FRAME_MS = 30; // ohne Niederschlag reichen ~30 Bilder pro Sekunde
const MAX_SCROLL = 900;
const SKY_SHIFT = 0.035; // Parallaxe von Sonne, Mond und Sternen je Pixel Scrollweg

// Tiefenebenen der Wolken, fern → nah
const DEPTHS = [
  { scale: 0.55, speed: 0.45, alpha: 0.55, shift: 0.06 },
  { scale: 0.85, speed: 1, alpha: 0.8, shift: 0.11 },
  { scale: 1.25, speed: 1.9, alpha: 1, shift: 0.19 },
];

// Tiefenebenen des Regens, fern → nah: [Länge von/bis, Tempo von/bis, Deckkraft, Strichbreite]
const RAIN_LAYERS = [
  [8, 13, 520, 680, 0.16, 1],
  [13, 20, 760, 980, 0.28, 1.2],
  [20, 30, 1050, 1350, 0.44, 1.7],
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Wolken je Szene: [Farbe oben, Farbe der Unterseite, Grunddeckkraft]
const CLOUD_STYLE = {
  'clear-day': ['255,255,255', '176,200,236', 0.34],
  'partly-day': ['255,255,255', '168,190,228', 0.4],
  'cloudy-day': ['228,234,244', '128,142,168', 0.44],
  'fog-day': ['230,234,240', '170,176,186', 0.3],
  'rain-day': ['158,172,196', '74,88,116', 0.46],
  'snow-day': ['238,243,251', '168,182,208', 0.42],
  'clear-night': ['128,140,198', '52,58,112', 0.28],
  'partly-night': ['128,140,198', '52,58,112', 0.34],
  'cloudy-night': ['116,126,166', '44,50,82', 0.36],
  'fog-night': ['140,146,165', '80,86,104', 0.24],
  'rain-night': ['86,98,136', '30,38,66', 0.44],
  'snow-night': ['156,168,200', '70,82,118', 0.34],
  thunder: ['78,86,120', '22,26,48', 0.55],
};

const SPRITE_W = 400;
const SPRITE_H = 240;
const CLOUD_SHAPES = 4;

function offscreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

/** Haufenwolke aus weichen Kreisen: in der Mitte höher, unten flach und dunkler. */
function makeCloud(light, shade) {
  const [canvas, g] = offscreen(SPRITE_W, SPRITE_H);
  const base = SPRITE_H * 0.7;
  const n = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hump = Math.sin(t * Math.PI);
    const r = rand(38, 52) + hump * rand(22, 44);
    const x = 70 + t * (SPRITE_W - 140) + rand(-14, 14);
    const y = base - r * rand(0.35, 0.75) * (0.5 + hump * 0.6);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${light},0.95)`);
    grad.addColorStop(0.55, `rgba(${light},0.55)`);
    grad.addColorStop(1, `rgba(${light},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  // Unterseite abdunkeln …
  g.globalCompositeOperation = 'source-atop';
  const shadow = g.createLinearGradient(0, SPRITE_H * 0.3, 0, SPRITE_H * 0.85);
  shadow.addColorStop(0, `rgba(${shade},0)`);
  shadow.addColorStop(1, `rgba(${shade},0.75)`);
  g.fillStyle = shadow;
  g.fillRect(0, 0, SPRITE_W, SPRITE_H);
  // … und nach unten weich auslaufen lassen (flache Wolkenbasis).
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, SPRITE_H * 0.72, 0, SPRITE_H * 0.98);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, SPRITE_W, SPRITE_H);
  return canvas;
}

/** Weicher Punkt (Schneeflocke nah, Staub im Licht) bzw. Ring (Linsenreflex). */
function makeDot(rgb, ring = false) {
  const [canvas, g] = offscreen(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (ring) {
    grad.addColorStop(0, `rgba(${rgb},0.35)`);
    grad.addColorStop(0.82, `rgba(${rgb},0.9)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
  } else {
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.75)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return canvas;
}

const keyOf = (s) => [s.name, s.sun, s.stars, s.clouds, s.rain, s.snow, s.fog].join('|');

export function createSky(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return { set() {}, scroll() {} };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const softDot = makeDot('255,255,255');
  const flareDot = makeDot('255,238,205', true);

  let scene = null;
  let wantedKey = '';
  let swapTimer = 0;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let time = 0;

  // Stimmung: Zielwerte kommen von außen, die gezeichneten Werte gleiten hinterher.
  let amb = { wind: 0.15, twilight: 0, dusk: false, moon: null };
  let wind = amb.wind;
  let twilight = 0;
  let slant = 0.16;
  let scrollTarget = 0;
  let scrollY = 0;

  let sprites = [];
  let clouds = [];
  let bands = [];
  let stars = [];
  let drops = [];
  let flakes = [];
  let motes = [];
  const flash = { at: -10, next: 0, x: 0, bolt: [] };
  const meteor = { at: -10, next: 0, x: 0, y: 0, dx: 0, dy: 0 };

  // ---------------------------------------------------------- Größe

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    if (nw === w && nh === h) return;
    // Vorhandene Teile mitskalieren, damit bei Größenänderungen nichts springt.
    if (w && h) {
      const fx = nw / w;
      const fy = nh / h;
      for (const list of [clouds, bands, stars, drops, flakes, motes]) {
        for (const p of list) {
          p.x *= fx;
          p.y *= fy;
        }
      }
    }
    w = nw;
    h = nh;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scene) draw();
  }

  // ---------------------------------------------------------- Aufbau

  function populate() {
    clouds = [];
    bands = [];
    stars = [];
    drops = [];
    flakes = [];
    motes = [];
    sprites = [];
    if (!scene || scene.name === 'none') return;

    const area = clamp((w * h) / (400 * 850), 0.7, 3);
    const wide = clamp(w / 420, 1, 2.6);
    const unit = clamp(w / 420, 0.9, 1.8);
    const [light, shade, alpha] = CLOUD_STYLE[scene.name] || CLOUD_STYLE['cloudy-day'];
    if (scene.clouds > 0 || scene.fog > 0) {
      sprites = Array.from({ length: CLOUD_SHAPES }, () => makeCloud(light, shade));
    }

    if (scene.clouds > 0) {
      const count = Math.round((3 + scene.clouds * 10) * wide);
      for (let i = 0; i < count; i++) {
        const depth = i % DEPTHS.length;
        const layer = DEPTHS[depth];
        const s = (rand(0.5, 0.8) + scene.clouds * rand(0.1, 0.5)) * unit * layer.scale;
        const cw = SPRITE_W * s;
        const ch = SPRITE_H * s;
        clouds.push({
          depth,
          sprite: sprites[i % sprites.length],
          x: rand(-cw * 0.5, w),
          y: rand(-0.1, 0.06 + 0.5 * scene.clouds) * h - ch * 0.3,
          w: cw,
          h: ch,
          a: alpha * rand(0.65, 1) * layer.alpha,
          v: rand(4, 8) * layer.speed,
        });
      }
      clouds.sort((a, b) => a.depth - b.depth);
    }

    if (scene.fog > 0) {
      const count = Math.round(4 + scene.fog * 4);
      for (let i = 0; i < count; i++) {
        const bw = rand(1.4, 2.2) * w;
        const bh = rand(0.24, 0.42) * h;
        bands.push({
          sprite: sprites[i % sprites.length],
          x: rand(-bw * 0.6, w * 0.4),
          y: ((i + rand(0, 0.8)) / count) * h - bh / 2,
          w: bw,
          h: bh,
          a: alpha * rand(0.45, 0.8) * scene.fog,
          v: (i % 2 ? -1 : 1) * rand(4, 12),
        });
      }
    }

    if (scene.stars > 0) {
      const count = Math.round(95 * scene.stars * area);
      for (let i = 0; i < count; i++) {
        const r = rand(0.4, 1.5);
        stars.push({
          x: rand(0, w),
          y: h * 0.8 * Math.random() ** 1.4,
          r,
          big: r > 1.2,
          a: rand(0.35, 0.95),
          sp: rand(0.4, 1.8),
          ph: rand(0, TAU),
        });
      }
    }

    if (scene.sun >= 0.6) {
      const count = Math.round(16 * area);
      for (let i = 0; i < count; i++) {
        motes.push({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(1.4, 4.2),
          a: rand(0.07, 0.24),
          vx: rand(3, 10),
          vy: rand(-9, -2),
          sp: rand(0.3, 1),
          ph: rand(0, TAU),
        });
      }
    }

    if (scene.rain > 0) {
      const count = Math.round((36 + 170 * scene.rain) * area);
      for (let i = 0; i < count; i++) {
        const layer = i % RAIN_LAYERS.length;
        const [l0, l1, v0, v1] = RAIN_LAYERS[layer];
        drops.push({
          layer,
          x: rand(-0.05 * w, w + h * 0.5),
          y: rand(-h * 0.2, h),
          l: rand(l0, l1) * (0.7 + 0.5 * scene.rain),
          v: rand(v0, v1) * (0.75 + 0.35 * scene.rain),
        });
      }
    }

    if (scene.snow > 0) {
      const count = Math.round((28 + 120 * scene.snow) * area);
      for (let i = 0; i < count; i++) {
        const r = i % 7 === 0 ? rand(3, 5) : rand(0.9, 2.8);
        flakes.push({
          near: r >= 3,
          x: rand(0, w),
          y: rand(-h * 0.1, h),
          r,
          v: 20 + r * 22,
          sw: rand(0.5, 1.3),
          ph: rand(0, TAU),
        });
      }
    }

    flash.at = -10;
    flash.next = time + rand(2, 5);
    meteor.at = -10;
    meteor.next = time + rand(3, 8);
  }

  function makeBolt(x) {
    const main = [[x, -10]];
    let cx = x;
    let cy = -10;
    const end = rand(0.36, 0.6) * h;
    while (cy < end) {
      cy += rand(18, 46);
      cx += rand(-26, 26);
      main.push([cx, cy]);
    }
    const paths = [main];
    const branches = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branches && main.length > 5; b++) {
      const from = main[2 + Math.floor(Math.random() * (main.length - 4))];
      const dir = Math.random() < 0.5 ? -1 : 1;
      const path = [from];
      let [bx, by] = from;
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < segments; i++) {
        by += rand(14, 34);
        bx += dir * rand(10, 30);
        path.push([bx, by]);
      }
      paths.push(path);
    }
    return paths;
  }

  // ---------------------------------------------------------- Bewegung

  function settle() {
    wind = amb.wind;
    twilight = amb.twilight;
    scrollY = scrollTarget;
    slant = 0.1 + 0.34 * wind;
  }

  function step(dt) {
    wind += (amb.wind - wind) * Math.min(1, dt * 0.8);
    twilight += (amb.twilight - twilight) * Math.min(1, dt * 0.8);
    scrollY += (scrollTarget - scrollY) * Math.min(1, dt * 12);
    // Böen: die Neigung schwankt langsam um den Wert, den der Wind vorgibt.
    const gust = 0.035 * Math.sin(time * 0.4) + 0.02 * Math.sin(time * 1.3 + 1);
    slant = 0.1 + 0.34 * wind + gust;

    const drift = (0.5 + 3.5 * wind) * (scene.rain > 0 ? 1.3 : 1);
    for (const c of clouds) {
      c.x += c.v * drift * dt;
      if (c.x > w + 20) c.x = -c.w - rand(0, w * 0.3);
    }
    for (const b of bands) {
      b.x += b.v * dt;
      if (b.v > 0 && b.x > w) b.x = -b.w;
      else if (b.v < 0 && b.x < -b.w) b.x = w;
    }
    for (const m of motes) {
      m.x += (m.vx + Math.sin(time * m.sp + m.ph) * 6) * dt;
      m.y += m.vy * dt;
      if (m.y < -10) {
        m.y = h + 10;
        m.x = rand(0, w);
      }
      if (m.x > w + 10) m.x = -10;
    }
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= d.v * slant * dt;
      if (d.y - d.l > h || d.x < -40) {
        d.y = -rand(0, h * 0.2);
        d.x = rand(-0.05 * w, w + h * slant);
      }
    }
    const push = 26 + 150 * wind + gust * 400;
    for (const f of flakes) {
      f.y += f.v * dt;
      f.x += (Math.sin(time * f.sw + f.ph) * 16 - push * (f.r / 3)) * dt;
      if (f.y - f.r > h) {
        f.y = -f.r - rand(0, 30);
        f.x = rand(0, w * 1.3);
      } else if (f.x < -12) {
        f.x = w + 10;
      }
    }
    if (scene.thunder && time >= flash.next) {
      flash.at = time;
      flash.x = rand(0.15, 0.85) * w;
      flash.bolt = makeBolt(flash.x);
      flash.next = time + rand(4, 10);
    }
    if (scene.stars >= 0.6 && time >= meteor.next) {
      const angle = rand(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1);
      const reach = clamp(w * 0.55, 220, 420);
      meteor.at = time;
      meteor.x = rand(0.2, 0.8) * w;
      meteor.y = rand(0.04, 0.3) * h;
      meteor.dx = Math.sin(angle) * reach * 1.6;
      meteor.dy = Math.abs(Math.cos(angle)) * reach * 0.55;
      meteor.next = time + rand(7, 16);
    }
  }

  // ---------------------------------------------------------- Zeichnen

  const skyY = () => -scrollY * SKY_SHIFT;

  function drawTwilight() {
    const veil = scene.rain > 0 || scene.snow > 0 || scene.fog > 0 ? 0.35 : 1;
    const k = twilight * (1 - 0.7 * scene.clouds) * veil;
    if (k < 0.02) return;
    const [warm, rose] = amb.dusk ? ['255,122,72', '214,92,140'] : ['255,172,98', '240,132,150'];
    const grad = ctx.createLinearGradient(0, h * 0.28, 0, h);
    grad.addColorStop(0, `rgba(${rose},0)`);
    grad.addColorStop(0.45, `rgba(${rose},${0.24 * k})`);
    grad.addColorStop(1, `rgba(${warm},${0.58 * k})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSun(k) {
    // Rechts neben der großen Temperatur: dort steht kein Text, den die Sonne überstrahlen könnte.
    const x = w * 0.8;
    const y = clamp(h * 0.22, 150, 240) + skyY();
    const R = clamp(Math.max(w, h) * 0.75, 420, 900) * (1 + 0.025 * Math.sin(time * 0.5));
    // Zur Dämmerung wird das Licht wärmer.
    const green = Math.round(236 - 58 * twilight);
    const blue = Math.round(160 - 72 * twilight);

    ctx.save();
    ctx.translate(x, y);
    for (const [count, spin, reach, strength] of [[12, 0.02, 0.8, 0.1], [7, -0.013, 0.55, 0.07]]) {
      ctx.rotate(time * spin);
      const rays = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R * reach);
      rays.addColorStop(0, `rgba(255,244,200,${strength * k})`);
      rays.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = rays;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = (i * TAU) / count;
        const half = i % 2 ? 0.05 : 0.085;
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R * reach, a - half, a + half);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, R);
    glow.addColorStop(0, `rgba(255,248,214,${0.95 * k})`);
    glow.addColorStop(0.07, `rgba(255,${green},${blue},${0.8 * k})`);
    glow.addColorStop(0.2, `rgba(255,${green - 14},${blue - 30},${0.32 * k})`);
    glow.addColorStop(0.5, `rgba(255,${green - 22},${blue - 40},${0.1 * k})`);
    glow.addColorStop(1, `rgba(255,${green - 22},${blue - 40},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Linsenreflexe auf der Linie von der Sonne durch die Bildmitte
    const unit = clamp(w / 420, 0.9, 1.8);
    const dx = w * 0.5 - x;
    const dy = h * 0.5 - y;
    const breathe = 0.85 + 0.15 * Math.sin(time * 0.7);
    for (const [t, size, a] of [[0.42, 16, 0.2], [0.85, 40, 0.11], [1.35, 24, 0.15], [1.85, 68, 0.08]]) {
      const r = size * unit;
      ctx.globalAlpha = a * k * breathe;
      ctx.drawImage(flareDot, x + dx * t - r, y + dy * t - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes() {
    for (const m of motes) {
      ctx.globalAlpha = m.a * scene.sun * (0.55 + 0.45 * Math.sin(time * m.sp + m.ph));
      ctx.drawImage(softDot, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawStars() {
    const dy = skyY();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.7;
    for (const s of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * s.sp + s.ph);
      ctx.globalAlpha = s.a * scene.stars * twinkle;
      ctx.beginPath();
      ctx.arc(s.x, s.y + dy, s.r, 0, TAU);
      ctx.fill();
      if (s.big) {
        // Helle Sterne bekommen ein kleines Kreuz, das mit dem Funkeln wächst.
        const len = s.r * (2.2 + 2.6 * twinkle);
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y + dy);
        ctx.lineTo(s.x + len, s.y + dy);
        ctx.moveTo(s.x, s.y + dy - len);
        ctx.lineTo(s.x, s.y + dy + len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteor() {
    const e = (time - meteor.at) / 0.75;
    if (e < 0 || e > 1) return;
    const hx = meteor.x + meteor.dx * e;
    const hy = meteor.y + meteor.dy * e + skyY();
    const tail = 0.28;
    const tx = hx - meteor.dx * tail;
    const ty = hy - meteor.dy * tail;
    const k = Math.sin(Math.PI * e) * scene.stars;
    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,255,${0.9 * k})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.globalAlpha = k;
    ctx.drawImage(softDot, hx - 4, hy - 4, 8, 8);
    ctx.globalAlpha = 1;
  }

  function drawMoon(k) {
    const { phase, illumination, southern } = amb.moon;
    const x = w * 0.8;
    const y = clamp(h * 0.2, 130, 220) + skyY();
    const r = clamp(w * 0.065, 22, 34);

    const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 7);
    halo.addColorStop(0, `rgba(205,216,255,${0.26 * k * (0.25 + 0.75 * illumination)})`);
    halo.addColorStop(0.35, `rgba(190,204,255,${0.08 * k * (0.25 + 0.75 * illumination)})`);
    halo.addColorStop(1, 'rgba(190,204,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);

    // ganze Scheibe im schwachen Erdschein
    ctx.fillStyle = `rgba(150,162,214,${0.16 * k})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (illumination < 0.02) return;

    // beleuchteter Teil: rechter Rand plus Schattengrenze als halbe Ellipse
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    if ((phase < 0.5) === !!southern) ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(0, 0, r * Math.abs(1 - 2 * illumination), r, 0, Math.PI / 2, -Math.PI / 2, illumination < 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(236,240,252,${0.96 * k})`;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = `rgba(150,162,200,${0.36 * k})`;
    for (const [cx, cy, cr] of [[0.3, -0.25, 0.2], [-0.1, 0.32, 0.26], [0.5, 0.36, 0.13], [-0.42, -0.3, 0.16]]) {
      ctx.beginPath();
      ctx.arc(cx * r, cy * r, cr * r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClouds() {
    for (const c of clouds) {
      ctx.globalAlpha = c.a;
      ctx.drawImage(c.sprite, c.x, c.y - scrollY * DEPTHS[c.depth].shift, c.w, c.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawBands() {
    for (const b of bands) {
      ctx.globalAlpha = b.a;
      ctx.drawImage(b.sprite, b.x, b.y, b.w, b.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    const e = time - flash.at;
    if (e < 0 || e > 0.7) return;
    const k = Math.max(Math.exp(-e * 9), e > 0.14 ? 0.7 * Math.exp(-(e - 0.14) * 11) : 0);
    const r = Math.max(w, h) * 0.9;
    const grad = ctx.createRadialGradient(flash.x, -h * 0.05, 0, flash.x, -h * 0.05, r);
    grad.addColorStop(0, `rgba(226,233,255,${0.36 * k})`);
    grad.addColorStop(1, 'rgba(226,233,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (e > 0.32) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color] of [[8, `rgba(170,190,255,${0.16 * k})`], [3.4, `rgba(205,218,255,${0.4 * k})`], [1.5, `rgba(248,250,255,${0.95 * k})`]]) {
      ctx.strokeStyle = color;
      flash.bolt.forEach((path, i) => {
        ctx.lineWidth = i ? width * 0.55 : width;
        ctx.beginPath();
        path.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      });
    }
  }

  function drawRain() {
    ctx.lineCap = 'round';
    RAIN_LAYERS.forEach(([, , , , alpha, width], layer) => {
      ctx.strokeStyle = `rgba(208,228,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (const d of drops) {
        if (d.layer !== layer) continue;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.l * slant, d.y - d.l);
      }
      ctx.stroke();
    });
    // Sprühnebel am unteren Rand, je stärker der Regen
    const mist = ctx.createLinearGradient(0, h * 0.7, 0, h);
    mist.addColorStop(0, 'rgba(190,208,235,0)');
    mist.addColorStop(1, `rgba(190,208,235,${0.1 * scene.rain})`);
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
  }

  function drawSnow() {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    for (const f of flakes) {
      if (f.near) continue;
      ctx.moveTo(f.x + f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, TAU);
    }
    ctx.fill();
    // nahe Flocken: groß und unscharf
    ctx.globalAlpha = 0.72;
    for (const f of flakes) {
      if (!f.near) continue;
      const size = f.r * 1.9;
      ctx.drawImage(softDot, f.x - size, f.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (!scene || scene.name === 'none') return;
    const still = reduced.matches;
    const dry = !scene.rain && !scene.snow && !scene.fog;

    drawTwilight();
    if (scene.sun > 0) drawSun(scene.sun);
    if (stars.length) drawStars();
    if (stars.length && !still) drawMeteor();
    if (scene.night && amb.moon && dry) drawMoon(scene.stars > 0 ? 1 : 0.4);
    if (clouds.length) drawClouds();
    if (motes.length) drawMotes();
    if (bands.length) drawBands();
    if (scene.thunder && !still) drawFlash();
    if (drops.length) drawRain();
    if (flakes.length) drawSnow();
  }

  // ---------------------------------------------------------- Schleife

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const calm = !drops.length && !flakes.length && Math.abs(scrollTarget - scrollY) < 0.5;
    if (calm && now - lastDraw < CALM_FRAME_MS) return;
    const dt = Math.min(0.05, (now - last) / 1000) || 0;
    last = now;
    lastDraw = now;
    time += dt;
    step(dt);
    draw();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function start() {
    stop();
    if (!scene || scene.name === 'none' || reduced.matches || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function apply(next) {
    scene = next;
    resize();
    populate();
    settle();
    draw();
    canvas.style.opacity = next.name === 'none' ? '0' : '1';
    start();
  }

  /** Szene (aus sceneFor) und optional Stimmung: { wind, twilight, dusk, moon }. */
  function set(next, ambience) {
    if (ambience) amb = { ...amb, ...ambience };
    const key = keyOf(next);
    if (key === wantedKey) {
      // Gleiche Szene: Wind und Dämmerung gleiten in der Schleife nach; ohne Schleife neu zeichnen.
      if (!raf && scene) {
        settle();
        draw();
      }
      return;
    }
    wantedKey = key;
    clearTimeout(swapTimer);
    if (!scene || scene.name === 'none' || reduced.matches) {
      apply(next);
      return;
    }
    // Alte Szene ausblenden, dann tauschen und wieder einblenden.
    canvas.style.opacity = '0';
    swapTimer = setTimeout(() => apply(next), 280);
  }

  /** Scrollposition der aktiven Seite: verschiebt die Ebenen unterschiedlich stark. */
  function scroll(top) {
    scrollTarget = clamp(Number(top) || 0, 0, MAX_SCROLL);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  reduced.addEventListener?.('change', () => {
    settle();
    draw();
    start();
  });

  return { set, scroll };
}
