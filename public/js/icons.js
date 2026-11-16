// Eigene SVG-Icons: Wettericons (64×64, aus Bausteinen zusammengesetzt) und UI-Symbole (24×24).

const SUN = '#FFCF4A';
const MOON = '#E6EBFA';
const CLOUD = '#FFFFFF';
const CLOUD_BACK = '#AEBBD6';
const CLOUD_DARK = '#C3CDE2';
const DROP = '#7CC6FF';
const SNOW = '#FFFFFF';

function sun(cx, cy, r, rays = true) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SUN}"/>`;
  if (rays) {
    const a = r + 3.5;
    const b = r + 8;
    let d = '';
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4;
      const x1 = (cx + Math.cos(t) * a).toFixed(1);
      const y1 = (cy + Math.sin(t) * a).toFixed(1);
      const x2 = (cx + Math.cos(t) * b).toFixed(1);
      const y2 = (cy + Math.sin(t) * b).toFixed(1);
      d += `M${x1} ${y1}L${x2} ${y2}`;
    }
    out += `<path d="${d}" stroke="${SUN}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
  }
  return out;
}

// Mondsichel, gezeichnet in einem 64er-Raster um (30,32).
function moon(tx = 0, ty = 0, scale = 1) {
  return `<path transform="translate(${tx} ${ty}) scale(${scale})" fill="${MOON}" `
    + 'd="M29.8 14A18 18 0 1 0 46.84 38.35A15 15 0 0 1 29.8 14Z"/>';
}

// Wolke in einer Box von etwa 48×30.
function cloud(tx, ty, scale = 1, fill = CLOUD) {
  return `<g transform="translate(${tx} ${ty}) scale(${scale})" fill="${fill}">`
    + '<circle cx="12" cy="20" r="10"/><circle cx="24" cy="14" r="14"/>'
    + '<circle cx="36" cy="19" r="11"/><rect x="12" y="18" width="24" height="12"/></g>';
}

function drops(xs, y, len = 6) {
  const d = xs.map((x) => `M${x} ${y}l${-len * 0.45} ${len}`).join('');
  return `<path d="${d}" stroke="${DROP}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
}

function flakes(points, r = 2.3) {
  return points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${SNOW}"/>`).join('');
}

function bolt(x, y) {
  return `<path transform="translate(${x} ${y})" fill="${SUN}" d="M8 0L0 12h6l-3 10L13 8H7z"/>`;
}

function fogLines() {
  return '<path d="M12 50h40M18 57h30" stroke="#DCE4F5" stroke-width="3" stroke-linecap="round" fill="none"/>';
}

const smallSun = () => sun(23, 22, 10);
const smallMoon = () => moon(20, -2, 0.72);

const WEATHER = {
  'clear-day': () => sun(32, 32, 13),
  'clear-night': () => moon(1, 0, 1),
  'mostly-clear-day': () => sun(28, 28, 12) + cloud(28, 36, 0.62),
  'mostly-clear-night': () => moon(-3, -3, 0.95) + cloud(28, 36, 0.62),
  'partly-day': () => smallSun() + cloud(10, 24),
  'partly-night': () => smallMoon() + cloud(8, 24),
  cloudy: () => cloud(20, 12, 0.78, CLOUD_BACK) + cloud(6, 22),
  fog: () => cloud(8, 14) + fogLines(),
  drizzle: () => cloud(8, 14) + drops([24, 34, 44], 50, 4),
  rain: () => cloud(8, 14) + drops([24, 34, 44], 49, 8),
  'heavy-rain': () => cloud(20, 6, 0.78, CLOUD_BACK) + cloud(6, 14, 1, CLOUD_DARK)
    + drops([20, 29, 38, 47], 49, 10),
  sleet: () => cloud(8, 14) + drops([24, 44], 49, 7) + flakes([[32, 54]]),
  snow: () => cloud(8, 14) + flakes([[22, 52], [32, 57], [42, 52]]),
  'showers-day': () => sun(23, 18, 9) + cloud(10, 18) + drops([26, 36, 46], 52, 7),
  'showers-night': () => moon(20, -6, 0.68) + cloud(8, 18) + drops([24, 34, 44], 52, 7),
  'snow-showers-day': () => sun(23, 18, 9) + cloud(10, 18) + flakes([[24, 55], [34, 59], [44, 55]]),
  'snow-showers-night': () => moon(20, -6, 0.68) + cloud(8, 18) + flakes([[22, 55], [32, 59], [42, 55]]),
  thunder: () => cloud(20, 4, 0.78, CLOUD_BACK) + cloud(6, 12, 1, CLOUD_DARK) + bolt(26, 40),
  'thunder-hail': () => cloud(20, 4, 0.78, CLOUD_BACK) + cloud(6, 12, 1, CLOUD_DARK) + bolt(22, 40)
    + flakes([[44, 50], [50, 58]], 2.6),
};

