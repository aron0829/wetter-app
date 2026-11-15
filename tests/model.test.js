import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModel, nightCode, fmtTemp, fmtPct, fmtMm, fmtKmh,
  uvLabel, windDirLabel, windText, aqiLabel, pollenLevel,
} from '../public/js/model.js';
import { makeForecast } from './fixtures/forecast.js';

const NOW = '2026-11-15T22:45';

test('hours beginnt bei der aktuellen Ortsstunde und umfasst 48 Stunden', () => {
  const m = buildModel(makeForecast(), NOW);
  assert.equal(m.hours.length, 48);
  assert.equal(m.hours[0].time, '2026-11-15T22:00');
  assert.equal(m.hours[0].hhmm, '22:00');
  assert.equal(m.hours[47].time, '2026-11-17T21:00');
});

test('Tageswechsel wird in der Stundenleiste markiert', () => {
  const m = buildModel(makeForecast(), NOW);
  assert.equal(m.hours[0].newDay, null);
  assert.equal(m.hours[2].time, '2026-11-16T00:00');
  assert.equal(m.hours[2].newDay, 'Mo.');
});

test('days beschriftet Gestern, Heute und Wochentage nach Ortsdatum', () => {
  const m = buildModel(makeForecast(), NOW);
  assert.equal(m.days[0].label, 'Gestern');
  assert.equal(m.days[0].isPast, true);
  assert.equal(m.days[1].label, 'Heute');
  assert.equal(m.days[1].isPast, false);
  assert.equal(m.days[2].label, 'Mo.');
  assert.equal(m.today.date, '2026-11-15');
  assert.equal(m.today.max, 21);
  assert.equal(m.today.min, 11);
  assert.equal(m.today.sunrise, '2026-11-15T08:03');
});

test('Ortszeit entscheidet über "Heute", auch wenn das Gerät schon am nächsten Tag ist', () => {
  // Gerät in Europa: 16.11. 02:30 – in São Paulo ist noch der 15.11.
  const f = makeForecast({ timezone: 'America/Sao_Paulo', current: '2026-11-15T22:30' });
  const m = buildModel(f, '2026-11-15T22:30');
  assert.equal(m.today.date, '2026-11-15');
  assert.equal(m.hours[0].time, '2026-11-15T22:00');
});

test('current übernimmt die aktuellen Werte samt Text und Nacht-Icon', () => {
  const m = buildModel(makeForecast(), NOW);
  assert.equal(m.current.temp, 17.4);
  assert.equal(m.current.feels, 16.2);
  assert.equal(m.current.text, 'Teilweise bewölkt');
  assert.equal(m.current.icon, 'partly-night');
  assert.equal(m.current.isDay, false);
  assert.equal(m.current.windDir, 247);
  assert.equal(m.current.humidity, 73);
});

test('ohne current-Block werden die Werte der aktuellen Stunde genutzt', () => {
  const f = makeForecast();
  delete f.current;
  const m = buildModel(f, NOW);
  assert.equal(m.current.code, 3);
  assert.equal(m.current.isDay, false);
  assert.ok(Math.abs(m.current.temp - 13.2) < 1e-9);
});

test('null-Werte bleiben null und werden als Strich formatiert', () => {
  const f = makeForecast();
  const i = f.hourly.time.indexOf('2026-11-15T23:00');
  f.hourly.precipitation_probability[i] = null;
  f.hourly.uv_index[i] = null;
  f.daily.precipitation_probability_max[1] = null;
  const m = buildModel(f, NOW);
  assert.equal(m.hours[1].pop, null);
  assert.equal(m.hours[1].uv, null);
  assert.equal(m.today.pop, null);
  assert.equal(fmtPct(null), '–');
  assert.equal(fmtTemp(undefined), '–');
  assert.equal(fmtMm(null), '–');
  assert.equal(fmtKmh(NaN), '–');
});

test('Formatierer runden deutsch und ohne negatives Null', () => {
  assert.equal(fmtTemp(17.4), '17°');
  assert.equal(fmtTemp(-0.4), '0°');
  assert.equal(fmtTemp(-3.6), '-4°');
  assert.equal(fmtPct(61.2), '61 %');
  assert.equal(fmtMm(0.44), '0,4 mm');
  assert.equal(fmtMm(12), '12,0 mm');
  assert.equal(fmtKmh(6.4), '6 km/h');
});

test('Zeitpunkt außerhalb des Datenbereichs führt nicht zum Absturz', () => {
  const m = buildModel(makeForecast(), '2030-01-01T12:00');
  assert.equal(m.hours[0].time, '2026-11-14T00:00');
  assert.ok(m.today);
  assert.ok(m.current);
});

