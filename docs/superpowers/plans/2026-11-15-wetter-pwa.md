# Wetter-PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persönliche Wetter-PWA (Deutsch, °C, km/h) mit Standort, gespeicherten Orten, Stunden-/Tagesvorhersage und Regenradar, deployt auf wetter.mercao.de.

**Architecture:** Statische App ohne Build-Schritt. `public/` wird 1:1 deployt. Reine Logik (Zeit, Codes, Modell, Orte, API-URLs, Astro) liegt in DOM-freien ES-Modulen und wird mit `node:test` getestet; die UI-Module rendern daraus HTML-Strings und werden im Browser verifiziert.

**Tech Stack:** HTML, CSS, JavaScript (ES-Module), Leaflet 1.9 (lokal in `public/vendor`), Plus Jakarta Sans (lokal), Node 22 `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-15-wetter-pwa-design.md`

## Global Constraints

- Oberfläche Deutsch; Temperaturen °C (gerundet, ohne Nachkommastelle), Wind km/h.
- Alle Uhrzeiten in Ortszeit des Ortes; API-Zeitstrings nie über `new Date(str)` in Gerätezeit umrechnen.
- Open-Meteo Forecast immer mit `models=best_match` und `timezone=auto`.
- Keine Laufzeit-Abhängigkeit von CDNs: Leaflet und Schrift liegen in `public/`.
- Keine API-Schlüssel, kein Backend, kein Build-Schritt.
- localStorage-Schlüssel mit Präfix `wetter.`.
- Fehlende Werte (`null`/`undefined`) werden als `–` angezeigt, nie als `null`, `NaN` oder `undefined`.

## Review Focus

1. Ort in weit entfernter Zeitzone (America/Sao_Paulo, Pacific/Auckland): „aktuelle Stunde“ und „Heute“ richten sich nach dem Ort, nicht nach dem Gerät → Tests in Task 2 und 4.
2. `null` in Stunden-/Tagesarrays (z. B. Regenwahrscheinlichkeit, UV jenseits der Modellreichweite) → Modell liefert `null`, Formatierer `–` → Test in Task 4.
3. Polartag/Polarnacht: Sonnenauf-/untergang fehlt oder ist identisch → Tageslicht-Kachel zeigt Text statt abzustürzen → Test in Task 7.
4. Defekter oder voller localStorage → App startet mit leerer Ortsliste, Schreiben schlägt still fehl → Test in Task 5.
5. Derselbe Ort wird zweimal hinzugefügt; Geocoding-Treffer ohne `admin1`/`country` → kein Duplikat, kein „undefined“ in der Anzeige → Tests in Task 5 und 6.

---

### Task 1: Gerüst

**Files:** Create `package.json`, `.gitignore`, `tools/serve.mjs`, `README.md`

- [ ] `git init -b main`; `package.json` mit `"type": "module"`, Scripts `test` = `node --test tests/`, `serve` = `node tools/serve.mjs`.
- [ ] `tools/serve.mjs`: statischer Server für `public/` auf Port 5173 (richtige MIME-Typen inkl. `.webmanifest`, `.woff2`).
- [ ] `.gitignore`: `node_modules/`, `.claude/`.
- [ ] Commit.

### Task 2: Ortszeit (`public/js/time.js`)

**Test:** `tests/time.test.js`

**Produces:**
- `nowInZone(timeZone: string, date?: Date): string` → `"YYYY-MM-DDTHH:MM"`
- `dateKey(iso): string`, `hourKey(iso): string` (`…T14:00`), `addDays(dateKey, n): string`
- `formatTime(iso): string` → `"08:03"`
- `weekdayShort(dateKey): string` → `"Mo."`, `"Di."` … `"So."`
- `formatClock(timeZone, date?): string` → `"21:27"`
- `formatDateLine(timeZone, date?): string` → `"So., 15. November um 21:27"`
- `formatUnix(unixSeconds, timeZone): string` → `"HH:MM"`
- `minutesBetween(isoA, isoB): number`

