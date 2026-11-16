// Wetterseite eines Ortes: liefert HTML-Strings, keine Ereignisbehandlung.
import { iconSvg, uiIcon } from '../icons.js';
import {
  aqiLabel, fmtKmh, fmtMm, fmtPct, fmtTemp, pollenLevel, uvLabel, windDirLabel, windText,
} from '../model.js';
import { daylight, moonPhase, sunPosition } from '../astro.js';
import { addDays, formatTime } from '../time.js';
import { placeSubtitle } from '../places.js';
import { tempCurve } from './chart.js';
import { esc } from './html.js';

const COL = 58;
const STRIP_HOURS = 24;

// ------------------------------------------------------------ Kopf

export function placeHeading(place) {
  return `${place.isHere ? uiIcon('pin') : ''}<span>${esc(place.name)}</span>`;
}

function heroHead(place) {
  return `<div class="hero-head">
    <h1 class="hero-place">${placeHeading(place)}</h1>
    <button class="icon-btn" type="button" data-action="open-places" aria-label="Orte verwalten">${uiIcon('list')}</button>
  </div>`;
}

function whereLine(place, meta) {
  const sub = placeSubtitle(place);
  const clock = meta.clock ? `<span data-clock>${meta.clock}</span> Uhr` : '';
  return `<p class="hero-where">${[esc(sub), clock].filter(Boolean).join(' · ')}</p>`;
}

function hero(place, model, meta) {
  const { current, today } = model;
  return `<header class="hero">
    ${heroHead(place)}
    ${whereLine(place, meta)}
    <div class="hero-temp" aria-label="Aktuelle Temperatur">${fmtTemp(current.temp)}</div>
    <p class="hero-text">${esc(current.text)}</p>
    <p class="hero-range">↑ ${fmtTemp(today.max)} / ↓ ${fmtTemp(today.min)}</p>
    <p class="hero-feels">Gefühlt wie ${fmtTemp(current.feels)}</p>
  </header>`;
}

function notice(meta) {
  if (!meta.error) return '';
  const when = meta.fetchedAt
    ? ` Stand: ${new Date(meta.fetchedAt).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} Uhr.`
    : '';
  return `<div class="notice"><span>Aktualisierung nicht möglich.${when}</span>
    <button type="button" data-action="refresh">Erneut versuchen</button></div>`;
}

// ------------------------------------------------------------ Stündlich

function pop(value, className) {
  const dry = value === null || value < 5 ? ' is-dry' : '';
  return `<span class="${className}${dry}">${uiIcon('umbrella')}${fmtPct(value)}</span>`;
}

function hourlyCard(model) {
  const hours = model.hours.slice(0, STRIP_HOURS);
  const cols = hours.map((h, i) => {
    const label = i === 0 ? 'Jetzt' : (h.newDay || h.hhmm);
    const cls = i === 0 ? ' is-now' : (h.newDay ? ' is-newday' : '');
    return `<div class="hour${cls}"><span class="hour-time">${label}</span>${iconSvg(h.icon)}${pop(h.pop, 'hour-pop')}</div>`;
  }).join('');
  return `<section class="card" aria-label="Stündliche Vorhersage">
    <p class="card-summary">${esc(model.summary)}</p>
    <div class="hours-scroll"><div class="hours-track" style="width:${hours.length * COL}px">
      <div class="hours-row">${cols}</div>
      ${tempCurve(hours.map((h) => h.temp), COL)}
    </div></div>
    <button class="link-btn" type="button" data-action="open-hours">48-Stunden-Vorhersage ${uiIcon('chevron')}</button>
  </section>`;
}

// ------------------------------------------------------------ Täglich

