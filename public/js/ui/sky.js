// Animierter Himmel hinter der App: Sonne, Sterne, Wolken, Nebel, Regen, Schnee, Wetterleuchten.
// Gezeichnet wird auf ein Canvas; die Grundfarben (Verlauf) kommen aus app.css.

const TAU = Math.PI * 2;
const SLANT = 0.16; // Regen fällt leicht schräg
const MAX_DPR = 1.5; // weiche Formen brauchen keine volle Auflösung
const CALM_FRAME_MS = 30; // ohne Niederschlag reichen ~30 Bilder pro Sekunde

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Wolkenfarbe (RGB) und Grunddeckkraft je Szene
const CLOUD_STYLE = {
  'clear-day': ['255,255,255', 0.3],
  'partly-day': ['255,255,255', 0.34],
  'cloudy-day': ['226,232,242', 0.4],
  'fog-day': ['230,234,240', 0.3],
  'rain-day': ['150,165,190', 0.4],
  'snow-day': ['236,241,250', 0.4],
  'clear-night': ['120,132,190', 0.26],
  'partly-night': ['120,132,190', 0.32],
  'cloudy-night': ['110,120,160', 0.32],
  'fog-night': ['140,146,165', 0.24],
  'rain-night': ['80,92,130', 0.4],
  'snow-night': ['150,162,195', 0.32],
  thunder: ['70,78,110', 0.5],
};

// Zwei Wolkenformen aus weichen Kreisen: [x, y, Radius] in einem Feld von 400×220.
const SPRITE_W = 400;
const SPRITE_H = 220;
const PUFFS = [
  [[95, 130, 75], [160, 100, 90], [235, 105, 95], [305, 130, 80], [200, 140, 85]],
  [[80, 125, 65], [150, 115, 85], [220, 95, 80], [290, 115, 90], [330, 135, 60], [190, 140, 80]],
];

function makeSprite(rgb, puffs) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W;
  canvas.height = SPRITE_H;
  const g = canvas.getContext('2d');
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb},0.9)`);
    grad.addColorStop(0.55, `rgba(${rgb},0.5)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  return canvas;
}

const keyOf = (s) => [s.name, s.sun, s.stars, s.clouds, s.rain, s.snow, s.fog].join('|');

