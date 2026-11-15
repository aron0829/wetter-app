// Erzeugt die App-Icons aus dem Wettericon "partly-day": npm run icons
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { iconBody } from '../public/js/icons.js';

const out = fileURLToPath(new URL('../public/icons/', import.meta.url));

/** scale: Größe des Motivs (64er-Raster × scale); radius: Eckenrundung des Hintergrunds. */
function svg({ scale, radius }) {
  const offset = (512 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#101130"/><stop offset="0.55" stop-color="#1a1d55"/><stop offset="1" stop-color="#2b2f8f"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset - 6}) scale(${scale})">${iconBody('partly-day')}</g>
</svg>`;
}

const rounded = svg({ scale: 6.4, radius: 112 });
const fullBleed = svg({ scale: 5.2, radius: 0 }); // Motiv bleibt in der sicheren Zone (80 %)

await mkdir(out, { recursive: true });
await writeFile(`${out}icon.svg`, rounded);

const png = (source, size, name) => sharp(Buffer.from(source), { density: 300 })
  .resize(size, size)
  .png({ compressionLevel: 9 })
  .toFile(`${out}${name}`);

await Promise.all([
  png(rounded, 192, 'icon-192.png'),
  png(rounded, 512, 'icon-512.png'),
  png(fullBleed, 512, 'icon-maskable-512.png'),
  png(svg({ scale: 5.8, radius: 0 }), 180, 'apple-touch-icon.png'),
]);
console.log('Icons geschrieben nach public/icons/');