function dailyCard(model) {
  const rows = model.days.map((d) => {
    if (d.isPast) {
      return `<div class="day is-past"><span>${d.label}</span><span></span><span></span><span></span>
        <span class="day-max">${fmtTemp(d.max)}</span><span class="day-min">${fmtTemp(d.min)}</span></div>`;
    }
    const sum = d.precipSum !== null && d.precipSum >= 0.1 ? `<small>${fmtMm(d.precipSum)}</small>` : '';
    return `<div class="day"><span>${d.label}</span>
      <span class="day-pop">${pop(d.pop, '')}${sum}</span>
      ${iconSvg(d.dayIcon)}${iconSvg(d.nightIcon)}
      <span class="day-max">${fmtTemp(d.max)}</span><span class="day-min">${fmtTemp(d.min)}</span></div>`;
  }).join('');
  return `<section class="card" aria-label="Tägliche Vorhersage">${rows}</section>`;
}

// ------------------------------------------------------------ Kacheln

function uvTile(model) {
  const { current, today, hours, days } = model;
  const rest = hours.filter((h) => h.time.startsWith(today.date) && h.isDay && h.uv !== null);
  let note;
  if (rest.length) {
    note = `Rest des Tages ${uvLabel(Math.max(...rest.map((h) => h.uv))).toLowerCase()}`;
  } else {
    const tomorrow = days.find((d) => d.date === addDays(today.date, 1));
    note = tomorrow?.uvMax != null ? `Morgen bis ${uvLabel(tomorrow.uvMax).toLowerCase()}` : 'Keine Sonne';
  }
  const uv = current.uv;
  const posPct = uv === null ? 0 : Math.min(uv, 11) / 11 * 100;
  return `<section class="card tile">
    <h3 class="card-title">${uiIcon('sun')}UV-Index</h3>
    <p class="tile-note">${note}</p>
    <p class="tile-value">${uvLabel(uv)}</p>
    <div class="bar bar-uv"><b style="left:clamp(10px, ${posPct.toFixed(0)}%, calc(100% - 10px))">${uv === null ? '–' : Math.round(uv)}</b></div>
  </section>`;
}

function humidityTile(model) {
  const { humidity, humidityYesterday } = model.current;
  let note = '';
  if (humidity !== null && humidityYesterday !== null) {
    const diff = humidity - humidityYesterday;
    if (diff > 10) note = 'Feuchter als gestern';
    else if (diff < -10) note = 'Trockener als gestern';
    else note = 'Ähnlich wie gestern';
  }
  return `<section class="card tile">
    <h3 class="card-title">${uiIcon('drop')}Feuchtigkeit</h3>
    <p class="tile-note">${note}</p>
    <p class="tile-value">${fmtPct(humidity)}</p>
    <div class="bar"><i style="width:${humidity ?? 0}%"></i></div>
  </section>`;
}

function compass(deg, speed) {
  let ticks = '';
  for (let a = 0; a < 360; a += 30) {
    if (a % 90 === 0) continue;
    ticks += `<line x1="70" y1="12" x2="70" y2="17" transform="rotate(${a} 70 70)" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/>`;
  }
  const marker = deg === null ? ''
    : `<path d="M70 6l5.5 10h-11z" fill="#fff" transform="rotate(${deg.toFixed(0)} 70 70)"/>`;
  return `<svg class="compass" viewBox="0 0 140 140" role="img" aria-label="Wind aus ${windDirLabel(deg)}, ${fmtKmh(speed)}">
    <circle cx="70" cy="70" r="56" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.28)" stroke-width="2.5"/>
    <circle cx="70" cy="70" r="38" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>
    ${ticks}
    <path d="M70 0l4.5 8h-9z" fill="#ff5a4f"/>
    <text x="70" y="29" font-size="10" font-weight="600">N</text>
    <text x="118" y="73.5" font-size="10" font-weight="600">O</text>
    <text x="70" y="119" font-size="10" font-weight="600">S</text>
    <text x="22" y="73.5" font-size="10" font-weight="600">W</text>
    ${marker}
    <text x="70" y="59" font-size="11" font-weight="700">${windDirLabel(deg)}</text>
    <text x="70" y="80" font-size="22" font-weight="600">${speed === null ? '–' : Math.round(speed)}</text>
    <text x="70" y="93" font-size="9.5">km/h</text>
  </svg>`;
}

