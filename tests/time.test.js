import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nowInZone, dateKey, hourKey, addDays, formatTime, weekdayShort,
  formatClock, formatDateLine, formatUnix, minutesBetween,
} from '../public/js/time.js';

const instant = new Date('2026-11-16T01:30:00Z');

test('nowInZone liefert die Ortszeit, nicht die Gerätezeit', () => {
  assert.equal(nowInZone('America/Sao_Paulo', instant), '2026-11-15T22:30');
  assert.equal(nowInZone('Pacific/Auckland', instant), '2026-11-16T14:30');
  assert.equal(nowInZone('Europe/Berlin', instant), '2026-11-16T02:30');
});

test('nowInZone zeigt Mitternacht als 00, nicht als 24', () => {
  assert.equal(nowInZone('UTC', new Date('2026-11-16T00:05:00Z')), '2026-11-16T00:05');
});

test('nowInZone fällt bei ungültiger Zeitzone auf UTC zurück', () => {
  assert.equal(nowInZone('Nicht/Vorhanden', instant), '2026-11-16T01:30');
  assert.equal(nowInZone(null, instant), '2026-11-16T01:30');
});

test('dateKey und hourKey schneiden den ISO-String zu', () => {
  assert.equal(dateKey('2026-11-15T22:45'), '2026-11-15');
  assert.equal(hourKey('2026-11-15T22:45'), '2026-11-15T22:00');
});

test('addDays rechnet über Monats- und Jahresgrenzen', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-11-15', 0), '2026-11-15');
});

test('formatTime gibt HH:MM zurück', () => {
  assert.equal(formatTime('2026-11-15T08:03'), '08:03');
  assert.equal(formatTime(null), '–');
});

test('weekdayShort liefert deutsche Kürzel', () => {
  assert.equal(weekdayShort('2026-11-15'), 'So.');
  assert.equal(weekdayShort('2026-11-16'), 'Mo.');
  assert.equal(weekdayShort('2026-11-21'), 'Sa.');
});

test('formatClock und formatDateLine nutzen die Ortszeit', () => {
  const d = new Date('2026-11-15T20:27:00Z');
  assert.equal(formatClock('Europe/Madrid', d), '21:27');
  assert.equal(formatDateLine('Europe/Madrid', d), 'So., 15. November um 21:27');
  assert.equal(formatDateLine('Asia/Tokyo', d), 'Mo., 16. November um 05:27');
});

test('formatUnix formatiert Unix-Sekunden in Ortszeit', () => {
  const unix = Date.UTC(2026, 10, 15, 21, 0, 0) / 1000;
  assert.equal(formatUnix(unix, 'Europe/Berlin'), '22:00');
  assert.equal(formatUnix(unix, 'America/Bogota'), '16:00');
});

test('minutesBetween rechnet mit naiven Ortszeit-Strings', () => {
  assert.equal(minutesBetween('2026-11-15T08:03', '2026-11-15T18:13'), 610);
  assert.equal(minutesBetween('2026-11-15T23:30', '2026-11-16T00:30'), 60);
});
