// Start, Zustand und Verdrahtung der Wetter-App.
import * as api from './api.js';
import { dropCached, loadCached, readJson, saveCached, writeJson } from './cache.js';
import { distanceKm, locate } from './geo.js';
import { uiIcon } from './icons.js';
import { buildModel } from './model.js';
import { createPlaceStore } from './places.js';
import { formatClock, formatDateLine, hourKey, nowInZone } from './time.js';
import { esc } from './ui/html.js';
import {
  placeHeading, renderBottom, renderFailure, renderHours, renderNoPosition, renderSkeleton, renderTop,
} from './ui/page.js';
import { createPager } from './ui/pager.js';
import { createPlacesSheet } from './ui/places-sheet.js';
import { createRadar } from './ui/radar.js';

const STALE_MS = 10 * 60 * 1000;
const HERE_ID = 'here';
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem() {} };
  }
}

const $ = (id) => document.getElementById(id);
const store = createPlaceStore(safeStorage());
const entries = new Map(); // Ort-ID → { forecast, air, fetchedAt, model, modelHour, error, loading }
const radar = createRadar();

let here = readJson('here.v1'); // { lat, lon, name, admin1, country, countryCode, named }
if (!here || !Number.isFinite(here.lat) || !Number.isFinite(here.lon)) here = null;
let hereStatus = here ? 'ok' : 'locating';
let hereMessage = '';

// ------------------------------------------------------------ Orte

function herePlace() {
  return {
    id: HERE_ID,
    isHere: true,
    name: here?.name || 'Aktueller Standort',
    admin1: here?.admin1 ?? null,
    country: here?.country ?? null,
    countryCode: here?.countryCode ?? null,
    lat: here?.lat ?? null,
    lon: here?.lon ?? null,
    timezone: null,
  };
}

const allPlaces = () => [herePlace(), ...store.list()];
const placeById = (id) => allPlaces().find((p) => p.id === id) || null;
const tzOf = (place) => entries.get(place.id)?.forecast?.timezone || place.timezone || DEVICE_TZ;

function metaFor(place) {
  const entry = entries.get(place.id);
  const tz = tzOf(place);
  const now = new Date();
  return {
    now,
    nowIso: nowInZone(tz, now),
    clock: place.lat == null ? '' : formatClock(tz, now),
    fetchedAt: entry?.fetchedAt || 0,
    error: entry?.error || null,
  };
}

// ------------------------------------------------------------ Darstellung

const pager = createPager($('pager'), $('dots'), {
  onChange: (id) => onActive(id),
  onScroll: (id) => { if (id === pager.activeId()) syncTopbar(); },
});

function renderPlace(id) {
  const place = placeById(id);
  const top = pager.slot(id, 'top');
  const bottom = pager.slot(id, 'bottom');
  const radarSlot = pager.slot(id, 'radar');
  if (!place || !top) return;
  const isActive = id === pager.activeId();

  if (place.lat == null) {
    if (isActive) radar.deactivate();
    top.innerHTML = renderNoPosition(place, hereStatus, hereMessage);
    bottom.innerHTML = '';
    radarSlot.innerHTML = '';
  } else {
    const entry = entries.get(id);
    const meta = metaFor(place);
    let model = null;
    if (entry?.forecast) {
      try {
        model = buildModel(entry.forecast, meta.nowIso);
      } catch {
        model = null;
      }
    }
    if (entry) {
      entry.model = model;
      entry.modelHour = hourKey(meta.nowIso);
    }
    if (model) {
      const strip = top.querySelector('.hours-scroll');
      const stripLeft = strip ? strip.scrollLeft : 0;
      top.innerHTML = renderTop(place, model, meta);
      bottom.innerHTML = renderBottom(place, model, entry.air, meta);
      if (stripLeft) top.querySelector('.hours-scroll').scrollLeft = stripLeft;
      radar.ensureShell(radarSlot);
      if (isActive) radar.activate(radarSlot, place, tzOf(place));
    } else {
      if (isActive) radar.deactivate();
      radarSlot.innerHTML = '';
      bottom.innerHTML = '';
      top.innerHTML = entry?.error && !entry.loading
        ? renderFailure(place, meta, entry.error)
        : renderSkeleton(place, meta);
    }
  }
  if (isActive) syncChrome();
}

function syncTopbar() {
  const section = pager.section(pager.activeId());
  const visible = !!section && section.scrollTop > 64;
  const bar = $('topbar');
  bar.classList.toggle('is-visible', visible);
  bar.setAttribute('aria-hidden', String(!visible));
  $('topbar-btn').tabIndex = visible ? 0 : -1;
}

function syncChrome() {
  const place = placeById(pager.activeId());
  if (!place) return;
  const model = entries.get(place.id)?.model;
  let theme = 'theme-night';
  if (model?.current.isDay) theme = model.current.code >= 3 ? 'theme-gray' : 'theme-day';
  document.body.classList.remove('theme-night', 'theme-day', 'theme-gray');
  document.body.classList.add(theme);
  const color = getComputedStyle(document.body).getPropertyValue('--bg-top').trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);

  $('topbar-place').innerHTML = placeHeading(place);
  $('topbar-time').textContent = place.lat == null ? '' : `${formatClock(tzOf(place))} Uhr`;
  document.title = model ? `${Math.round(model.current.temp ?? 0)}° ${place.name} – Wetter` : 'Wetter';
  syncTopbar();
}