function windTile(model) {
  const { windSpeed, windDir, gusts } = model.current;
  return `<section class="card tile">
    <h3 class="card-title">${uiIcon('wind')}Wind</h3>
    <p class="tile-note">${windText(windSpeed)}</p>
    ${compass(windDir, windSpeed)}
    ${gusts !== null ? `<p class="tile-sub" style="text-align:center">Böen ${fmtKmh(gusts)}</p>` : ''}
  </section>`;
}

function precipTile(model) {
  const { today, precipNext24 } = model;
  return `<section class="card tile">
    <h3 class="card-title">${uiIcon('umbrella')}Niederschlag</h3>
    <p class="tile-note">Heute ${fmtMm(today.precipSum)}</p>
    <p class="tile-sub">Regenrisiko ${fmtPct(today.pop)}</p>
    <p class="tile-value">${fmtMm(precipNext24)}</p>
    <p class="tile-sub">in den nächsten 24 Stunden</p>
  </section>`;
}

// Bogen: Glockenkurve über die volle Breite; der Horizont schneidet bei 1/6 und 5/6.
const ARC_W = 320;
const ARC_TOP = 14;
const ARC_BASE = 84;
const ARC_HORIZON = ARC_BASE - (ARC_BASE - ARC_TOP) * 0.25;
const arcY = (x) => ARC_BASE - (ARC_BASE - ARC_TOP) * (1 + Math.cos(2 * Math.PI * (x - 0.5))) / 2;

function arcPath(from, to) {
  let d = '';
  for (let i = 0; i <= 48; i++) {
    const x = from + ((to - from) * i) / 48;
    d += `${i ? 'L' : 'M'}${(x * ARC_W).toFixed(1)} ${arcY(x).toFixed(1)}`;
  }
  return d;
}

function arcSvg({ color, position, leftLabel, rightLabel, marker }) {
  const x = Math.min(0.955, Math.max(0.045, 1 / 6 + position * (2 / 3)));
  return `<svg class="arc" viewBox="0 0 ${ARC_W} 112" aria-hidden="true">
    <rect x="0" y="${ARC_HORIZON}" width="${ARC_W}" height="${112 - ARC_HORIZON}" fill="rgba(0,0,0,.22)"/>
    <path d="${arcPath(0, 1)}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="3" stroke-linecap="round"/>
    <path d="${arcPath(1 / 6, 5 / 6)}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    ${marker((x * ARC_W).toFixed(1), arcY(x).toFixed(1))}
    <text x="${ARC_W * 0.29}" y="102">${leftLabel}</text>
    <text x="${ARC_W * 0.71}" y="102">${rightLabel}</text>
  </svg>`;
}

function sunCard(model, meta) {
  const { sunrise, sunset } = model.today;
  const light = daylight(sunrise, sunset);
  if (!light) {
    return `<section class="card"><h3 class="card-title">${uiIcon('sun')}Tageslicht</h3>
      <p class="tile-note">Heute gibt es hier keinen Sonnenauf- oder -untergang.</p></section>`;
  }
  const pos = sunPosition(sunrise, sunset, meta.nowIso) ?? -1;
  const up = pos >= 0 && pos <= 1;
  return `<section class="card sun-card" aria-label="Tageslicht: ${light.label}, Sonnenaufgang ${formatTime(sunrise)}, Sonnenuntergang ${formatTime(sunset)}">
    <p class="wide-title">${light.label} Tageslicht</p>
    ${arcSvg({
      color: '#ffcf4a',
      position: pos,
      leftLabel: formatTime(sunrise),
      rightLabel: formatTime(sunset),
      marker: (x, y) => (up
        ? `<circle cx="${x}" cy="${y}" r="15" fill="rgba(255,207,74,.25)"/><circle cx="${x}" cy="${y}" r="10" fill="#ffcf4a"/>`
        : `<circle cx="${x}" cy="${y}" r="8" fill="#8b93c4"/>`),
    })}
  </section>`;
}

