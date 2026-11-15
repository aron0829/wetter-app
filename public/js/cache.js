// Kleiner, fehlertoleranter Zugriff auf localStorage (Präfix "wetter.").

const PREFIX = 'wetter.';

export function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // egal
  }
}

/** Letzte Vorhersage eines Ortes: { forecast, air, fetchedAt } */
export const loadCached = (placeId) => readJson(`cache.${placeId}`);

export function saveCached(placeId, entry) {
  if (writeJson(`cache.${placeId}`, entry)) return;
  // Speicher voll: andere Vorhersagen verwerfen und noch einmal versuchen.
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${PREFIX}cache.`) && k !== `${PREFIX}cache.${placeId}`)
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    return;
  }
  writeJson(`cache.${placeId}`, entry);
}

export const dropCached = (placeId) => remove(`cache.${placeId}`);