- [ ] Tests: `nowInZone('America/Sao_Paulo', new Date('2026-11-16T01:30:00Z')) === '2026-11-15T22:30'`; `nowInZone('Pacific/Auckland', …same) === '2026-11-16T14:30'`; `addDays('2026-12-31', 1) === '2027-01-01'`; `addDays('2026-03-01', -1) === '2026-02-28'`; `weekdayShort('2026-11-15') === 'So.'`; `formatDateLine('Europe/Madrid', new Date('2026-11-15T20:27:00Z')) === 'So., 15. November um 21:27'`; `formatUnix(1794778800, 'Europe/Berlin')` liefert `HH:MM`; `minutesBetween('2026-11-15T08:03','2026-11-15T18:13') === 610`; ungültige Zeitzone fällt auf UTC zurück statt zu werfen.
- [ ] Fehlschlag prüfen, implementieren (Intl.DateTimeFormat mit `hourCycle: 'h23'`), grün, Commit.

### Task 3: Wettercodes und Icons (`public/js/weathercodes.js`, `public/js/icons.js`)

**Test:** `tests/weathercodes.test.js`

**Produces:**
- `describeWeather(code: number, isDay: boolean): { text: string, icon: string }`
- `severity(code: number): number` (höher = „schlimmer“, für Auswahl bei Gleichstand)
- `ICON_NAMES: string[]`, `iconSvg(name: string, className?: string): string`

Zuordnung (Text Tag/Nacht identisch außer Code 0/1):

| Code | Text | Icon |
|---|---|---|
| 0 | Sonnig / Klar | clear-day / clear-night |
| 1 | Heiter / Überwiegend klar | mostly-clear-day / -night |
| 2 | Teilweise bewölkt | partly-day / -night |
| 3 | Bedeckt | cloudy |
| 45, 48 | Nebel, Reifnebel | fog |
| 51, 53, 55 | Leichter Nieselregen, Nieselregen, Starker Nieselregen | drizzle |
| 56, 57 | Leichter gefrierender Nieselregen, Gefrierender Nieselregen | sleet |
| 61, 63, 65 | Leichter Regen, Regen, Starker Regen | rain, rain, heavy-rain |
| 66, 67 | Leichter gefrierender Regen, Gefrierender Regen | sleet |
| 71, 73, 75, 77 | Leichter Schneefall, Schneefall, Starker Schneefall, Schneegriesel | snow |
| 80, 81, 82 | Leichte Regenschauer, Regenschauer, Heftige Regenschauer | showers-day / -night (82: heavy-rain) |
| 85, 86 | Leichte Schneeschauer, Starke Schneeschauer | snow-showers-day / -night |
| 95 | Gewitter | thunder |
| 96, 99 | Gewitter mit leichtem Hagel, Gewitter mit Hagel | thunder-hail |
| sonst | Unbekannt | cloudy |

- [ ] Tests: jeder der 28 WMO-Codes liefert für Tag und Nacht nicht-leeren Text und ein Icon aus `ICON_NAMES`; `describeWeather(0,true).icon === 'clear-day'`, `(0,false).icon === 'clear-night'`, `(0,false).text === 'Klar'`; `describeWeather(123,true).text === 'Unbekannt'`; `severity(95) > severity(63) > severity(3) > severity(0)`; `iconSvg` enthält für jeden Namen `<svg`.
- [ ] Implementieren (Icons als zusammengesetzte SVG-Bausteine: Sonne, Mond, Wolke, Tropfen, Flocken, Blitz), grün, Commit.

### Task 4: Anzeigemodell (`public/js/model.js`)

**Test:** `tests/model.test.js` mit Fixture `tests/fixtures/forecast.js` (erzeugt eine Open-Meteo-förmige Antwort für beliebiges Startdatum)

**Consumes:** `time.js`, `weathercodes.js`

