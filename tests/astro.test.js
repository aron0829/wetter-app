import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonPhase, daylight, sunPosition } from '../public/js/astro.js';

test('Neumond und Vollmond werden erkannt', () => {
  const neu = moonPhase(new Date('2000-01-06T18:14:00Z'));
  assert.equal(neu.name, 'Neumond');
  assert.ok(neu.illumination < 0.02);
  const voll = moonPhase(new Date('2000-01-21T04:40:00Z'));
  assert.equal(voll.name, 'Vollmond');
  assert.ok(voll.illumination > 0.98);
});

test('bekannte Mondphasen der Gegenwart', () => {
  // Vollmond 24.11.2026, Neumond 09.11.2026, erstes Viertel 17.11.2026
  assert.equal(moonPhase(new Date('2026-11-24T14:53:00Z')).name, 'Vollmond');
  assert.equal(moonPhase(new Date('2026-11-09T07:02:00Z')).name, 'Neumond');
  assert.equal(moonPhase(new Date('2026-11-13T12:00:00Z')).name, 'Zunehmende Sichel');
  assert.equal(moonPhase(new Date('2026-11-20T12:00:00Z')).name, 'Zunehmender Mond');
  assert.equal(moonPhase(new Date('2026-11-28T12:00:00Z')).name, 'Abnehmender Mond');
  assert.equal(moonPhase(new Date('2026-12-05T12:00:00Z')).name, 'Abnehmende Sichel');
});

test('phase liegt immer zwischen 0 und 1', () => {
  for (const iso of ['1990-05-01T00:00:00Z', '2026-11-15T22:00:00Z', '2040-12-31T23:59:00Z']) {
    const m = moonPhase(new Date(iso));
    assert.ok(m.phase >= 0 && m.phase < 1, iso);
    assert.ok(m.illumination >= 0 && m.illumination <= 1, iso);
  }
});

test('daylight berechnet die Tageslänge', () => {
  assert.deepEqual(daylight('2026-11-15T08:03', '2026-11-15T18:13'), { minutes: 610, label: '10 h 10 min' });
  assert.equal(daylight('2026-06-21T05:00', '2026-06-21T21:03').label, '16 h 03 min');
});

test('daylight verträgt Polartag und Polarnacht', () => {
  assert.equal(daylight(null, '2026-11-15T18:13'), null);
  assert.equal(daylight(undefined, undefined), null);
  assert.equal(daylight('2026-12-21T12:00', '2026-12-21T12:00').minutes, 0);
  assert.equal(daylight('2026-12-21T12:00', '2026-12-21T11:00'), null);
});

test('sunPosition gibt den Fortschritt zwischen Auf- und Untergang an', () => {
  assert.equal(sunPosition('2026-11-15T08:00', '2026-11-15T18:00', '2026-11-15T13:00'), 0.5);
  assert.equal(sunPosition('2026-11-15T08:00', '2026-11-15T18:00', '2026-11-15T08:00'), 0);
  assert.ok(sunPosition('2026-11-15T08:00', '2026-11-15T18:00', '2026-11-15T22:00') > 1);
  assert.ok(sunPosition('2026-11-15T08:00', '2026-11-15T18:00', '2026-11-15T05:00') < 0);
  assert.equal(sunPosition(null, null, '2026-11-15T05:00'), null);
});
