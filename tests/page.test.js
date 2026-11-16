import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../public/js/model.js';
import { renderTop } from '../public/js/ui/page.js';
import { makeForecast } from './fixtures/forecast.js';

const NOW = '2026-11-15T22:45';
const PLACE = { id: 'p', name: 'Málaga', admin1: 'Andalusien', country: 'Spanien', lat: 36.7, lon: -4.4 };
const META = { nowIso: NOW, clock: '22:45', fetchedAt: 0, error: null };

function hourColumns(forecast) {
  const html = renderTop(PLACE, buildModel(forecast, NOW), META);
  return html.split(/<div class="hour(?: is-[a-z]+)?">/).slice(1).map((part) => part.split('</div>')[0]);
}

test('Stundenleiste zeigt die Niederschlagsmenge unter der Wahrscheinlichkeit', () => {
  const f = makeForecast();
  const start = f.hourly.time.indexOf('2026-11-15T22:00');
  f.hourly.precipitation[start + 1] = 1.26;
  f.hourly.precipitation_probability[start + 1] = 80;

  const cols = hourColumns(f);
  assert.equal(cols.length, 24);
  assert.match(cols[1], /80 %<\/span><small>1,3 mm<\/small>/);
});

test('trockene Stunden bleiben ohne Mengenangabe', () => {
  const f = makeForecast();
  const start = f.hourly.time.indexOf('2026-11-15T22:00');
  f.hourly.precipitation[start + 2] = 0.04;
  f.hourly.precipitation[start + 3] = null;

  const cols = hourColumns(f);
  for (const i of [0, 2, 3]) assert.ok(!cols[i].includes(' mm'), `Spalte ${i}`);
});