**Produces:**
- `buildModel(forecast, nowIso): Model`
  - `current: { temp, feels, code, isDay, text, icon, windSpeed, windDir, gusts, humidity, precip, uv }`
  - `hours: Hour[]` (48 ab aktueller Ortsstunde): `{ time, hhmm, temp, feels, precip, pop, wind, windDir, code, isDay, icon, uv, humidity, newDay: string|null }`
  - `days: Day[]`: `{ date, label, isPast, max, min, precipSum, pop, dayIcon, nightIcon, sunrise, sunset, uvMax }`, `label` = `Gestern` / `Heute` / Wochentag
  - `today: Day`, `summary: string`
- `nightCode(hourly, dateKey): number|null` – häufigster Code der Stunden 20–23 Uhr des Tages und 00–05 Uhr des Folgetags; bei Gleichstand höhere `severity`
- `fmtTemp(v): string` (`"17°"` / `"–"`), `fmtPct(v)`, `fmtMm(v)` (`"0,4 mm"`), `fmtKmh(v)`
- `uvLabel(uv)`: <3 Niedrig, <6 Mäßig, <8 Hoch, <11 Sehr hoch, sonst Extrem
- `windDirLabel(deg)`: 16-teilig deutsch (`N, NNO, NO, ONO, O, OSO, SO, SSO, S, SSW, SW, WSW, W, WNW, NW, NNW`)
- `windText(kmh)`: <2 Windstill, <12 Es ist ruhig, <29 Leichte Brise, <50 Frischer Wind, <75 Starker Wind, sonst Sturm
- `aqiLabel(eaqi)`: ≤20 Sehr gut, ≤40 Gut, ≤60 Mäßig, ≤80 Schlecht, ≤100 Sehr schlecht, sonst Extrem schlecht
- `pollenLevel(grains)`: null → null, <1 Keine, <10 Gering, <50 Mäßig, sonst Hoch
- `summarize(model): string` – z. B. `"Meistens bedeckt. Tiefsttemperatur 13°."`, bei Regen in den nächsten 12 h `"Regen ab ca. 15 Uhr."`

- [ ] Tests: `hours[0].time` ist die Ortsstunde von `nowIso` (Fixture ab `2026-11-14`, `nowIso = '2026-11-15T22:45'` → `'2026-11-15T22:00'`), `hours.length === 48`; `days[0].label === 'Gestern'`, `days[1].label === 'Heute'`, `days[2].label === 'Mo.'`; `today.date === '2026-11-15'`; `null` in `precipitation_probability` → `hours[i].pop === null` und `fmtPct(null) === '–'`; `fmtTemp(-0.4) === '0°'` (kein `-0°`); `fmtMm(0.44) === '0,4 mm'`; `nightCode` mit 6×Code 3 und 4×Code 61 → 3, bei 5/5 → 61; `windDirLabel(247.5) === 'WSW'`, `windDirLabel(360) === 'N'`; `uvLabel(0) === 'Niedrig'`; `aqiLabel(20) === 'Sehr gut'`; `nowIso` außerhalb des Datenbereichs → `hours` beginnt bei erster verfügbarer Stunde, kein Wurf; Antwort ohne `daily.sunrise` → `today.sunrise === null`.
- [ ] Implementieren, grün, Commit.

### Task 5: Gespeicherte Orte (`public/js/places.js`)

**Test:** `tests/places.test.js` (Fake-Storage mit `getItem`/`setItem`)

**Produces:**
- `createPlaceStore(storage): { list(): Place[], add(place): boolean, remove(id): void, move(id, toIndex): void, has(id): boolean }`
- `Place = { id: string, name, admin1: string|null, country: string|null, countryCode: string|null, lat: number, lon: number, timezone: string|null }`
- `placeSubtitle(place): string` → `"Sachsen, Deutschland"`; fehlende Teile werden ausgelassen
- Speicherschlüssel `wetter.places.v1`

- [ ] Tests: add → list enthält Ort und überlebt neuen Store auf gleichem Storage; zweites `add` mit gleicher `id` → `false`, Länge 1; `remove`; `move('c', 0)` auf `[a,b,c]` → `[c,a,b]`; `move` mit unbekannter id oder Index außerhalb → unverändert/geklemmt; Storage mit `"{kaputt"` → `list()` ist `[]`; Storage, dessen `setItem` wirft → `add` wirft nicht und `list()` enthält den Ort in dieser Sitzung; `placeSubtitle({admin1:null,country:'Spanien'}) === 'Spanien'`, beide null → `''`.
- [ ] Implementieren, grün, Commit.

