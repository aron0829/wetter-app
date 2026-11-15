import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceStore, placeSubtitle, STORAGE_KEY } from '../public/js/places.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const place = (id, name = id) => ({
  id, name, admin1: 'Region', country: 'Land', countryCode: 'XX', lat: 1, lon: 2, timezone: 'UTC',
});

test('add speichert dauerhaft', () => {
  const storage = fakeStorage();
  const store = createPlaceStore(storage);
  assert.equal(store.add(place('a')), true);
  assert.equal(store.list().length, 1);
  assert.equal(createPlaceStore(storage).list()[0].id, 'a');
  assert.equal(STORAGE_KEY, 'wetter.places.v1');
  assert.ok(STORAGE_KEY in storage.data);
});

test('derselbe Ort wird nicht doppelt gespeichert', () => {
  const store = createPlaceStore(fakeStorage());
  store.add(place('a'));
  assert.equal(store.add(place('a')), false);
  assert.equal(store.list().length, 1);
  assert.equal(store.has('a'), true);
  assert.equal(store.has('b'), false);
});

test('remove löscht nur den gewählten Ort', () => {
  const store = createPlaceStore(fakeStorage());
  ['a', 'b', 'c'].forEach((id) => store.add(place(id)));
  store.remove('b');
  assert.deepEqual(store.list().map((p) => p.id), ['a', 'c']);
  store.remove('gibt-es-nicht');
  assert.equal(store.list().length, 2);
});

test('move ändert die Reihenfolge und klemmt den Index', () => {
  const storage = fakeStorage();
  const store = createPlaceStore(storage);
  ['a', 'b', 'c'].forEach((id) => store.add(place(id)));
  store.move('c', 0);
  assert.deepEqual(store.list().map((p) => p.id), ['c', 'a', 'b']);
  store.move('c', 99);
  assert.deepEqual(store.list().map((p) => p.id), ['a', 'b', 'c']);
  store.move('b', -5);
  assert.deepEqual(store.list().map((p) => p.id), ['b', 'a', 'c']);
  store.move('unbekannt', 0);
  assert.deepEqual(store.list().map((p) => p.id), ['b', 'a', 'c']);
  assert.deepEqual(createPlaceStore(storage).list().map((p) => p.id), ['b', 'a', 'c']);
});

test('list gibt eine Kopie zurück', () => {
  const store = createPlaceStore(fakeStorage());
  store.add(place('a'));
  store.list().pop();
  assert.equal(store.list().length, 1);
});

test('defekter Speicherinhalt ergibt eine leere Liste', () => {
  assert.deepEqual(createPlaceStore(fakeStorage({ 'wetter.places.v1': '{kaputt' })).list(), []);
  assert.deepEqual(createPlaceStore(fakeStorage({ 'wetter.places.v1': '{"a":1}' })).list(), []);
  const mixed = JSON.stringify([place('a'), null, { id: 'x' }, 42]);
  assert.deepEqual(
    createPlaceStore(fakeStorage({ 'wetter.places.v1': mixed })).list().map((p) => p.id),
    ['a'],
  );
});

test('voller oder gesperrter Speicher lässt die App weiterlaufen', () => {
  const storage = {
    getItem: () => { throw new Error('gesperrt'); },
    setItem: () => { throw new Error('voll'); },
  };
  const store = createPlaceStore(storage);
  assert.deepEqual(store.list(), []);
  assert.doesNotThrow(() => store.add(place('a')));
  assert.equal(store.list().length, 1);
});

test('placeSubtitle lässt fehlende Teile aus', () => {
  assert.equal(placeSubtitle({ admin1: 'Sachsen', country: 'Deutschland' }), 'Sachsen, Deutschland');
  assert.equal(placeSubtitle({ admin1: null, country: 'Spanien' }), 'Spanien');
  assert.equal(placeSubtitle({ admin1: null, country: null }), '');
  assert.equal(placeSubtitle({ name: 'Berlin', admin1: 'Berlin', country: 'Deutschland' }), 'Deutschland');
});