export const ICON_NAMES = Object.keys(WEATHER);

const cache = new Map();

/** Nur die Formen eines Wettericons (64er-Raster), ohne <svg>-Hülle. */
export function iconBody(name) {
  const key = WEATHER[name] ? name : 'cloudy';
  if (!cache.has(key)) cache.set(key, WEATHER[key]());
  return cache.get(key);
}

export function iconSvg(name, className = 'wx-icon') {
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true">${iconBody(name)}</svg>`;
}

// ---------------------------------------------------------------- UI-Symbole

const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const UI = {
  pin: '<path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  list: `<path ${stroke} d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>`,
  umbrella: `<path fill="currentColor" d="M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9z"/><path ${stroke} d="M12 12v6.5a2 2 0 0 1-4 0"/>`,
  locate: `<circle cx="12" cy="12" r="6.5" ${stroke}/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path ${stroke} d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>`,
  play: '<path fill="currentColor" d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>',
  chevron: `<path ${stroke} d="M9 6l6 6-6 6"/>`,
  'chevron-down': `<path ${stroke} d="M6 9l6 6 6-6"/>`,
  up: `<path ${stroke} d="M6 14l6-6 6 6"/>`,
  down: `<path ${stroke} d="M6 10l6 6 6-6"/>`,
  trash: `<path ${stroke} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>`,
  grip: '<circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/>',
  close: `<path ${stroke} d="M6 6l12 12M18 6L6 18"/>`,
  search: `<circle cx="11" cy="11" r="6.5" ${stroke}/><path ${stroke} d="M16 16l4.5 4.5"/>`,
  plus: `<path ${stroke} d="M12 5v14M5 12h14"/>`,
  refresh: `<path ${stroke} d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7"/>`,
  wind: `<path ${stroke} d="M3 9h10.5a2.75 2.75 0 1 0-2.6-3.6M3 14h15a2.75 2.75 0 1 1-2.6 3.6M3 19h7"/>`,
  drop: '<path fill="currentColor" d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z"/>',
  sun: `<circle cx="12" cy="12" r="4.2" fill="currentColor"/><path ${stroke} d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>`,
  radar: `<circle cx="12" cy="12" r="8.5" ${stroke}/><circle cx="12" cy="12" r="4" ${stroke}/><path ${stroke} d="M12 12l6-6"/>`,
  leaf: '<path fill="currentColor" d="M20 3C10 3 4 8.5 4 15.5c0 1.2.2 2.3.6 3.3C7.5 14.5 11 11.5 15 10c-3.5 2.5-6.5 5.5-8.4 10.2l1.7.800c.500-1.2 1.1-2.3 1.8-3.3.800.2 1.6.300 2.4.300C18 18 21 12.5 20 3z"/>',
  moon: '<path fill="currentColor" d="M11.2 3.5a8.5 8.5 0 1 0 9.3 11.3A7 7 0 0 1 11.2 3.5z"/>',
  air: `<path ${stroke} d="M4 8c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1M4 13c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1M4 18c2-2 4-2 6 0s4 2 6 0 3-1.5 4-1"/>`,
  edit: `<path ${stroke} d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>`,
  check: `<path ${stroke} d="M5 12.5l4.5 4.5L19 7.5"/>`,
  external: `<path ${stroke} d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5"/>`,
  expand: `<path ${stroke} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  thermo: `<path ${stroke} d="M12 3.5a2 2 0 0 0-2 2v8.2a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2z"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/>`,
};

export function uiIcon(name, className = 'ui-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${UI[name] || ''}</svg>`;
}