### Task 6: API-Schicht (`public/js/api.js`)

**Test:** `tests/api.test.js`

**Produces:**
- `forecastUrl(lat, lon): string`, `airQualityUrl(lat, lon): string`, `geocodeUrl(query): string`, `reverseUrl(lat, lon): string`
- `placeFromGeocoding(result): Place` (id = `"geo-" + result.id`)
- `parseReverse(json): { name, admin1, country, countryCode }`
- `parseRadar(json): { host: string, frames: { time: number, path: string, kind: 'past'|'nowcast' }[] }`
- `radarTileUrl(host, path): string` → `` `${host}${path}/256/{z}/{x}/{y}/2/1_1.png` ``
- `fetchForecast(lat, lon)`, `fetchAirQuality(lat, lon)`, `searchPlaces(query): Promise<Place[]>`, `reverseGeocode(lat, lon)`, `fetchRadar()` – dünne `fetch`-Hüllen mit 12 s Timeout, werfen `Error` bei Nicht-200

- [ ] Tests: `forecastUrl(36.72,-4.42)` enthält `models=best_match`, `timezone=auto`, `past_days=1`, `forecast_days=8` und alle hourly/daily-Variablen der Spec; `geocodeUrl('São Paulo')` ist korrekt kodiert und enthält `language=de`, `count=8`; `placeFromGeocoding` ohne `admin1`/`country` → `null`-Felder; `parseRadar` mit leerem `nowcast` → nur `past`-Frames, mit Nowcast → angehängt und `kind: 'nowcast'`; `parseRadar({})` → `{ host: '', frames: [] }`; `parseReverse` bevorzugt `city` > `town` > `village` > `municipality`.
- [ ] Implementieren, grün, Commit.

### Task 7: Astro (`public/js/astro.js`)

**Test:** `tests/astro.test.js`

**Produces:**
- `moonPhase(date: Date): { phase: number (0–1), illumination: number (0–1), name: string }` – Namen: Neumond, Zunehmende Sichel, Erstes Viertel, Zunehmender Mond, Vollmond, Abnehmender Mond, Letztes Viertel, Abnehmende Sichel
- `daylight(sunriseIso, sunsetIso): { minutes: number, label: string } | null` → `"10 h 03 min"`
- `sunPosition(sunriseIso, sunsetIso, nowIso): number|null` (0 = Aufgang, 1 = Untergang, außerhalb <0/>1)

- [ ] Tests: `moonPhase(new Date('2000-01-06T18:14:00Z'))` → `name === 'Neumond'`, `illumination < 0.02`; `moonPhase(new Date('2000-01-21T04:40:00Z')).name === 'Vollmond'`; `daylight('2026-11-15T08:03','2026-11-15T18:13').label === '10 h 10 min'`; `daylight(null, x) === null`; `daylight(a, a)` → `minutes === 0`; `sunPosition` zur Mitte → `0.5`.
- [ ] Implementieren, grün, Commit.

### Task 8: UI – Hülle, Pager, Wetterseite

**Files:** Create `public/index.html`, `public/css/app.css`, `public/js/app.js`, `public/js/ui/pager.js`, `public/js/ui/page.js`, `public/js/ui/chart.js`, `public/js/cache.js`

**Consumes:** alles aus Task 2–7