function moonSvg(moon, southern) {
  const k = moon.illumination;
  const rx = (24 * Math.abs(1 - 2 * k)).toFixed(2);
  const sweep = k < 0.5 ? 0 : 1;
  const waxing = moon.phase < 0.5;
  const mirror = waxing === southern;
  return `<svg viewBox="0 0 56 56" aria-hidden="true">
    <circle cx="28" cy="28" r="24" fill="#2a2e5c"/>
    <path d="M28 4A24 24 0 0 1 28 52A${rx} 24 0 0 ${sweep} 28 4Z" fill="#e6ebfa"${mirror ? ' transform="translate(56 0) scale(-1 1)"' : ''}/>
  </svg>`;
}

function moonCard(place, now) {
  const moon = moonPhase(now);
  const daysToFull = ((0.5 - moon.phase + 1) % 1) * 29.53;
  const daysToNew = ((1 - moon.phase) % 1) * 29.53;
  const next = daysToFull < daysToNew
    ? `Vollmond in ${Math.max(1, Math.round(daysToFull))} Tagen`
    : `Neumond in ${Math.max(1, Math.round(daysToNew))} Tagen`;
  return `<section class="card moon-card">
    <p class="wide-title">Mond</p>
    <div class="moon-row">${moonSvg(moon, place.lat < 0)}
      <div><strong>${moon.name}</strong>
      <span>${Math.round(moon.illumination * 100)} % beleuchtet · ${next.replace(' in 1 Tagen', ' morgen')}</span></div>
    </div>
  </section>`;
}

const AQI_COLORS = ['#35d04a', '#9bd83e', '#f6d43a', '#f59a23', '#e53935', '#a13fc4'];

function airCard(air) {
  const c = air?.current;
  if (!c || c.european_aqi == null) return '';
  const aqi = c.european_aqi;
  const level = Math.min(5, Math.max(0, Math.ceil(aqi / 20) - 1));
  const pm = [c.pm2_5 != null ? `PM2,5: ${Math.round(c.pm2_5)} µg/m³` : null,
    c.pm10 != null ? `PM10: ${Math.round(c.pm10)} µg/m³` : null].filter(Boolean).join(' · ');
  return `<section class="card">
    <h3 class="card-title">Luftqualität (LQI)</h3>
    <p class="tile-value" style="padding-top:8px">${aqiLabel(aqi)} <small>(${Math.round(aqi)})</small></p>
    <div class="bar"><i style="width:${Math.min(100, Math.max(6, aqi))}%;background:${AQI_COLORS[level]}"></i></div>
    ${pm ? `<p class="tile-sub">${pm}</p>` : ''}
  </section>`;
}

function pollenCard(air) {
  const c = air?.current;
  if (!c) return '';
  const max = (...keys) => {
    const vals = keys.map((k) => c[k]).filter((v) => typeof v === 'number');
    return vals.length ? Math.max(...vals) : null;
  };
  const groups = [
    ['Baum', max('alder_pollen', 'birch_pollen', 'olive_pollen')],
    ['Gras', max('grass_pollen')],
    ['Kräuter', max('mugwort_pollen', 'ragweed_pollen')],
  ];
  if (groups.every(([, v]) => v === null)) return '';
  return `<section class="card">
    <h3 class="card-title">${uiIcon('sun')}Pollen</h3>
    <div class="pollen">${groups.map(([label, v]) => {
      const level = pollenLevel(v) ?? '–';
      return `<div data-level="${level}">${uiIcon('leaf')}<strong>${level}</strong><span>${label}</span></div>`;
    }).join('')}</div>
  </section>`;
}