function refreshPages(activeId) {
  const places = allPlaces();
  const target = places.some((p) => p.id === activeId) ? activeId : places[0].id;
  pager.setPages(places, target);
  for (const place of places) {
    if (!pager.slot(place.id, 'top').firstElementChild) renderPlace(place.id);
  }
  onActive(target);
}

// ------------------------------------------------------------ Daten laden

function entryFor(place) {
  let entry = entries.get(place.id);
  if (!entry) {
    const cached = loadCached(place.id);
    const usable = cached?.forecast && Number.isFinite(cached.lat)
      && distanceKm({ lat: cached.lat, lon: cached.lon }, place) < 2;
    entry = {
      forecast: usable ? cached.forecast : null,
      air: usable ? cached.air ?? null : null,
      fetchedAt: usable ? cached.fetchedAt || 0 : 0,
      model: null,
      modelHour: null,
      error: null,
      loading: null,
    };
    entries.set(place.id, entry);
  }
  return entry;
}

function load(id, { force = false } = {}) {
  const place = placeById(id);
  if (!place || place.lat == null) return null;
  const known = entries.has(id);
  const entry = entryFor(place);
  if (!known) renderPlace(id);
  if (entry.loading) return entry.loading;
  if (!force && entry.forecast && Date.now() - entry.fetchedAt < STALE_MS) return null;

  entry.loading = (async () => {
    try {
      const [forecast, air] = await Promise.all([
        api.fetchForecast(place.lat, place.lon),
        api.fetchAirQuality(place.lat, place.lon).catch(() => null),
      ]);
      buildModel(forecast, nowInZone(forecast.timezone)); // wirft bei unbrauchbarer Antwort
      Object.assign(entry, { forecast, air, fetchedAt: Date.now(), error: null });
      saveCached(id, { forecast, air, fetchedAt: entry.fetchedAt, lat: place.lat, lon: place.lon });
    } catch (err) {
      entry.error = navigator.onLine === false
        ? 'Keine Internetverbindung.'
        : `Die Wetterdaten konnten nicht geladen werden (${err.message || 'unbekannter Fehler'}).`;
    } finally {
      entry.loading = null;
      if (entries.get(id) === entry) {
        renderPlace(id);
        sheet.refresh();
      }
    }
  })();
  if (!entry.forecast) renderPlace(id);
  return entry.loading;
}

function onActive(id) {
  writeJson('lastPlace', id);
  const places = allPlaces();
  const index = places.findIndex((p) => p.id === id);
  const place = places[index];
  if (!place) return;
  load(id);
  // Nachbarn vorladen, damit beim Wischen schon etwas zu sehen ist.
  if (places[index - 1]) load(places[index - 1].id);
  if (places[index + 1]) load(places[index + 1].id);
  const entry = entries.get(id);
  if (entry?.model) radar.activate(pager.slot(id, 'radar'), place, tzOf(place));
  else radar.deactivate();
  syncChrome();
}

// ------------------------------------------------------------ Standort

async function updateHere({ user = false } = {}) {
  if (!here) {
    hereStatus = 'locating';
    renderPlace(HERE_ID);
  }
  let pos;
  try {
    pos = await locate();
  } catch (err) {
    if (!here) {
      hereStatus = 'error';
      hereMessage = err.message;
      renderPlace(HERE_ID);
    } else if (user) {
      toast(err.message);
    }
    return;
  }

  const moved = !here || distanceKm(here, pos) > 1.5;
  if (moved) {
    const near = here && distanceKm(here, pos) < 15;
    here = near ? { ...here, ...pos, named: false } : { ...pos, name: null, named: false };
    hereStatus = 'ok';
    writeJson('here.v1', here);
    entries.delete(HERE_ID);
    refreshHereLabels();
    load(HERE_ID, { force: true });
    if (pager.activeId() === HERE_ID) onActive(HERE_ID);
  }
  if (!here.named) nameHere();
}

async function nameHere() {
  const at = here;
  try {
    const found = await api.reverseGeocode(at.lat, at.lon);
    if (here !== at) return;
    here = { ...at, ...found, name: found.name || at.name || null, named: true };
    writeJson('here.v1', here);
    refreshHereLabels();
  } catch {
    // Ohne Namen bleibt es bei "Aktueller Standort".
  }
}

function refreshHereLabels() {
  pager.setPages(allPlaces(), pager.activeId());
  renderPlace(HERE_ID);
  sheet.refresh();
}

// ------------------------------------------------------------ Ortsliste

