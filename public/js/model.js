// Rohdaten von Open-Meteo → Anzeigemodell. Keine DOM-Zugriffe.
import { addDays, dateKey, formatTime, hourKey, weekdayShort } from './time.js';
import { describeWeather, isSnowy, isWet, severity } from './weathercodes.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const at = (arr, i) => (Array.isArray(arr) ? num(arr[i]) : null);

// ------------------------------------------------------------ Formatierer

export function fmtTemp(v) {
  if (num(v) === null) return '–';
  const r = Math.round(v);
  return `${r === 0 ? 0 : r}°`;
}

export const fmtPct = (v) => (num(v) === null ? '–' : `${Math.round(v)} %`);
export const fmtKmh = (v) => (num(v) === null ? '–' : `${Math.round(v)} km/h`);
export const fmtMm = (v) => (num(v) === null ? '–' : `${v.toFixed(1).replace('.', ',')} mm`);

// ------------------------------------------------------------ Beschriftungen

const DIRS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function windDirLabel(deg) {
  if (num(deg) === null) return '–';
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function windText(kmh) {
  if (num(kmh) === null) return '–';
  if (kmh < 2) return 'Windstill';
  if (kmh < 12) return 'Es ist ruhig';
  if (kmh < 29) return 'Leichte Brise';
  if (kmh < 50) return 'Frischer Wind';
  if (kmh < 75) return 'Starker Wind';
  return 'Sturm';
}

export function uvLabel(uv) {
  if (num(uv) === null) return '–';
  if (uv < 3) return 'Niedrig';
  if (uv < 6) return 'Mäßig';
  if (uv < 8) return 'Hoch';
  if (uv < 11) return 'Sehr hoch';
  return 'Extrem';
}

export function aqiLabel(eaqi) {
  if (num(eaqi) === null) return '–';
  if (eaqi <= 20) return 'Sehr gut';
  if (eaqi <= 40) return 'Gut';
  if (eaqi <= 60) return 'Mäßig';
  if (eaqi <= 80) return 'Schlecht';
  if (eaqi <= 100) return 'Sehr schlecht';
  return 'Extrem schlecht';
}

export function pollenLevel(grains) {
  if (num(grains) === null) return null;
  if (grains < 1) return 'Keine';
  if (grains < 10) return 'Gering';
  if (grains < 50) return 'Mäßig';
  return 'Hoch';
}

// ------------------------------------------------------------ Nacht-Code

/** Häufigster Wettercode der Nacht (20–23 Uhr des Tages, 00–05 Uhr des Folgetags). */
export function nightCode(hourly, date) {
  const from = `${date}T20:00`;
  const to = `${addDays(date, 1)}T05:00`;
  const counts = new Map();
  hourly.time.forEach((t, i) => {
    const code = at(hourly.weather_code, i);
    if (t >= from && t <= to && code !== null) counts.set(code, (counts.get(code) || 0) + 1);
  });
  let best = null;
  for (const [code, n] of counts) {
    if (best === null || n > counts.get(best) || (n === counts.get(best) && severity(code) > severity(best))) {
      best = code;
    }
  }
  return best;
}

// ------------------------------------------------------------ Kurztext

function dominantPhrase(hours) {
  const counts = new Map();
  for (const h of hours) if (h.code !== null) counts.set(h.code, (counts.get(h.code) || 0) + 1);
  let best = null;
  for (const [code, n] of counts) {
    if (best === null || n > counts.get(best) || (n === counts.get(best) && severity(code) > severity(best))) {
      best = code;
    }
  }
  if (best === null) return null;
  const dayish = hours.filter((h) => h.isDay).length >= hours.length / 2;
  if (best <= 1) return dayish ? 'Überwiegend sonnig' : 'Überwiegend klar';
  if (best === 2) return 'Teilweise bewölkt';
  if (best === 3) return 'Meistens bedeckt';
  if (best === 45 || best === 48) return 'Neblig';
  return describeWeather(best, dayish).text;
}

export function summarize(model) {
  const next = model.hours.slice(0, 12);
  if (!next.length) return '';
  const parts = [];
  const phrase = dominantPhrase(next);
  if (phrase) parts.push(`${phrase}.`);

  const precip = (h) => h.code !== null && (isWet(h.code) || isSnowy(h.code));
  const hourOf = (h) => Number(h.hhmm.slice(0, 2));
  const firstIdx = next.findIndex(precip);
  if (firstIdx > 0) {
    const kind = isSnowy(next[firstIdx].code) ? 'Schnee' : 'Regen';
    parts.push(`${kind} ab ca. ${hourOf(next[firstIdx])} Uhr.`);
  } else if (firstIdx === 0) {
    const endIdx = next.findIndex((h) => !precip(h));
    if (endIdx > 0) {
      const kind = isSnowy(next[0].code) ? 'Schnee' : 'Regen';
      parts.push(`${kind} bis ca. ${hourOf(next[endIdx])} Uhr.`);
    }
  }

  const temps = next.map((h) => h.temp).filter((t) => t !== null);
  if (temps.length) {
    if (model.current.isDay) parts.push(`Höchsttemperatur ${fmtTemp(Math.max(...temps))}.`);
    else parts.push(`Tiefsttemperatur ${fmtTemp(Math.min(...temps))}.`);
  }
  return parts.join(' ');
}

// ------------------------------------------------------------ Modell

export function buildModel(forecast, nowIso) {
  const hourly = forecast?.hourly;
  const daily = forecast?.daily;
  if (!hourly?.time?.length || !daily?.time?.length) {
    throw new Error('Wetterdaten unvollständig');
  }

  const today = dateKey(nowIso);
  const yesterday = addDays(today, -1);
  let start = hourly.time.indexOf(hourKey(nowIso));
  if (start < 0) start = 0;

  const hours = [];
  for (let i = start; i < Math.min(start + 48, hourly.time.length); i++) {
    const time = hourly.time[i];
    const code = at(hourly.weather_code, i);
    const isDay = at(hourly.is_day, i) === 1;
    hours.push({
      time,
      hhmm: formatTime(time),
      temp: at(hourly.temperature_2m, i),
      feels: at(hourly.apparent_temperature, i),
      precip: at(hourly.precipitation, i),
      pop: at(hourly.precipitation_probability, i),
      wind: at(hourly.wind_speed_10m, i),
      windDir: at(hourly.wind_direction_10m, i),
      code,
      isDay,
      icon: describeWeather(code, isDay).icon,
      uv: at(hourly.uv_index, i),
      humidity: at(hourly.relative_humidity_2m, i),
      newDay: i > start && time.endsWith('T00:00') ? weekdayShort(dateKey(time)) : null,
    });
  }

  const days = daily.time.map((date, i) => {
    const code = at(daily.weather_code, i);
    const night = nightCode(hourly, date);
    let label = weekdayShort(date);
    if (date === today) label = 'Heute';
    else if (date === yesterday) label = 'Gestern';
    return {
      date,
      label,
      isPast: date < today,
      max: at(daily.temperature_2m_max, i),
      min: at(daily.temperature_2m_min, i),
      precipSum: at(daily.precipitation_sum, i),
      pop: at(daily.precipitation_probability_max, i),
      code,
      dayIcon: describeWeather(code, true).icon,
      nightIcon: describeWeather(night ?? code, false).icon,
      sunrise: daily.sunrise?.[i] || null,
      sunset: daily.sunset?.[i] || null,
      uvMax: at(daily.uv_index_max, i),
    };
  });

  const c = forecast.current;
  const h0 = hours[0];
  const code = c ? num(c.weather_code) : h0.code;
  const isDay = c ? c.is_day === 1 : h0.isDay;
  const current = {
    temp: c ? num(c.temperature_2m) : h0.temp,
    feels: c ? num(c.apparent_temperature) : h0.feels,
    code,
    isDay,
    ...describeWeather(code, isDay),
    windSpeed: c ? num(c.wind_speed_10m) : h0.wind,
    windDir: c ? num(c.wind_direction_10m) : h0.windDir,
    gusts: c ? num(c.wind_gusts_10m) : null,
    humidity: c ? num(c.relative_humidity_2m) : h0.humidity,
    precip: c ? num(c.precipitation) : h0.precip,
    uv: c && num(c.uv_index) !== null ? c.uv_index : h0.uv,
    humidityYesterday: start >= 24 ? at(hourly.relative_humidity_2m, start - 24) : null,
  };

  const model = {
    current,
    hours,
    days,
    precipNext24: hours.slice(0, 24).reduce((sum, h) => sum + (h.precip ?? 0), 0),
    today: days.find((d) => d.date === today) || days[0],
    summary: '',
  };
  model.summary = summarize(model);
  return model;
}
