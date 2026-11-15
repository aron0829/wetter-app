// Datenquellen: Open-Meteo (Vorhersage, Luftqualität, Ortssuche), Nominatim (Ortsname zum
// aktuellen Standort) und RainViewer (Radar). Alle ohne API-Schlüssel.

const CURRENT = ['temperature_2m', 'apparent_temperature', 'is_day', 'weather_code',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'relative_humidity_2m',
  'precipitation', 'uv_index'];
const HOURLY = ['temperature_2m', 'apparent_temperature', 'precipitation',
  'precipitation_probability', 'wind_speed_10m', 'wind_direction_10m', 'weather_code',
  'uv_index', 'is_day', 'relative_humidity_2m'];
const DAILY = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max'];
const AIR = ['european_aqi', 'pm10', 'pm2_5', 'alder_pollen', 'birch_pollen', 'grass_pollen',
  'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];

export const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';

function build(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

export function forecastUrl(lat, lon) {
  return build('https://api.open-meteo.com/v1/forecast', {
    latitude: lat,
    longitude: lon,
    models: 'best_match',
    timezone: 'auto',
    past_days: 1,
    forecast_days: 8,
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
  });
}

export function airQualityUrl(lat, lon) {
  return build('https://air-quality-api.open-meteo.com/v1/air-quality', {
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    current: AIR.join(','),
  });
}

export function geocodeUrl(query) {
  return build('https://geocoding-api.open-meteo.com/v1/search', {
    name: query.trim(),
    count: 8,
    language: 'de',
    format: 'json',
  });
}

export function reverseUrl(lat, lon) {
  return build('https://nominatim.openstreetmap.org/reverse', {
    lat,
    lon,
    format: 'jsonv2',
    zoom: 12,
    addressdetails: 1,
    'accept-language': 'de',
  });
}

export function placeFromGeocoding(r) {
  return {
    id: `geo-${r.id}`,
    name: r.name,
    admin1: r.admin1 ?? null,
    country: r.country ?? null,
    countryCode: r.country_code ?? null,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone ?? null,
  };
}

export function parseReverse(json) {
  const a = json?.address || {};
  return {
    name: a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb
      || a.county || json?.name || null,
    admin1: a.state || a.region || a.province || null,
    country: a.country || null,
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
  };
}

export function parseRadar(json) {
  const frame = (kind) => (f) => ({ time: f.time, path: f.path, kind });
  const ok = (f) => f && Number.isFinite(f.time) && typeof f.path === 'string';
  const past = (json?.radar?.past || []).filter(ok).map(frame('past'));
  const nowcast = (json?.radar?.nowcast || []).filter(ok).map(frame('nowcast'));
  const byTime = (a, b) => a.time - b.time;
  return {
    host: typeof json?.host === 'string' ? json.host : '',
    frames: [...past.sort(byTime), ...nowcast.sort(byTime)],
  };
}

/** Kachelvorlage für Leaflet: Größe 256, Farbschema 2 (Universal Blue), geglättet, mit Schnee. */
export function radarTileUrl(host, path) {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

// ------------------------------------------------------------ Netzwerk

async function getJson(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Server antwortet mit ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Zeitüberschreitung beim Laden');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchForecast = (lat, lon) => getJson(forecastUrl(lat, lon));
export const fetchAirQuality = (lat, lon) => getJson(airQualityUrl(lat, lon));

export async function searchPlaces(query) {
  const json = await getJson(geocodeUrl(query));
  return (json.results || []).map(placeFromGeocoding);
}

export async function reverseGeocode(lat, lon) {
  return parseReverse(await getJson(reverseUrl(lat, lon)));
}

export async function fetchRadar() {
  return parseRadar(await getJson(RAINVIEWER_URL));
}