const sheet = createPlacesSheet($('places-sheet'), {
  getPlaces: allPlaces,
  search: api.searchPlaces,
  getInfo(id) {
    const place = placeById(id);
    if (!place || place.lat == null) return { dateLine: 'Standort unbekannt' };
    const model = entries.get(id)?.model;
    const dateLine = formatDateLine(tzOf(place));
    if (!model) return { dateLine };
    return {
      dateLine,
      icon: model.current.icon,
      temp: model.current.temp,
      max: model.today.max,
      min: model.today.min,
    };
  },
  onOpen() {
    allPlaces().forEach((p) => load(p.id));
  },
  onSelect(id) {
    sheet.close();
    const index = allPlaces().findIndex((p) => p.id === id);
    if (index >= 0) pager.goTo(index, false);
    if (id === HERE_ID && !here) updateHere({ user: true });
  },
  onAdd(place) {
    store.add(place);
    sheet.close();
    refreshPages(place.id);
  },
  onRemove(id) {
    const list = store.list();
    const index = list.findIndex((p) => p.id === id);
    if (index < 0) return;
    const removed = list[index];
    const activeBefore = pager.activeId();
    store.remove(id);
    entries.delete(id);
    dropCached(id);
    refreshPages(activeBefore === id ? HERE_ID : activeBefore);
    toast(`„${removed.name}“ gelöscht`, {
      action: 'Rückgängig',
      onAction() {
        store.add(removed);
        store.move(removed.id, index);
        refreshPages(pager.activeId());
        sheet.refresh();
      },
    });
  },
  onMove(id, toIndex) {
    store.move(id, toIndex);
    refreshPages(pager.activeId());
  },
  onLocate() {
    sheet.close();
    pager.goTo(0, false);
    updateHere({ user: true });
  },
});

// ------------------------------------------------------------ 48-Stunden-Ansicht

function openHours() {
  const place = placeById(pager.activeId());
  const model = place && entries.get(place.id)?.model;
  if (!model) return;
  const root = $('hours-sheet');
  root.innerHTML = `<div class="sheet sheet-tall" role="dialog" aria-modal="true" aria-label="48-Stunden-Vorhersage">
    <div class="sheet-head"><h2>48 Stunden · ${esc(place.name)}</h2>
      <button class="icon-btn" type="button" data-action="close-hours" aria-label="Schließen">${uiIcon('close')}</button></div>
    <div class="sheet-body">${renderHours(model)}</div></div>`;
  root.hidden = false;
  root.querySelector('button').focus();
}

function closeHours() {
  const root = $('hours-sheet');
  root.hidden = true;
  root.innerHTML = '';
}

// ------------------------------------------------------------ Hinweis

let toastTimer = null;

function toast(message, { action, onAction, ms = 6000 } = {}) {
  const el = $('toast');
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  el.hidden = false;
  const hide = () => { el.hidden = true; };
  el.querySelector('button')?.addEventListener('click', () => {
    hide();
    onAction?.();
  });
  toastTimer = setTimeout(hide, ms);
}

// ------------------------------------------------------------ Ereignisse

document.addEventListener('click', (e) => {
  if (e.target === $('hours-sheet')) {
    closeHours();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'open-places': sheet.open(); break;
    case 'open-search': sheet.open({ focusSearch: true }); break;
    case 'open-hours': openHours(); break;
    case 'close-hours': closeHours(); break;
    case 'refresh': load(pager.activeId(), { force: true }); break;
    case 'locate': updateHere({ user: true }); break;
    default:
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('hours-sheet').hidden) closeHours();
    else if (sheet.isOpen()) sheet.close();
    else radar.closeFull();
    return;
  }
  const overlayOpen = sheet.isOpen() || !$('hours-sheet').hidden;
  if (overlayOpen || e.target.closest('input, textarea, .leaflet-container')) return;
  if (e.key === 'ArrowRight') pager.next();
  else if (e.key === 'ArrowLeft') pager.prev();
});

// ------------------------------------------------------------ Uhr und Aktualisierung

function tick() {
  const activeId = pager.activeId();
  for (const place of allPlaces()) {
    if (place.lat == null) continue;
    const clock = formatClock(tzOf(place));
    pager.section(place.id)?.querySelectorAll('[data-clock]').forEach((el) => {
      if (el.textContent !== clock) el.textContent = clock;
    });
    // Zur vollen Stunde rückt die "aktuelle Stunde" weiter: neu aufbauen.
    const entry = entries.get(place.id);
    if (entry?.model && entry.modelHour !== hourKey(nowInZone(tzOf(place)))) renderPlace(place.id);
  }
  const active = placeById(activeId);
  if (active && active.lat != null) $('topbar-time').textContent = `${formatClock(tzOf(active))} Uhr`;
  if (document.visibilityState === 'visible') load(activeId);
  sheet.refresh();
}

setInterval(tick, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  tick();
  updateHere();
});
window.addEventListener('online', () => load(pager.activeId(), { force: true }));

// ------------------------------------------------------------ Start

$('topbar-btn').innerHTML = uiIcon('list');
{
  const last = readJson('lastPlace');
  const places = allPlaces();
  const startId = places.some((p) => p.id === last) ? last : HERE_ID;
  refreshPages(startId);
  updateHere();
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