test('fehlende Sonnenzeiten ergeben null', () => {
  const m = buildModel(makeForecast({ withSun: false }), NOW);
  assert.equal(m.today.sunrise, null);
  assert.equal(m.today.sunset, null);
});

test('leere oder kaputte Antwort wirft einen verständlichen Fehler', () => {
  assert.throws(() => buildModel({}, NOW), /Wetterdaten/);
  assert.throws(() => buildModel(null, NOW), /Wetterdaten/);
});

test('nightCode nimmt den häufigsten Code der Nacht, bei Gleichstand den schwereren', () => {
  // Nacht = 20–23 Uhr des Tages + 00–05 Uhr des Folgetags (10 Stunden)
  const sixFour = makeForecast({
    hourlyCode: (t) => (t >= '2026-11-15T20:00' && t <= '2026-11-16T01:00' ? 3 : 61),
  });
  assert.equal(nightCode(sixFour.hourly, '2026-11-15'), 3);
  const fiveFive = makeForecast({
    hourlyCode: (t) => (t >= '2026-11-15T20:00' && t <= '2026-11-16T00:00' ? 3 : 61),
  });
  assert.equal(nightCode(fiveFive.hourly, '2026-11-15'), 61);
  assert.equal(nightCode(sixFour.hourly, '2031-01-01'), null);
});

test('Nacht-Icon der Tagesliste stammt aus den Nachtstunden', () => {
  const f = makeForecast({
    hourlyCode: (t) => (t >= '2026-11-15T20:00' && t <= '2026-11-16T05:00' ? 0 : 3),
  });
  const m = buildModel(f, NOW);
  assert.equal(m.today.dayIcon, 'cloudy');
  assert.equal(m.today.nightIcon, 'clear-night');
});

test('Windrichtung 16-teilig auf Deutsch', () => {
  assert.equal(windDirLabel(0), 'N');
  assert.equal(windDirLabel(360), 'N');
  assert.equal(windDirLabel(90), 'O');
  assert.equal(windDirLabel(247.5), 'WSW');
  assert.equal(windDirLabel(22.5), 'NNO');
  assert.equal(windDirLabel(null), '–');
});

test('Beschriftungen für UV, Wind, Luftqualität und Pollen', () => {
  assert.equal(uvLabel(0), 'Niedrig');
  assert.equal(uvLabel(2.9), 'Niedrig');
  assert.equal(uvLabel(3), 'Mäßig');
  assert.equal(uvLabel(7.5), 'Hoch');
  assert.equal(uvLabel(9), 'Sehr hoch');
  assert.equal(uvLabel(11), 'Extrem');
  assert.equal(uvLabel(null), '–');
  assert.equal(windText(1), 'Windstill');
  assert.equal(windText(6), 'Es ist ruhig');
  assert.equal(windText(80), 'Sturm');
  assert.equal(aqiLabel(20), 'Sehr gut');
  assert.equal(aqiLabel(35), 'Gut');
  assert.equal(aqiLabel(120), 'Extrem schlecht');
  assert.equal(aqiLabel(null), '–');
  assert.equal(pollenLevel(null), null);
  assert.equal(pollenLevel(0.5), 'Keine');
  assert.equal(pollenLevel(5), 'Gering');
  assert.equal(pollenLevel(30), 'Mäßig');
  assert.equal(pollenLevel(200), 'Hoch');
});

test('summary nennt Wetterlage und Tiefsttemperatur', () => {
  const m = buildModel(makeForecast(), NOW);
  assert.match(m.summary, /bedeckt/i);
  assert.match(m.summary, /Tiefsttemperatur \d+°/);
});

test('summary kündigt Regen in den nächsten Stunden an', () => {
  const f = makeForecast({
    hourlyCode: (t) => (t >= '2026-11-16T03:00' && t <= '2026-11-16T06:00' ? 63 : 3),
  });
  const m = buildModel(f, NOW);
  assert.match(m.summary, /Regen ab ca\. 3 Uhr/);
});

test('Feuchtigkeit von gestern zur selben Stunde wird für den Vergleich mitgeliefert', () => {
  const f = makeForecast();
  f.hourly.relative_humidity_2m[f.hourly.time.indexOf('2026-11-14T22:00')] = 55;
  assert.equal(buildModel(f, NOW).current.humidityYesterday, 55);
  assert.equal(buildModel(f, '2026-11-14T05:10').current.humidityYesterday, null);
});

test('Niederschlag der nächsten 24 Stunden wird summiert', () => {
  const f = makeForecast();
  const i = f.hourly.time.indexOf('2026-11-16T03:00');
  f.hourly.precipitation[i] = 1.2;
  f.hourly.precipitation[i + 1] = 0.3;
  f.hourly.precipitation[i + 30] = 9;
  assert.ok(Math.abs(buildModel(f, NOW).precipNext24 - 1.5) < 1e-9);
});
