// Regenradar: RainViewer-Kacheln auf einer Leaflet-Karte mit OpenStreetMap-Hintergrund.
// Es gibt höchstens eine aktive Karte (die der sichtbaren Seite); sie entsteht erst,
// wenn die Radar-Karte in den sichtbaren Bereich kommt.
import { fetchRadar, radarTileUrl, wetterOnlineRadarUrl } from '../api.js';
import { uiIcon } from '../icons.js';
import { formatUnix } from '../time.js';

const FRAME_MS = 550;
const RADAR_TTL = 5 * 60 * 1000;
const HINT = 'Radarbilder der letzten 2 Stunden. In manchen Regionen gibt es kaum Radarabdeckung – '
  + 'dort bleibt die Karte leer, auch wenn es regnet.';

let radarCache = null; // { at, data }

async function loadFrames() {
  if (radarCache && Date.now() - radarCache.at < RADAR_TTL) return radarCache.data;
  const data = await fetchRadar();
  radarCache = { at: Date.now(), data };
  return data;
}

function shellHtml(place) {
  const external = place && place.lat != null
    ? `<a class="link-btn radar-ext" href="${wetterOnlineRadarUrl(place.lat, place.lon)}" target="_blank" rel="noopener noreferrer">Vorhersage-Radar bei WetterOnline ${uiIcon('external')}</a>`
    : '';
  return `<section class="card radar-card" aria-label="Regenradar">
    <div class="radar-head">
      <h3 class="card-title">${uiIcon('radar')}Regenradar</h3>
      <button class="icon-btn" type="button" data-radar="full" aria-label="Karte im Vollbild">${uiIcon('expand')}</button>
    </div>
    <div class="radar-map"><div class="radar-empty">Radar wird geladen …</div></div>
    <div class="radar-controls">
      <span class="radar-time">–:–</span>
      <span class="radar-tag" hidden>Vorhersage</span>
      <input type="range" min="0" max="0" value="0" step="1" aria-label="Zeitpunkt des Radarbilds" disabled>
      <button class="icon-btn" type="button" data-radar="play" aria-label="Abspielen" disabled>${uiIcon('play')}</button>
    </div>
    <p class="radar-hint">${HINT}</p>
    ${external}
  </section>`;
}

