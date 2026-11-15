import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWeather, severity, WMO_CODES } from '../public/js/weathercodes.js';
import { ICON_NAMES, iconSvg } from '../public/js/icons.js';

const ALL = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

test('alle 28 WMO-Codes sind abgedeckt', () => {
  assert.deepEqual([...WMO_CODES].sort((a, b) => a - b), ALL);
});

test('jeder Code hat für Tag und Nacht Text und ein vorhandenes Icon', () => {
  for (const code of ALL) {
    for (const isDay of [true, false]) {
      const w = describeWeather(code, isDay);
      assert.ok(w.text.length > 2, `Text für ${code}`);
      assert.ok(ICON_NAMES.includes(w.icon), `Icon ${w.icon} für ${code} fehlt`);
    }
  }
});

test('Tag- und Nachtvarianten unterscheiden sich bei klarem und wechselhaftem Wetter', () => {
  assert.deepEqual(describeWeather(0, true), { text: 'Sonnig', icon: 'clear-day' });
  assert.deepEqual(describeWeather(0, false), { text: 'Klar', icon: 'clear-night' });
  assert.equal(describeWeather(2, true).icon, 'partly-day');
  assert.equal(describeWeather(2, false).icon, 'partly-night');
  assert.equal(describeWeather(80, false).icon, 'showers-night');
  assert.equal(describeWeather(3, true).icon, describeWeather(3, false).icon);
});

test('deutsche Beschreibungen', () => {
  assert.equal(describeWeather(3, true).text, 'Bedeckt');
  assert.equal(describeWeather(45, true).text, 'Nebel');
  assert.equal(describeWeather(63, true).text, 'Regen');
  assert.equal(describeWeather(75, true).text, 'Starker Schneefall');
  assert.equal(describeWeather(95, false).text, 'Gewitter');
  assert.equal(describeWeather(99, true).text, 'Gewitter mit Hagel');
});

test('unbekannte oder fehlende Codes brechen nichts', () => {
  assert.deepEqual(describeWeather(123, true), { text: 'Unbekannt', icon: 'cloudy' });
  assert.deepEqual(describeWeather(null, false), { text: 'Unbekannt', icon: 'cloudy' });
});

test('severity ordnet Gewitter über Regen über Wolken über klar', () => {
  assert.ok(severity(95) > severity(63));
  assert.ok(severity(63) > severity(3));
  assert.ok(severity(3) > severity(0));
  assert.equal(severity(123), 0);
});

test('iconSvg liefert für jeden Namen ein SVG', () => {
  for (const name of ICON_NAMES) {
    const svg = iconSvg(name);
    assert.ok(svg.startsWith('<svg'), name);
    assert.ok(svg.endsWith('</svg>'), name);
  }
  assert.ok(iconSvg('gibt-es-nicht').startsWith('<svg'));
});
