// Mondphase (aus der mittleren synodischen Periode) und Tageslicht.
import { minutesBetween } from './time.js';

const SYNODIC_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(date = new Date()) {
  const days = (date.getTime() - REFERENCE_NEW_MOON) / 86400000;
  const phase = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  let name;
  if (phase < 0.03 || phase >= 0.97) name = 'Neumond';
  else if (phase < 0.22) name = 'Zunehmende Sichel';
  else if (phase < 0.28) name = 'Erstes Viertel';
  else if (phase < 0.47) name = 'Zunehmender Mond';
  else if (phase < 0.53) name = 'Vollmond';
  else if (phase < 0.72) name = 'Abnehmender Mond';
  else if (phase < 0.78) name = 'Letztes Viertel';
  else name = 'Abnehmende Sichel';
  return { phase, illumination, name };
}

/** Tageslänge; null bei Polartag/Polarnacht oder fehlenden Daten. */
export function daylight(sunriseIso, sunsetIso) {
  if (!sunriseIso || !sunsetIso) return null;
  const minutes = minutesBetween(sunriseIso, sunsetIso);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const label = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
  return { minutes, label };
}

/** 0 = Sonnenaufgang, 1 = Sonnenuntergang; außerhalb des Tages <0 bzw. >1. */
export function sunPosition(sunriseIso, sunsetIso, nowIso) {
  const day = daylight(sunriseIso, sunsetIso);
  if (!day || day.minutes === 0) return null;
  return minutesBetween(sunriseIso, nowIso) / day.minutes;
}
