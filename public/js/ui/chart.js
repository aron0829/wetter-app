// Temperaturkurve unter der Stundenleiste: ein Punkt je Spalte, weich verbunden.
import { fmtTemp } from '../model.js';

export function tempCurve(temps, colWidth, height = 64) {
  const known = temps.filter((t) => t !== null);
  if (!known.length) return '';
  const min = Math.min(...known);
  const max = Math.max(...known);
  const top = 24;
  const bottom = height - 8;
  const span = max - min || 1;
  const yOf = (t) => (max === min ? (top + bottom) / 2 : bottom - ((t - min) / span) * (bottom - top));

  // Lücken mit dem zuletzt bekannten Wert überbrücken, damit die Linie nicht abreißt.
  let last = known[0];
  const pts = temps.map((t, i) => {
    if (t !== null) last = t;
    return { x: i * colWidth + colWidth / 2, y: yOf(last), label: fmtTemp(t) };
  });

  let d = `M${pts[0].x} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid = (a.x + b.x) / 2;
    d += `C${mid} ${a.y.toFixed(1)} ${mid} ${b.y.toFixed(1)} ${b.x} ${b.y.toFixed(1)}`;
  }

  const marks = pts.map((p) => `<circle cx="${p.x}" cy="${p.y.toFixed(1)}" r="3.2"/>`
    + `<text x="${p.x}" y="${(p.y - 9).toFixed(1)}">${p.label}</text>`).join('');
  const width = temps.length * colWidth;
  return `<svg class="curve" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`
    + `<path d="${d}"/>${marks}</svg>`;
}