function credits(meta) {
  const stand = meta.fetchedAt
    ? `Stand: ${new Date(meta.fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · `
    : '';
  return `<footer class="credits"><button class="btn" type="button" data-action="refresh">${uiIcon('refresh')}Aktualisieren</button>
    <p>${stand}Uhrzeiten in Ortszeit</p>
    Wetterdaten: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> ·
    Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a> ·
    Karte: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></footer>`;
}

// ------------------------------------------------------------ Öffentliche Renderer

export function renderTop(place, model, meta) {
  return hero(place, model, meta) + notice(meta) + hourlyCard(model) + dailyCard(model);
}

export function renderBottom(place, model, air, meta) {
  return `<div class="grid">${uvTile(model)}${humidityTile(model)}${windTile(model)}${precipTile(model)}</div>`
    + sunCard(model, meta) + moonCard(place, meta.now || new Date()) + airCard(air) + pollenCard(air)
    + credits(meta);
}

export function renderSkeleton(place, meta) {
  return `<header class="hero">${heroHead(place)}${whereLine(place, meta)}
    <div class="skeleton" style="width:150px;height:92px;margin-top:18px"></div>
    <div class="skeleton" style="width:120px;height:24px;margin-top:12px"></div>
  </header>
  <div class="card skeleton" style="height:210px"></div>
  <div class="card skeleton" style="height:380px"></div>`;
}

export function renderFailure(place, meta, message) {
  return `<header class="hero">${heroHead(place)}${whereLine(place, meta)}</header>
  <div class="state"><strong>Keine Wetterdaten</strong><p>${esc(message)}</p>
    <div class="btn-row"><button class="btn" type="button" data-action="refresh">${uiIcon('refresh')}Erneut versuchen</button></div>
  </div>`;
}

/** Seite "Aktueller Standort", solange (noch) keine Position bekannt ist. */
export function renderNoPosition(place, status, message) {
  const body = status === 'locating'
    ? '<strong>Standort wird ermittelt …</strong><p>Bitte erlaube den Zugriff auf deinen Standort, falls der Browser danach fragt.</p>'
    : `<strong>Standort nicht verfügbar</strong><p>${esc(message || 'Der Standort konnte nicht ermittelt werden.')}</p>`;
  return `<header class="hero">${heroHead(place)}</header>
  <div class="state">${body}
    <div class="btn-row">
      ${status === 'locating' ? '' : `<button class="btn" type="button" data-action="locate">${uiIcon('locate')}Erneut versuchen</button>`}
      <button class="btn" type="button" data-action="open-search">${uiIcon('search')}Ort suchen</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------ 48-Stunden-Liste

export function renderHours(model) {
  let out = '';
  let lastDate = null;
  const dayName = (date) => model.days.find((d) => d.date === date)?.label ?? '';
  for (const h of model.hours) {
    const date = h.time.slice(0, 10);
    if (date !== lastDate) {
      const [, m, d] = date.split('-');
      out += `<div class="h48-day">${dayName(date)}, ${Number(d)}.${Number(m)}.</div>`;
      lastDate = date;
    }
    out += `<div class="h48-row">
      <span class="h48-time">${h.hhmm}</span>${iconSvg(h.icon)}
      <span class="h48-temp"><strong>${fmtTemp(h.temp)}</strong><small>gefühlt ${fmtTemp(h.feels)}</small></span>
      <span class="h48-cell"><span>${uiIcon('umbrella')}${fmtPct(h.pop)}</span><small>${fmtMm(h.precip)}</small></span>
      <span class="h48-cell is-wind"><span>${uiIcon('wind')}${fmtKmh(h.wind)}</span><small>${windDirLabel(h.windDir)} · UV ${h.uv === null ? '–' : Math.round(h.uv)}</small></span>
    </div>`;
  }
  return out;
}
