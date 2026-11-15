// Horizontaler Pager mit CSS Scroll-Snap: Wischen wechselt den Ort, ganz ohne eigene
// Gestenerkennung. Stundenleiste und Karte scrollen selbst und lösen keinen Wechsel aus.
import { uiIcon } from '../icons.js';
import { esc } from './html.js';

export function createPager(root, dotsRoot, { onChange, onScroll }) {
  const sections = new Map();
  let ids = [];
  let active = 0;
  let settle = null;

  function sectionFor(place) {
    let el = sections.get(place.id);
    if (!el) {
      el = document.createElement('section');
      el.className = 'page';
      el.dataset.id = place.id;
      el.innerHTML = '<div class="page-inner"><div class="slot" data-slot="top"></div>'
        + '<div class="slot" data-slot="radar"></div><div class="slot" data-slot="bottom"></div></div>';
      el.addEventListener('scroll', () => onScroll?.(place.id, el.scrollTop), { passive: true });
      sections.set(place.id, el);
    }
    el.setAttribute('aria-label', place.name);
    return el;
  }

  function renderDots(places) {
    dotsRoot.dataset.count = String(places.length);
    dotsRoot.innerHTML = places.map((p, i) => `<button type="button" data-index="${i}"`
      + ` class="${p.isHere ? 'is-here' : ''}" aria-label="${esc(p.name)}"`
      + ` aria-current="${i === active}">${p.isHere ? uiIcon('pin') : ''}</button>`).join('');
  }

  function setActive(index, notify = true) {
    const clamped = Math.max(0, Math.min(ids.length - 1, index));
    const changed = clamped !== active;
    active = clamped;
    dotsRoot.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', String(i === active)));
    if (changed && notify) onChange?.(ids[active], active);
  }

  root.addEventListener('scroll', () => {
    clearTimeout(settle);
    const index = Math.round(root.scrollLeft / (root.clientWidth || 1));
    settle = setTimeout(() => setActive(index), 90);
  }, { passive: true });

  dotsRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (btn) api.goTo(Number(btn.dataset.index));
  });

  window.addEventListener('resize', () => {
    root.scrollTo({ left: active * root.clientWidth, behavior: 'instant' });
  });

  const api = {
    /** Seiten an die Ortsliste angleichen; vorhandene Seiten (und ihr Inhalt) bleiben erhalten. */
    setPages(places, activeId) {
      const nextIds = places.map((p) => p.id);
      if (nextIds.join('|') === ids.join('|') && ids[active] === activeId) {
        // Nur Namen haben sich geändert: nicht scrollen (der Nutzer wischt vielleicht gerade).
        places.forEach((place) => sectionFor(place));
        renderDots(places);
        return;
      }
      ids = nextIds;
      for (const [id, el] of sections) {
        if (!ids.includes(id)) {
          el.remove();
          sections.delete(id);
        }
      }
      places.forEach((place) => root.appendChild(sectionFor(place)));
      const index = Math.max(0, ids.indexOf(activeId));
      active = index;
      renderDots(places);
      root.scrollTo({ left: index * root.clientWidth, behavior: 'instant' });
    },
    goTo(index, smooth = true) {
      const clamped = Math.max(0, Math.min(ids.length - 1, index));
      root.scrollTo({ left: clamped * root.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
      if (!smooth) setActive(clamped);
    },
    next: () => api.goTo(active + 1),
    prev: () => api.goTo(active - 1),
    section: (id) => sections.get(id) || null,
    slot: (id, name) => sections.get(id)?.querySelector(`[data-slot="${name}"]`) || null,
    activeId: () => ids[active],
    activeIndex: () => active,
  };
  return api;
}
