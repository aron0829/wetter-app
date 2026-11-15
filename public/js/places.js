// Gespeicherte Orte. Der Speicher wird hereingereicht (localStorage oder Test-Attrappe).

export const STORAGE_KEY = 'wetter.places.v1';

const isPlace = (p) => p && typeof p === 'object'
  && typeof p.id === 'string' && typeof p.name === 'string'
  && Number.isFinite(p.lat) && Number.isFinite(p.lon);

export function createPlaceStore(storage) {
  let places = [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed)) places = parsed.filter(isPlace);
  } catch {
    places = [];
  }

  const persist = () => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(places));
    } catch {
      // Speicher voll oder gesperrt: Die Liste gilt dann nur für diese Sitzung.
    }
  };

  return {
    list: () => places.slice(),
    has: (id) => places.some((p) => p.id === id),
    add(place) {
      if (!isPlace(place) || places.some((p) => p.id === place.id)) return false;
      places.push(place);
      persist();
      return true;
    },
    remove(id) {
      const before = places.length;
      places = places.filter((p) => p.id !== id);
      if (places.length !== before) persist();
    },
    move(id, toIndex) {
      const from = places.findIndex((p) => p.id === id);
      if (from < 0) return;
      const to = Math.max(0, Math.min(places.length - 1, Math.trunc(toIndex) || 0));
      if (to === from) return;
      const [item] = places.splice(from, 1);
      places.splice(to, 0, item);
      persist();
    },
  };
}

/** "Sachsen, Deutschland" – fehlende oder mit dem Ortsnamen identische Teile entfallen. */
export function placeSubtitle(place) {
  return [place.admin1 && place.admin1 !== place.name ? place.admin1 : null, place.country]
    .filter(Boolean)
    .join(', ');
}
