import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forecastUrl, airQualityUrl, geocodeUrl, reverseUrl,
  placeFromGeocoding, parseReverse, parseRadar, radarTileUrl, wetterOnlineRadarUrl,
} from '../public/js/api.js';

test('forecastUrl nutzt best_match, Ortszeit und alle geforderten Variablen', () => {
  const url = new URL(forecastUrl(36.72, -4.42));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  const p = url.searchParams;
  assert.equal(p.get('latitude'), '36.72');
  assert.equal(p.get('longitude'), '-4.42');
  assert.equal(p.get('models'), 'best_match');
  assert.equal(p.get('timezone'), 'auto');
  assert.equal(p.get('past_days'), '1');
  assert.equal(p.get('forecast_days'), '8');
  assert.equal(p.get('wind_speed_unit'), 'kmh');
  assert.equal(p.get('temperature_unit'), 'celsius');
  const hourly = p.get('hourly').split(',');
  for (const v of ['temperature_2m', 'apparent_temperature', 'precipitation',
    'precipitation_probability', 'wind_speed_10m', 'weather_code', 'uv_index', 'is_day']) {
    assert.ok(hourly.includes(v), `hourly ${v}`);
  }
  const daily = p.get('daily').split(',');
  for (const v of ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
    'precipitation_probability_max', 'sunrise', 'sunset', 'weather_code']) {
    assert.ok(daily.includes(v), `daily ${v}`);
  }
  assert.ok(p.get('current').split(',').includes('temperature_2m'));
});

test('airQualityUrl fragt Luftqualität und Pollen in Ortszeit ab', () => {
  const url = new URL(airQualityUrl(51.05, 13.74));
  assert.equal(url.hostname, 'air-quality-api.open-meteo.com');
  assert.equal(url.searchParams.get('timezone'), 'auto');
  const current = url.searchParams.get('current').split(',');
  assert.ok(current.includes('european_aqi'));
  assert.ok(current.includes('grass_pollen'));
});

test('geocodeUrl kodiert die Suche und fordert deutsche Namen', () => {
  const url = new URL(geocodeUrl('  São Paulo '));
  assert.equal(url.hostname, 'geocoding-api.open-meteo.com');
  assert.equal(url.searchParams.get('name'), 'São Paulo');
  assert.equal(url.searchParams.get('language'), 'de');
  assert.equal(url.searchParams.get('count'), '8');
  assert.ok(geocodeUrl('São Paulo').includes('S%C3%A3o'));
});

test('reverseUrl fragt Nominatim auf Deutsch', () => {
  const url = new URL(reverseUrl(36.72, -4.42));
  assert.equal(url.hostname, 'nominatim.openstreetmap.org');
  assert.equal(url.searchParams.get('lat'), '36.72');
  assert.equal(url.searchParams.get('lon'), '-4.42');
  assert.equal(url.searchParams.get('accept-language'), 'de');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
});

test('placeFromGeocoding übernimmt Land, Region und Zeitzone', () => {
  const p = placeFromGeocoding({
    id: 2517744, name: 'Feria', latitude: 38.51151, longitude: -6.56416,
    country_code: 'ES', country: 'Spanien', admin1: 'Estremadura', timezone: 'Europe/Madrid',
  });
  assert.deepEqual(p, {
    id: 'geo-2517744', name: 'Feria', admin1: 'Estremadura', country: 'Spanien',
    countryCode: 'ES', lat: 38.51151, lon: -6.56416, timezone: 'Europe/Madrid',
  });
});

test('placeFromGeocoding verträgt Treffer ohne Region und Land', () => {
  const p = placeFromGeocoding({ id: 1, name: 'Irgendwo', latitude: 0, longitude: 0 });
  assert.equal(p.admin1, null);
  assert.equal(p.country, null);
  assert.equal(p.countryCode, null);
  assert.equal(p.timezone, null);
});

test('parseReverse bevorzugt Stadt vor Gemeinde und Dorf', () => {
  const base = { state: 'Andalusien', country: 'Spanien', country_code: 'es' };
  assert.deepEqual(parseReverse({ address: { city: 'Málaga', town: 'X', ...base } }), {
    name: 'Málaga', admin1: 'Andalusien', country: 'Spanien', countryCode: 'ES',
  });
  assert.equal(parseReverse({ address: { town: 'Nerja', village: 'Y', ...base } }).name, 'Nerja');
  assert.equal(parseReverse({ address: { village: 'Frigiliana', ...base } }).name, 'Frigiliana');
  assert.equal(parseReverse({ address: { municipality: 'Gemeinde', ...base } }).name, 'Gemeinde');
  assert.equal(parseReverse({ name: 'Punkt', address: {} }).name, 'Punkt');
  assert.deepEqual(parseReverse({}), { name: null, admin1: null, country: null, countryCode: null });
  assert.deepEqual(parseReverse(null), { name: null, admin1: null, country: null, countryCode: null });
});

test('parseRadar verträgt leeren Nowcast', () => {
  const r = parseRadar({
    host: 'https://tilecache.rainviewer.com',
    radar: { past: [{ time: 2, path: '/b' }, { time: 1, path: '/a' }], nowcast: [] },
  });
  assert.equal(r.host, 'https://tilecache.rainviewer.com');
  assert.deepEqual(r.frames, [
    { time: 1, path: '/a', kind: 'past' },
    { time: 2, path: '/b', kind: 'past' },
  ]);
});

test('parseRadar hängt Nowcast-Frames als Vorhersage an', () => {
  const r = parseRadar({
    host: 'h',
    radar: { past: [{ time: 1, path: '/a' }], nowcast: [{ time: 5, path: '/n' }] },
  });
  assert.deepEqual(r.frames.map((f) => f.kind), ['past', 'nowcast']);
});

test('parseRadar verträgt leere Antworten', () => {
  assert.deepEqual(parseRadar({}), { host: '', frames: [] });
  assert.deepEqual(parseRadar(null), { host: '', frames: [] });
});

test('radarTileUrl baut die Leaflet-Kachelvorlage', () => {
  assert.equal(
    radarTileUrl('https://tilecache.rainviewer.com', '/v2/radar/abc'),
    'https://tilecache.rainviewer.com/v2/radar/abc/256/{z}/{x}/{y}/2/1_1.png',
  );
});

test('wetterOnlineRadarUrl zentriert das WetterRadar auf den Ort, Koordinaten auf rund 1 km gerundet', () => {
  assert.equal(
    wetterOnlineRadarUrl(51.05089, 13.73832),
    'https://www.wetteronline.de/wetterradar?wrx=51.05,13.74&wrm=8',
  );
  assert.equal(
    wetterOnlineRadarUrl(-33.4489, -70.6693),
    'https://www.wetteronline.de/wetterradar?wrx=-33.45,-70.67&wrm=8',
  );
});
