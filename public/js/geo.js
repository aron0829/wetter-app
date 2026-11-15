// Aktueller Standort über die Geolocation API.

const MESSAGES = {
  1: 'Der Zugriff auf den Standort wurde nicht erlaubt. Du kannst ihn in den Website-Einstellungen des Browsers freigeben.',
  2: 'Der Standort ist gerade nicht verfügbar.',
  3: 'Die Standortbestimmung hat zu lange gedauert.',
};

export function locate() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Dieser Browser unterstützt keine Standortbestimmung.'));
      return;
    }
    if (!window.isSecureContext) {
      reject(new Error('Der Standort ist nur über eine sichere Verbindung (HTTPS) verfügbar.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        // Auf ~100 m runden: genau genug fürs Wetter, stabil für den Cache.
        lat: Math.round(pos.coords.latitude * 1000) / 1000,
        lon: Math.round(pos.coords.longitude * 1000) / 1000,
      }),
      (err) => reject(new Error(MESSAGES[err.code] || 'Der Standort konnte nicht ermittelt werden.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Entfernung in Kilometern (Haversine). */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}