export function createSky(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return { set() {} };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;
  let wantedKey = '';
  let swapTimer = 0;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let time = 0;

  let sprites = [];
  let clouds = [];
  let bands = [];
  let stars = [];
  let drops = [];
  let flakes = [];
  const flash = { at: -10, next: 0, x: 0 };

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
      for (const list of [clouds, bands, stars, drops, flakes]) {
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
    sprites = [];
    if (!scene || scene.name === 'none') return;

    const area = clamp((w * h) / (400 * 850), 0.7, 3);
    const wide = clamp(w / 420, 1, 2.6);
    const unit = clamp(w / 420, 0.9, 1.8);
    const [rgb, alpha] = CLOUD_STYLE[scene.name] || CLOUD_STYLE['cloudy-day'];
    if (scene.clouds > 0 || scene.fog > 0) sprites = PUFFS.map((p) => makeSprite(rgb, p));

    if (scene.clouds > 0) {
      const count = Math.round((2 + scene.clouds * 9) * wide);
      const windy = scene.rain > 0 ? 1.8 : 1;
      for (let i = 0; i < count; i++) {
        const s = (rand(0.45, 0.8) + scene.clouds * rand(0.1, 0.6)) * unit;
        const cw = SPRITE_W * s;
        const ch = SPRITE_H * s;
        clouds.push({
          sprite: sprites[i % sprites.length],
          x: rand(-cw * 0.5, w),
          y: rand(-0.12, 0.05 + 0.5 * scene.clouds) * h - ch * 0.3,
          w: cw,
          h: ch,
          a: alpha * rand(0.6, 1),
          v: rand(3, 9) * s * windy,
        });
      }
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
      const count = Math.round(85 * scene.stars * area);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rand(0, w),
          y: h * 0.78 * Math.random() ** 1.4,
          r: rand(0.4, 1.4),
          a: rand(0.35, 0.95),
          sp: rand(0.4, 1.6),
          ph: rand(0, TAU),
        });
      }
    }

    if (scene.rain > 0) {
      const count = Math.round((30 + 150 * scene.rain) * area);
      for (let i = 0; i < count; i++) {
        const near = i % 3 === 0;
        drops.push({
          near,
          x: rand(0, w * 1.2),
          y: rand(-h * 0.2, h),
          l: (near ? rand(16, 26) : rand(9, 16)) * (0.7 + 0.5 * scene.rain),
          v: (near ? rand(900, 1250) : rand(600, 850)) * (0.75 + 0.35 * scene.rain),
        });
      }
    }

    if (scene.snow > 0) {
      const count = Math.round((25 + 110 * scene.snow) * area);
      for (let i = 0; i < count; i++) {
        const r = rand(1, 3.4);
        flakes.push({
          near: r > 2.2,
          x: rand(0, w),
          y: rand(-h * 0.1, h),
          r,
          v: 22 + r * 24,
          sw: rand(0.5, 1.3),
          ph: rand(0, TAU),
        });
      }
    }

    flash.at = -10;
    flash.next = time + rand(2, 5);
  }

  // ---------------------------------------------------------- Bewegung

  function step(dt) {
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > w + 20) c.x = -c.w - rand(0, w * 0.3);
    }
    for (const b of bands) {
      b.x += b.v * dt;
      if (b.v > 0 && b.x > w) b.x = -b.w;
      else if (b.v < 0 && b.x < -b.w) b.x = w;
    }
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= d.v * SLANT * dt;
      if (d.y - d.l > h) {
        d.y = -rand(0, h * 0.2);
        d.x = rand(0, w * 1.2);
      }
    }
    for (const f of flakes) {
      f.y += f.v * dt;
      f.x += Math.sin(time * f.sw + f.ph) * 14 * dt;
      if (f.y - f.r > h) {
        f.y = -f.r - rand(0, 30);
        f.x = rand(0, w);
      }
    }
    if (scene.thunder && time >= flash.next) {
      flash.at = time;
      flash.x = rand(0.15, 0.85) * w;
      flash.next = time + rand(5, 11);
    }
  }

  // ---------------------------------------------------------- Zeichnen

  function drawSun(k) {
    // Rechts neben der großen Temperatur: dort steht kein Text, den die Sonne überstrahlen könnte.
    const x = w * 0.8;
    const y = clamp(h * 0.22, 150, 240);
    const R = clamp(Math.max(w, h) * 0.75, 420, 900) * (1 + 0.025 * Math.sin(time * 0.5));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.02);
    const rays = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R * 0.8);
    rays.addColorStop(0, `rgba(255,244,200,${0.1 * k})`);
    rays.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = rays;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      const half = i % 2 ? 0.05 : 0.085;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R * 0.8, a - half, a + half);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, R);
    glow.addColorStop(0, `rgba(255,248,214,${0.95 * k})`);
    glow.addColorStop(0.07, `rgba(255,236,160,${0.8 * k})`);
    glow.addColorStop(0.2, `rgba(255,222,130,${0.32 * k})`);
    glow.addColorStop(0.5, `rgba(255,214,120,${0.1 * k})`);
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars() {
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = s.a * scene.stars * (0.6 + 0.4 * Math.sin(time * s.sp + s.ph));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSprites(list) {
    for (const p of list) {
      ctx.globalAlpha = p.a;
      ctx.drawImage(p.sprite, p.x, p.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    const e = time - flash.at;
    if (e < 0 || e > 0.7) return;
    const k = Math.max(Math.exp(-e * 9), e > 0.14 ? 0.7 * Math.exp(-(e - 0.14) * 11) : 0);
    const r = Math.max(w, h) * 0.9;
    const grad = ctx.createRadialGradient(flash.x, -h * 0.05, 0, flash.x, -h * 0.05, r);
    grad.addColorStop(0, `rgba(226,233,255,${0.34 * k})`);
    grad.addColorStop(1, 'rgba(226,233,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawRain() {
    ctx.lineCap = 'round';
    for (const near of [false, true]) {
      ctx.strokeStyle = near ? 'rgba(214,232,255,0.42)' : 'rgba(200,222,255,0.22)';
      ctx.lineWidth = near ? 1.5 : 1;
      ctx.beginPath();
      for (const d of drops) {
        if (d.near !== near) continue;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.l * SLANT, d.y - d.l);
      }
      ctx.stroke();
    }
  }

  function drawSnow() {
    for (const near of [false, true]) {
      ctx.fillStyle = near ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      for (const f of flakes) {
        if (f.near !== near) continue;
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, TAU);
      }
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (!scene || scene.name === 'none') return;
    if (scene.sun > 0) drawSun(scene.sun);
    if (stars.length) drawStars();
    if (clouds.length) drawSprites(clouds);
    if (bands.length) drawSprites(bands);
    if (scene.thunder && !reduced.matches) drawFlash();
    if (drops.length) drawRain();
    if (flakes.length) drawSnow();
  }

  // ---------------------------------------------------------- Schleife

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const calm = !drops.length && !flakes.length;
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
    draw();
    canvas.style.opacity = next.name === 'none' ? '0' : '1';
    start();
  }

  function set(next) {
    const key = keyOf(next);
    if (key === wantedKey) return;
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

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  reduced.addEventListener?.('change', () => {
    draw();
    start();
  });

  return { set };
}
