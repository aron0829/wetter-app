// Ortsliste als Overlay: Orte wechseln, suchen, hinzufügen, sortieren, löschen.
import { iconSvg, uiIcon } from '../icons.js';
import { fmtTemp } from '../model.js';
import { placeSubtitle } from '../places.js';
import { esc } from './html.js';

export function createPlacesSheet(root, opts) {
  let editing = false;
  let query = '';
  let results = null; // null = keine Suche, [] = keine Treffer
  let message = '';
  let searchSeq = 0;
  let debounce = null;

  // ---------------------------------------------------------- Darstellung

  function placeInner(place) {
    const info = opts.getInfo(place.id) || {};
    const now = info.icon
      ? `<span class="place-now">${iconSvg(info.icon)}${fmtTemp(info.temp)}</span>`
      : '<span class="place-now"></span>';
    const range = info.icon ? `${fmtTemp(info.max)} / ${fmtTemp(info.min)}` : '';
    return `<span class="place-name">${place.isHere ? uiIcon('pin') : ''}<b>${esc(place.name)}</b>
        <small>${esc(placeSubtitle(place))}</small></span>
      ${now}
      <span class="place-date">${esc(info.dateLine || '')}</span>
      <span class="place-range">${range}</span>`;
  }

  function listHtml() {
    const places = opts.getPlaces();
    const savedCount = places.filter((p) => !p.isHere).length;
    let savedIndex = -1;
    return places.map((place) => {
      if (!editing || place.isHere) {
        return `<div class="place-row" data-id="${esc(place.id)}">
          <button class="place" type="button" data-select="${esc(place.id)}">${placeInner(place)}</button></div>`;
      }
      savedIndex += 1;
      const name = esc(place.name);
      return `<div class="place-row" data-id="${esc(place.id)}" data-saved-index="${savedIndex}">
        <button class="icon-btn grip" type="button" data-grip aria-label="${name} verschieben">${uiIcon('grip')}</button>
        <div class="place">${placeInner(place)}</div>
        <div class="place-tools">
          <button class="icon-btn" type="button" data-move="-1" aria-label="${name} nach oben"${savedIndex === 0 ? ' disabled' : ''}>${uiIcon('up')}</button>
          <button class="icon-btn" type="button" data-move="1" aria-label="${name} nach unten"${savedIndex === savedCount - 1 ? ' disabled' : ''}>${uiIcon('down')}</button>
          <button class="icon-btn is-danger" type="button" data-remove aria-label="${name} löschen">${uiIcon('trash')}</button>
        </div></div>`;
    }).join('');
  }

  function resultsHtml() {
    if (message) return `<p class="search-msg">${esc(message)}</p>`;
    if (!results) return '';
    if (!results.length) return '<p class="search-msg">Kein Ort gefunden.</p>';
    const saved = new Set(opts.getPlaces().map((p) => p.id));
    return results.map((place, i) => `<button class="place" type="button" data-result="${i}">
      <span class="place-name"><b>${esc(place.name)}</b></span>
      <span class="place-now">${saved.has(place.id) ? uiIcon('check') : uiIcon('plus')}</span>
      <span class="place-date">${esc(placeSubtitle(place) || 'Unbekanntes Land')}</span><span></span>
    </button>`).join('');
  }

  function render() {
    const hasSaved = opts.getPlaces().some((p) => !p.isHere);
    if (!hasSaved) editing = false;
    root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Orte">
      <div class="sheet-head">
        <h2>${editing ? 'Orte bearbeiten' : 'Orte'}</h2>
        ${hasSaved ? `<button class="icon-btn" type="button" data-edit aria-label="${editing ? 'Fertig' : 'Orte sortieren und löschen'}" aria-pressed="${editing}">${uiIcon(editing ? 'check' : 'edit')}</button>` : ''}
        <button class="icon-btn" type="button" data-close aria-label="Schließen">${uiIcon('close')}</button>
      </div>
      <div class="sheet-body">
        <div class="place-list">${listHtml()}</div>
        <div class="search">
          <div class="search-field">
            <input type="search" placeholder="Suche" aria-label="Ort suchen" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="search" value="${esc(query)}">
            <button class="icon-btn" type="button" data-locate aria-label="Aktuellen Standort verwenden">${uiIcon('locate')}</button>
          </div>
          <div class="search-results">${resultsHtml()}</div>
        </div>
      </div>
    </div>`;
  }

  function updateResults() {
    const box = root.querySelector('.search-results');
    if (box) box.innerHTML = resultsHtml();
  }

  function updateList() {
    const box = root.querySelector('.place-list');
    if (box) box.innerHTML = listHtml();
  }

  // ---------------------------------------------------------- Suche

  function runSearch(value) {
    query = value;
    clearTimeout(debounce);
    const seq = ++searchSeq;
    const term = value.trim();
    if (term.length < 2) {
      results = null;
      message = '';
      updateResults();
      return;
    }
    debounce = setTimeout(async () => {
      message = 'Suche …';
      updateResults();
      try {
        const found = await opts.search(term);
        if (seq !== searchSeq) return; // inzwischen wurde weitergetippt
        results = found;
        message = '';
      } catch {
        if (seq !== searchSeq) return;
        results = null;
        message = 'Die Suche ist gerade nicht möglich. Bitte prüfe die Internetverbindung.';
      }
      updateResults();
    }, 300);
  }

  // ---------------------------------------------------------- Sortieren per Ziehen

  function startDrag(e, grip, row) {
    const rows = [...root.querySelectorAll('.place-row[data-saved-index]')];
    const from = rows.indexOf(row);
    if (from < 0) return;
    e.preventDefault();
    const height = row.offsetHeight;
    const startY = e.clientY;
    let target = from;
    grip.setPointerCapture(e.pointerId);
    row.classList.add('is-dragging');
    rows.forEach((r) => r !== row && r.classList.add('is-shifting'));

    const onMove = (ev) => {
      const dy = Math.max(-from * height, Math.min((rows.length - 1 - from) * height, ev.clientY - startY));
      row.style.transform = `translateY(${dy}px)`;
      target = Math.max(0, Math.min(rows.length - 1, Math.round(from + dy / height)));
      rows.forEach((r, j) => {
        if (r === row) return;
        let shift = 0;
        if (j > from && j <= target) shift = -height;
        else if (j < from && j >= target) shift = height;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const onEnd = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onEnd);
      grip.removeEventListener('pointercancel', onEnd);
      if (target !== from) opts.onMove(row.dataset.id, target);
      updateList();
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onEnd);
    grip.addEventListener('pointercancel', onEnd);
  }

  // ---------------------------------------------------------- Ereignisse

  root.addEventListener('click', (e) => {
    if (e.target === root) {
      api.close();
      return;
    }
    const el = e.target.closest('button');
    if (!el) return;
    const row = el.closest('.place-row');
    if (el.dataset.close !== undefined) api.close();
    else if (el.dataset.edit !== undefined) {
      editing = !editing;
      render();
    } else if (el.dataset.select !== undefined) opts.onSelect(el.dataset.select);
    else if (el.dataset.result !== undefined) {
      const place = results?.[Number(el.dataset.result)];
      if (place) {
        query = '';
        results = null;
        opts.onAdd(place);
      }
    } else if (el.dataset.locate !== undefined) opts.onLocate();
    else if (el.dataset.remove !== undefined && row) {
      opts.onRemove(row.dataset.id);
      render();
    } else if (el.dataset.move !== undefined && row) {
      opts.onMove(row.dataset.id, Number(row.dataset.savedIndex) + Number(el.dataset.move));
      updateList();
      root.querySelector(`.place-row[data-id="${CSS.escape(row.dataset.id)}"] [data-move="${el.dataset.move}"]:not([disabled])`)?.focus();
    }
  });

  root.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-grip]');
    if (!grip) return;
    startDrag(e, grip, grip.closest('.place-row'));
  });

  root.addEventListener('input', (e) => {
    if (e.target.matches('input[type="search"]')) runSearch(e.target.value);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[type="search"]')) {
      e.preventDefault();
      root.querySelector('[data-result]')?.focus();
    }
  });

  const api = {
    open({ focusSearch = false } = {}) {
      editing = false;
      query = '';
      results = null;
      message = '';
      render();
      root.hidden = false;
      opts.onOpen?.();
      if (focusSearch) root.querySelector('input[type="search"]')?.focus();
    },
    close() {
      if (root.hidden) return;
      root.hidden = true;
      root.innerHTML = '';
      clearTimeout(debounce);
      searchSeq += 1;
    },
    /** Liste neu zeichnen (neue Wetterdaten, neue Uhrzeit), ohne die Suche anzutasten. */
    refresh() {
      if (!root.hidden && !root.querySelector('.is-dragging')) updateList();
    },
    isOpen: () => !root.hidden,
  };
  return api;
}
