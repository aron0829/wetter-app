// Wettercode + Tageszeit → Szene für den Hintergrund. Keine DOM-Zugriffe.
// Alle Stärken liegen zwischen 0 und 1; die Farben zur Szene stehen in app.css (.scene-<name>).
import { minutesBetween } from './time.js';

const TWILIGHT_MIN = 45; // so lange vor und nach Sonnenauf-/-untergang färbt sich der Horizont
const FULL_WIND_KMH = 60;

/**
 * Stimmung zur Szene aus den echten Messwerten: Wind (treibt Wolken, neigt Regen und Schnee)
 * und Dämmerung (warmer Horizont rund um Sonnenauf- und -untergang).
 */
export function ambienceFor({ windSpeed = null, sunrise = null, sunset = null, nowIso = null } = {}) {
  const wind = typeof windSpeed === 'number' && Number.isFinite(windSpeed)
    ? Math.min(1, Math.max(0, windSpeed / FULL_WIND_KMH))
    : 0.15;

  let twilight = 0;
  let dusk = false;
  if (nowIso) {
    const near = (iso) => {
      if (!iso) return 0;
      const minutes = Math.abs(minutesBetween(iso, nowIso));
      return Number.isFinite(minutes) ? Math.max(0, 1 - minutes / TWILIGHT_MIN) : 0;
    };
    const dawn = near(sunrise);
    const evening = near(sunset);
    twilight = Math.max(dawn, evening);
    dusk = evening > dawn;
  }
  return { wind, twilight, dusk };
}

const EMPTY = { sun: 0, stars: 0, clouds: 0, rain: 0, snow: 0, fog: 0, thunder: false };

// Code → [Art, Stärke]
const KINDS = {
  0: ['clear', 0],
  1: ['clear', 0.2],
  2: ['partly', 0.5],
  3: ['cloudy', 1],
  45: ['fog', 0.8],
  48: ['fog', 1],
  51: ['rain', 0.15],
  53: ['rain', 0.25],
  55: ['rain', 0.35],
  56: ['sleet', 0.3],
  57: ['sleet', 0.45],
  61: ['rain', 0.45],
  63: ['rain', 0.7],
  65: ['rain', 1],
  66: ['sleet', 0.45],
  67: ['sleet', 0.7],
  71: ['snow', 0.35],
  73: ['snow', 0.65],
  75: ['snow', 1],
  77: ['snow', 0.3],
  80: ['rain', 0.5],
  81: ['rain', 0.75],
  82: ['rain', 1],
  85: ['snow', 0.5],
  86: ['snow', 0.9],
  95: ['thunder', 0.85],
  96: ['thunder', 0.95],
  99: ['thunder', 1],
};

export const SCENE_NAMES = [
  'none',
  'clear-day', 'clear-night',
  'partly-day', 'partly-night',
  'cloudy-day', 'cloudy-night',
  'fog-day', 'fog-night',
  'rain-day', 'rain-night',
  'snow-day', 'snow-night',
  'thunder',
];

export function sceneFor(code, isDay) {
  const night = !isDay;
  const kind = KINDS[code];
  if (!kind) return { name: 'none', night, ...EMPTY };

  const [type, amount] = kind;
  const suffix = night ? 'night' : 'day';
  const light = (value) => (night ? { stars: value } : { sun: value });

  switch (type) {
    case 'clear':
      return { name: `clear-${suffix}`, night, ...EMPTY, ...light(1), clouds: amount };
    case 'partly':
      return { name: `partly-${suffix}`, night, ...EMPTY, ...light(0.6), clouds: amount };
    case 'cloudy':
      return { name: `cloudy-${suffix}`, night, ...EMPTY, clouds: amount };
    case 'fog':
      return { name: `fog-${suffix}`, night, ...EMPTY, clouds: 0.3, fog: amount };
    case 'rain':
      return { name: `rain-${suffix}`, night, ...EMPTY, clouds: 0.9, rain: amount };
    case 'sleet':
      return { name: `rain-${suffix}`, night, ...EMPTY, clouds: 0.9, rain: amount, snow: amount * 0.6 };
    case 'snow':
      return { name: `snow-${suffix}`, night, ...EMPTY, clouds: 0.8, snow: amount };
    default:
      return { name: 'thunder', night, ...EMPTY, clouds: 1, rain: amount, thunder: true };
  }
}