- [ ] `cache.js`: `loadCached(id)`, `saveCached(id, {forecast, air, fetchedAt})` in localStorage (`wetter.cache.<id>`), fehlertolerant.
- [ ] `page.js`: `renderPage(place, model, air, meta): string` – Hero, Karten Stündlich/Täglich/Radar-Platzhalter, Kacheln UV, Feuchtigkeit, Wind, Niederschlag, Tageslicht, Mond, Luftqualität, Pollen (nur wenn Werte). `renderSkeleton(place)`, `renderError(place, message)`.
- [ ] `chart.js`: `tempCurve(temps: number[], colWidth, height): string` – SVG-Pfad (geglättet) + Punkte + Beschriftung.
- [ ] `pager.js`: horizontaler Scroll-Snap-Container, `setPages(places)`, `goTo(index)`, `onChange(cb)`, Punkte unten (erster Punkt = Standort-Pin), Tastatur ←/→.
- [ ] `app.js`: Zustand (Standort-Ort + gespeicherte Orte), Laden mit Cache-zuerst, Aktualisieren bei Alter > 10 min und bei `visibilitychange`, Tag/Nacht-Thema auf `<body>` (`theme-night`, `theme-day`, `theme-gray`), schwebende Kopf-Pille mit tickender Ortszeit.
- [ ] Im Browser prüfen (375 px breit): Seite rendert für Standort-Ersatzort, Stundenleiste scrollt, 48-h-Ansicht klappt auf.
- [ ] Commit.

### Task 9: UI – Ortsliste, Suche, Standort

**Files:** Create `public/js/ui/places-sheet.js`, `public/js/geo.js`; Modify `public/js/app.js`

- [ ] `geo.js`: `locate(): Promise<{lat, lon}>` (Geolocation, 10 s Timeout, deutsche Fehlermeldungen), letzter Standort in `wetter.lastPosition`.
- [ ] `places-sheet.js`: Overlay nach Vorlage; Liste mit Name, Region/Land, Datumszeile in Ortszeit, Icon + Temperatur, Max/Min; Suchfeld (ab 2 Zeichen, 300 ms Entprellung, veraltete Antworten verwerfen), Treffer mit Land; Standort-Knopf; Bearbeiten-Modus mit Ziehgriff (Pointer Events), ↑/↓-Knöpfen und Löschen.
- [ ] Im Browser prüfen: Ort suchen, hinzufügen, wischen, umsortieren, löschen, Neuladen behält Reihenfolge.
- [ ] Commit.

### Task 10: UI – Radar

**Files:** Create `public/js/ui/radar.js`, `public/vendor/leaflet/*`

- [ ] Leaflet 1.9.4 per `npm pack` nach `public/vendor/leaflet/` kopieren (js, css, images).
- [ ] `radar.js`: `mountRadar(el, place)` / `unmountRadar()` – Karte erst erzeugen, wenn die Karte der aktiven Seite sichtbar wird (IntersectionObserver); OSM-Kacheln mit Attribution; RainViewer-Layer je Frame (vorgeladen, per Opacity umgeschaltet, `maxNativeZoom: 7`); Schieberegler, Play/Pause, Zeit in Ortszeit, „Vorhersage“-Kennzeichnung bei Nowcast; Hinweis „In manchen Regionen gibt es kaum Radarabdeckung.“; RainViewer-Attribution.
- [ ] Im Browser prüfen: Kacheln laden, Regler wechselt Frames, Karte ziehen wechselt nicht den Ort.
- [ ] Commit.

### Task 11: PWA

**Files:** Create `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`, `public/fonts/*`, `tools/make-icons.mjs`

- [ ] Manifest: `name`/`short_name` „Wetter“, `lang: de`, `display: standalone`, `start_url: ./`, Farben aus dem Nacht-Thema, Icons 192/512 + maskable 512.
- [ ] `sw.js`: Precache der App-Hülle unter `wetter-shell-<VERSION>`, cache-first für Hülle, Netz für APIs/Kacheln, alte Caches beim Aktivieren löschen, Navigations-Fallback auf `index.html`.
- [ ] Icons aus SVG erzeugen (`tools/make-icons.mjs`), Schrift lokal ablegen.
- [ ] Im Browser prüfen: Manifest und Service Worker registriert, Offline-Neuladen zeigt letzten Stand.
- [ ] Commit.

### Task 12: Abschluss

- [ ] `npm test` grün; vollständiger Durchgang im Browser gegen die Spec; README mit Start-, Test- und Deploy-Anleitung.
- [ ] Push nach `github.com/aron0829/wetter-app`.
- [ ] Deployment auf wetter.mercao.de (Strato), HTTPS prüfen.
