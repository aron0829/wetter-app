import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const sw = readFileSync(`${root}sw.js`, 'utf8');
const assets = [...sw.matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]).filter((p) => p !== './');

const walk = (dir) => readdirSync(root + dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));

test('jede Datei der Precache-Liste existiert', () => {
  assert.ok(assets.length > 10);
  for (const path of assets) assert.ok(existsSync(root + path), `${path} fehlt`);
});

test('alle Skripte und Stile der App stehen in der Precache-Liste', () => {
  for (const path of [...walk('js'), ...walk('css')]) {
    assert.ok(assets.includes(path), `${path} fehlt in sw.js – sonst läuft die App offline nicht`);
  }
});

test('das Manifest verweist auf vorhandene Icons', () => {
  const manifest = JSON.parse(readFileSync(`${root}manifest.webmanifest`, 'utf8'));
  assert.equal(manifest.lang, 'de');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of manifest.icons) assert.ok(existsSync(root + icon.src), `${icon.src} fehlt`);
});
