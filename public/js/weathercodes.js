// WMO-Wettercodes (Open-Meteo "weather_code") → deutsche Beschreibung + Icon.
// Eintrag: [Text Tag, Text Nacht, Icon Tag, Icon Nacht, Schwere]

const TABLE = {
  0: ['Sonnig', 'Klar', 'clear-day', 'clear-night', 0],
  1: ['Heiter', 'Überwiegend klar', 'mostly-clear-day', 'mostly-clear-night', 1],
  2: ['Teilweise bewölkt', 'Teilweise bewölkt', 'partly-day', 'partly-night', 2],
  3: ['Bedeckt', 'Bedeckt', 'cloudy', 'cloudy', 3],
  45: ['Nebel', 'Nebel', 'fog', 'fog', 4],
  48: ['Reifnebel', 'Reifnebel', 'fog', 'fog', 5],
  51: ['Leichter Nieselregen', 'Leichter Nieselregen', 'drizzle', 'drizzle', 10],
  53: ['Nieselregen', 'Nieselregen', 'drizzle', 'drizzle', 11],
  55: ['Starker Nieselregen', 'Starker Nieselregen', 'drizzle', 'drizzle', 12],
  56: ['Leichter gefrierender Nieselregen', 'Leichter gefrierender Nieselregen', 'sleet', 'sleet', 20],
  57: ['Gefrierender Nieselregen', 'Gefrierender Nieselregen', 'sleet', 'sleet', 21],
  61: ['Leichter Regen', 'Leichter Regen', 'rain', 'rain', 13],
  63: ['Regen', 'Regen', 'rain', 'rain', 15],
  65: ['Starker Regen', 'Starker Regen', 'heavy-rain', 'heavy-rain', 18],
  66: ['Leichter gefrierender Regen', 'Leichter gefrierender Regen', 'sleet', 'sleet', 22],
  67: ['Gefrierender Regen', 'Gefrierender Regen', 'sleet', 'sleet', 23],
  71: ['Leichter Schneefall', 'Leichter Schneefall', 'snow', 'snow', 24],
  73: ['Schneefall', 'Schneefall', 'snow', 'snow', 25],
  75: ['Starker Schneefall', 'Starker Schneefall', 'snow', 'snow', 27],
  77: ['Schneegriesel', 'Schneegriesel', 'snow', 'snow', 24],
  80: ['Leichte Regenschauer', 'Leichte Regenschauer', 'showers-day', 'showers-night', 14],
  81: ['Regenschauer', 'Regenschauer', 'showers-day', 'showers-night', 16],
  82: ['Heftige Regenschauer', 'Heftige Regenschauer', 'heavy-rain', 'heavy-rain', 19],
  85: ['Leichte Schneeschauer', 'Leichte Schneeschauer', 'snow-showers-day', 'snow-showers-night', 25],
  86: ['Starke Schneeschauer', 'Starke Schneeschauer', 'snow-showers-day', 'snow-showers-night', 26],
  95: ['Gewitter', 'Gewitter', 'thunder', 'thunder', 30],
  96: ['Gewitter mit leichtem Hagel', 'Gewitter mit leichtem Hagel', 'thunder-hail', 'thunder-hail', 31],
  99: ['Gewitter mit Hagel', 'Gewitter mit Hagel', 'thunder-hail', 'thunder-hail', 32],
};

export const WMO_CODES = Object.keys(TABLE).map(Number);

export function describeWeather(code, isDay) {
  const row = TABLE[code];
  if (!row) return { text: 'Unbekannt', icon: 'cloudy' };
  return { text: isDay ? row[0] : row[1], icon: isDay ? row[2] : row[3] };
}

/** Höher = "schlimmeres" Wetter. Dient als Entscheider bei Gleichstand. */
export function severity(code) {
  return TABLE[code]?.[4] ?? 0;
}

const WET = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOWY = new Set([71, 73, 75, 77, 85, 86]);

export const isWet = (code) => WET.has(code);
export const isSnowy = (code) => SNOWY.has(code);
