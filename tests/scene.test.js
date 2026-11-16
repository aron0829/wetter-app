import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENE_NAMES, ambienceFor, sceneFor } from '../public/js/scene.js';
import { WMO_CODES } from '../public/js/weathercodes.js';

const css = readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');

test('klarer Himmel: tags Sonne, nachts Sterne, kein Niederschlag', () => {
  const day = sceneFor(0, true);
  assert.equal(day.name, 'clear-day');
  assert.ok(day.sun > 0.9);
  assert.equal(day.stars, 0);
  assert.equal(day.rain, 0);
  assert.equal(day.snow, 0);

  const night = sceneFor(0, false);
  assert.equal(night.name, 'clear-night');
  assert.equal(night.sun, 0);
  assert.ok(night.stars > 0.9);
});

test('Bewölkung nimmt von heiter über wolkig bis bedeckt zu', () => {
  const clouds = [0, 1, 2, 3].map((code) => sceneFor(code, true).clouds);
  assert.deepEqual([...clouds].sort((a, b) => a - b), clouds);
  assert.ok(clouds[3] > clouds[0]);
  assert.equal(sceneFor(2, true).name, 'partly-day');
  assert.equal(sceneFor(2, false).name, 'partly-night');
  assert.equal(sceneFor(3, true).name, 'cloudy-day');
  assert.equal(sceneFor(3, true).sun, 0);
  assert.equal(sceneFor(3, false).stars, 0);
});

test('Regen: Stärke wächst mit dem Code, keine Sonne', () => {
  assert.equal(sceneFor(63, true).name, 'rain-day');
  assert.equal(sceneFor(63, false).name, 'rain-night');
  assert.ok(sceneFor(61, true).rain < sceneFor(63, true).rain);
  assert.ok(sceneFor(63, true).rain < sceneFor(65, true).rain);
  assert.ok(sceneFor(51, true).rain < sceneFor(61, true).rain);
  assert.ok(sceneFor(80, true).rain < sceneFor(82, true).rain);
  assert.equal(sceneFor(65, true).sun, 0);
  assert.equal(sceneFor(65, true).snow, 0);
});

test('Schnee, Schneeregen, Nebel und Gewitter haben eigene Szenen', () => {
  assert.equal(sceneFor(73, true).name, 'snow-day');
  assert.equal(sceneFor(73, false).name, 'snow-night');
  assert.ok(sceneFor(71, true).snow < sceneFor(75, true).snow);
  assert.equal(sceneFor(73, true).rain, 0);

  const sleet = sceneFor(66, true);
  assert.ok(sleet.rain > 0 && sleet.snow > 0);

  assert.equal(sceneFor(45, true).name, 'fog-day');
  assert.equal(sceneFor(48, false).name, 'fog-night');
  assert.ok(sceneFor(45, true).fog > 0);
  assert.equal(sceneFor(0, true).fog, 0);

  for (const code of [95, 96, 99]) {
    const s = sceneFor(code, true);
    assert.equal(s.name, 'thunder');
    assert.equal(s.thunder, true);
    assert.ok(s.rain > 0.5);
  }
  assert.equal(sceneFor(63, true).thunder, false);
});

test('jeder WMO-Code ergibt bei Tag und Nacht eine bekannte Szene mit gültigen Werten', () => {
  for (const code of WMO_CODES) {
    for (const isDay of [true, false]) {
      const s = sceneFor(code, isDay);
      assert.ok(SCENE_NAMES.includes(s.name), `${code}/${isDay}: ${s.name}`);
      assert.equal(s.night, !isDay);
      for (const key of ['sun', 'stars', 'clouds', 'rain', 'snow', 'fog']) {
        assert.ok(s[key] >= 0 && s[key] <= 1, `${key} für ${code}`);
      }
      if (!isDay) assert.equal(s.sun, 0, `nachts keine Sonne (${code})`);
      if (isDay) assert.equal(s.stars, 0, `tags keine Sterne (${code})`);
    }
  }
});

test('ohne Wetterdaten bleibt der Hintergrund ruhig', () => {
  for (const code of [null, undefined, 123]) {
    const s = sceneFor(code, true);
    assert.equal(s.name, 'none');
    assert.equal(s.sun + s.stars + s.clouds + s.rain + s.snow + s.fog, 0);
    assert.equal(s.thunder, false);
  }
});

test('für jede Szene gibt es Farben im Stylesheet', () => {
  for (const name of SCENE_NAMES) {
    if (name === 'none') continue;
    assert.ok(css.includes(`.scene-${name} {`) || css.includes(`.scene-${name},`), `.scene-${name} fehlt in app.css`);
  }
});

// ------------------------------------------------------------ Stimmung

const SUN = { sunrise: '2026-11-15T08:00', sunset: '2026-11-15T18:00' };

test('Wind: 0 bis 1, steigt mit der Geschwindigkeit, ohne Angabe leichte Brise', () => {
  assert.equal(ambienceFor({ windSpeed: 0, ...SUN, nowIso: '2026-11-15T12:00' }).wind, 0);
  assert.equal(ambienceFor({ windSpeed: 30, ...SUN, nowIso: '2026-11-15T12:00' }).wind, 0.5);
  assert.equal(ambienceFor({ windSpeed: 140, ...SUN, nowIso: '2026-11-15T12:00' }).wind, 1);
  const calm = ambienceFor({ windSpeed: null, ...SUN, nowIso: '2026-11-15T12:00' }).wind;
  assert.ok(calm > 0 && calm < 0.3);
});

test('Dämmerung: am stärksten zum Sonnenauf- und -untergang, mittags und nachts aus', () => {
  const at = (nowIso) => ambienceFor({ windSpeed: 5, ...SUN, nowIso });
  assert.deepEqual([at('2026-11-15T18:00').twilight, at('2026-11-15T18:00').dusk], [1, true]);
  assert.deepEqual([at('2026-11-15T08:00').twilight, at('2026-11-15T08:00').dusk], [1, false]);
  assert.ok(at('2026-11-15T17:40').twilight > 0.4);
  assert.ok(at('2026-11-15T17:40').twilight < at('2026-11-15T17:55').twilight);
  assert.ok(at('2026-11-15T18:20').twilight > 0.4);
  assert.equal(at('2026-11-15T12:00').twilight, 0);
  assert.equal(at('2026-11-15T23:30').twilight, 0);
  assert.equal(at('2026-11-15T07:10').twilight, 0);
});

test('ohne Sonnenzeiten (Polartag, fehlende Daten) gibt es keine Dämmerung', () => {
  const a = ambienceFor({ windSpeed: 5, sunrise: null, sunset: null, nowIso: '2026-11-15T18:00' });
  assert.equal(a.twilight, 0);
  assert.equal(ambienceFor().twilight, 0);
});