export function createRadar({ onFullChange } = {}) {
  let active = null; // { slot, key, timezone, map, layers, frames, host, index, timer, observer }

  function setMessage(text) {
    const box = active?.slot.querySelector('.radar-map');
    if (!box) return;
    box.querySelector('.radar-empty')?.remove();
    if (text) {
      const el = document.createElement('div');
      el.className = 'radar-empty';
      el.style.zIndex = '500';
      el.style.pointerEvents = 'none';
      el.textContent = text;
      box.appendChild(el);
    }
  }

  function showFrame(index) {
    const a = active;
    if (!a?.map || !a.frames.length) return;
    const i = Math.max(0, Math.min(a.frames.length - 1, index));
    const frame = a.frames[i];
    if (!a.layers[i]) {
      a.layers[i] = window.L.tileLayer(radarTileUrl(a.host, frame.path), {
        opacity: 0, maxNativeZoom: 7, maxZoom: 11, zIndex: 10 + i,
      }).addTo(a.map);
    }
    a.layers.forEach((layer, j) => layer?.setOpacity(j === i ? 0.72 : 0));
    a.index = i;
    const card = a.slot;
    card.querySelector('.radar-time').textContent = formatUnix(frame.time, a.timezone);
    card.querySelector('.radar-tag').hidden = frame.kind !== 'nowcast';
    card.querySelector('input[type="range"]').value = String(i);
  }

  function setPlaying(on) {
    const a = active;
    if (!a) return;
    clearInterval(a.timer);
    a.timer = null;
    const btn = a.slot.querySelector('[data-radar="play"]');
    if (on && a.frames.length > 1) {
      let hold = 0;
      a.timer = setInterval(() => {
        if (a.index >= a.frames.length - 1) {
          hold += 1;
          if (hold < 3) return; // am Ende kurz stehen bleiben
          hold = 0;
          showFrame(0);
        } else {
          showFrame(a.index + 1);
        }
      }, FRAME_MS);
      if (a.index >= a.frames.length - 1) showFrame(0);
    }
    if (btn) {
      btn.innerHTML = uiIcon(a.timer ? 'pause' : 'play');
      btn.setAttribute('aria-label', a.timer ? 'Pause' : 'Abspielen');
    }
  }

  function setFull(on) {
    const a = active;
    if (!a) return;
    const card = a.slot.querySelector('.radar-card');
    card.classList.toggle('is-full', on);
    document.body.classList.toggle('radar-full', on);
    onFullChange?.(on);
    const btn = card.querySelector('[data-radar="full"]');
    btn.innerHTML = uiIcon(on ? 'close' : 'expand');
    btn.setAttribute('aria-label', on ? 'Vollbild schließen' : 'Karte im Vollbild');
    if (a.map) {
      const touch = window.matchMedia('(pointer: coarse)').matches;
      if (on || !touch) a.map.dragging.enable();
      else a.map.dragging.disable();
      if (on) a.map.scrollWheelZoom.enable();
      else a.map.scrollWheelZoom.disable();
      setTimeout(() => a.map?.invalidateSize(), 60);
    }
  }

  async function init() {
    const a = active;
    if (!a || a.map || a.starting) return;
    a.starting = true;
    const box = a.slot.querySelector('.radar-map');
    if (!window.L) {
      setMessage('Die Karte konnte nicht geladen werden.');
      return;
    }
    const L = window.L;
    const mapEl = document.createElement('div');
    mapEl.style.height = '100%';
    box.replaceChildren(mapEl);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    a.map = L.map(mapEl, {
      center: [a.lat, a.lon],
      zoom: 7,
      minZoom: 3,
      maxZoom: 11,
      dragging: !touch, // am Handy scrollt ein Finger die Seite; frei bewegen im Vollbild
      scrollWheelZoom: false,
      attributionControl: true,
    });
    a.map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'osm-tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        + ' · <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>',
    }).addTo(a.map);
    L.circleMarker([a.lat, a.lon], {
      radius: 6, color: '#ffffff', weight: 2, fillColor: '#ff5a4f', fillOpacity: 1, interactive: false,
    }).addTo(a.map);

    try {
      const data = await loadFrames();
      if (active !== a) return;
      a.host = data.host;
      a.frames = data.frames;
    } catch {
      if (active !== a) return;
      a.frames = [];
    }
    if (!a.frames.length || !a.host) {
      setMessage('Das Radar ist gerade nicht verfügbar.');
      return;
    }
    const slider = a.slot.querySelector('input[type="range"]');
    slider.max = String(a.frames.length - 1);
    slider.disabled = false;
    a.slot.querySelector('[data-radar="play"]').disabled = false;
    // Start beim neuesten gemessenen Bild (nicht bei der Vorhersage).
    const lastPast = a.frames.map((f) => f.kind).lastIndexOf('past');
    showFrame(lastPast >= 0 ? lastPast : a.frames.length - 1);
  }

  function onClick(e) {
    const btn = e.target.closest('[data-radar]');
    if (!btn || !active || !active.slot.contains(btn)) return;
    if (btn.dataset.radar === 'play') setPlaying(!active.timer);
    else if (btn.dataset.radar === 'full') setFull(!active.slot.querySelector('.radar-card').classList.contains('is-full'));
  }

  function onInput(e) {
    if (!active || !e.target.matches('.radar-controls input[type="range"]') || !active.slot.contains(e.target)) return;
    setPlaying(false);
    showFrame(Number(e.target.value));
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);

  const api = {
    /** Statische Hülle der Karte (für jede Seite), damit das Layout beim Wischen nicht springt. */
    ensureShell(slot, place) {
      if (slot && !slot.firstElementChild) slot.innerHTML = shellHtml(place);
    },
    activate(slot, place, timezone) {
      if (!slot || place.lat == null) return;
      const key = `${place.id}:${place.lat}:${place.lon}`;
      if (active && active.slot === slot && active.key === key) {
        active.timezone = timezone;
        return;
      }
      api.deactivate();
      api.ensureShell(slot, place);
      active = {
        slot, key, timezone, lat: place.lat, lon: place.lon,
        map: null, layers: [], frames: [], host: '', index: 0, timer: null, observer: null, starting: false,
      };
      if ('IntersectionObserver' in window) {
        const a = active;
        a.observer = new IntersectionObserver((entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            a.observer.disconnect();
            init();
          }
        }, { rootMargin: '300px 0px' });
        a.observer.observe(slot);
      } else {
        init();
      }
    },
    deactivate() {
      if (!active) return;
      const a = active;
      if (a.slot.querySelector('.radar-card.is-full')) setFull(false);
      clearInterval(a.timer);
      a.observer?.disconnect();
      a.map?.remove();
      active = null;
      a.slot.innerHTML = shellHtml(a);
    },
    closeFull() {
      if (active?.slot.querySelector('.radar-card.is-full')) {
        setFull(false);
        return true;
      }
      return false;
    },
  };
  return api;
}
