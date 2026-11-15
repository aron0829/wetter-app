# Wetter-PWA – Design

Datum: 2026-11-15

## Absicht

Eine persönliche Wetter-App für genau einen Nutzer, als installierbare PWA unter
`https://wetter.mercao.de`. Sie soll sich wie die Vorlagen in `Designideen/` anfühlen
(dunkles, ruhiges Karten-Layout im Stil der Samsung-Wetter-App) und weltweit brauchbare
Daten liefern, ohne Konto, ohne Server, ohne API-Schlüssel.

## Ziele

- Aktueller Standort plus beliebig viele gespeicherte Orte weltweit, per Wischgeste wechselbar.
- Pro Ort: aktuelles Wetter, stündlich (48 h), täglich (gestern + 7 Tage), Regenradar,
  UV, Feuchtigkeit, Wind, Tageslicht.
- Alle Uhrzeiten in der Ortszeit des jeweiligen Ortes.
- Oberfläche Deutsch, °C, km/h.
- Installierbar, App-Hülle offline verfügbar, letzter Datenstand wird offline angezeigt.

## Nicht-Ziele

- Keine Konten, keine Synchronisation zwischen Geräten, kein Backend.
- Keine Push-Benachrichtigungen, keine Unwetterwarnungen.
- Keine Einstellungen für Einheiten oder Sprache.

## Anti-Ziele

- Falsche Uhrzeiten (Gerätezeit statt Ortszeit) – z. B. bei Orten in Südamerika.
- Eine App, die ohne Netz nur eine leere Seite zeigt.
- Wischgeste, die mit der Stundenleiste oder der Karte kollidiert.

## Rahmenbedingungen

- Hosting: statischer Webspace bei Strato (wetter.mercao.de). Nur statische Dateien.
- HTTPS ist Pflicht (Service Worker, Geolocation).
- Quellcode: `github.com/aron0829/wetter-app` (privat).
- RainViewer liefert Stand heute nur noch die letzten 2 Stunden (`nowcast` ist leer).
  Die App verarbeitet Nowcast-Frames, falls vorhanden, und kommt ohne sie aus.

## Ansätze

1. **Statische App ohne Build-Schritt (gewählt).** Reines HTML/CSS/JavaScript mit
   ES-Modulen, Leaflet und Schrift lokal mitgeliefert. Der Ordner `public/` ist exakt das,
   was auf den Webspace kommt. Tests der Logik mit dem in Node eingebauten Testrunner.
   Vorteil: nichts kann beim Bauen kaputtgehen, Deployment ist „Ordner hochladen“,
   in fünf Jahren noch lauffähig. Nachteil: kein Bundling, kein TypeScript.
2. **Vite + Framework (Svelte/React).** Komfortabler bei großen Apps, aber Build-Kette,
   Abhängigkeiten und Pflegeaufwand, die eine Ein-Personen-App mit einem Bildschirm nicht braucht.
3. **Vite + Vanilla TypeScript.** Mittelweg; bringt Typen, kostet aber weiterhin einen
   Build-Schritt vor jedem Upload.

Gewählt: Ansatz 1 (Entscheidung von Claude; der Nutzer hat das „Wie“ übergeben).

## Aufbau

```
public/                 ← wird 1:1 deployt
  index.html
  manifest.webmanifest
  sw.js                 Service Worker (App-Hülle cachen)
  css/app.css
  js/
    app.js              Start, Zustand, Verdrahtung
    api.js              Open-Meteo Forecast, Luftqualität, Geocoding, Reverse-Geocoding, RainViewer
    weathercodes.js     WMO-Code → Icon + deutsche Beschreibung (Tag/Nacht)
    icons.js            eigene SVG-Wettericons
    time.js             Ortszeit-Hilfen (ohne Date-Zeitzonenfallen)
    model.js            Rohdaten → Anzeigemodell (aktuelle Stunde, Tagesliste, Nacht-Icon, Texte)
    places.js           gespeicherte Orte (localStorage): hinzufügen, löschen, sortieren
    astro.js            Mondphase, Tageslichtdauer
    ui/                 pager.js, page.js (Karten), chart.js (Temperaturkurve),
                        places-sheet.js (Ortsliste + Suche), radar.js
  vendor/leaflet/       Leaflet lokal
  fonts/                Plus Jakarta Sans (variable, woff2)
  icons/                App-Icons (192, 512, maskable, apple-touch)
tests/                  node:test für weathercodes, time, model, places, api-URLs, astro
```

## Daten

- **Vorhersage:** `api.open-meteo.com/v1/forecast` mit `models=best_match`, `timezone=auto`,
  `past_days=1`, `forecast_days=8`.
  - current: Temperatur, gefühlt, is_day, weather_code, Wind (Geschw./Richtung/Böen), Feuchte, Niederschlag, UV
  - hourly: Temperatur, gefühlt, Niederschlag, Regenwahrscheinlichkeit, Wind, weather_code, UV, is_day, Feuchte
  - daily: weather_code, Min/Max, Niederschlagssumme, Regenwahrscheinlichkeit (max), Sonnenauf-/untergang, UV max
- **Luftqualität/Pollen (Zusatz aus den Vorlagen):** `air-quality-api.open-meteo.com`,
  `european_aqi` + Pollen. Pollenkarte nur, wenn Werte vorhanden sind (nur Europa).
- **Ortssuche:** `geocoding-api.open-meteo.com/v1/search`, `language=de`, 8 Treffer;
  Anzeige „Name – Region, Land“. Zeitzone des Treffers wird mitgespeichert.
- **Name des aktuellen Standorts:** Open-Meteo kann kein Reverse-Geocoding, daher
  Nominatim (OpenStreetMap) mit `accept-language=de`; Ergebnis wird gecacht.
  Fallback: „Aktueller Standort“.
- **Radar:** RainViewer `weather-maps.json`, Kacheln auf Leaflet mit OSM-Hintergrund,
  Zeitleiste mit Play/Pause, Zeiten in Ortszeit, Hinweis zur Radarabdeckung.

## Zeit

Open-Meteo liefert mit `timezone=auto` naive Ortszeit-Strings (`2026-11-15T22:45`) und den
IANA-Zeitzonennamen. Die App rechnet mit diesen Strings und wandelt sie nie über `Date`
in Gerätezeit um. „Jetzt am Ort“ kommt aus `Intl.DateTimeFormat` mit `timeZone`.

## Oberfläche (nach den Vorlagen)

- Kopf: Ortsname mit Pin, Listen-Symbol; beim Scrollen eine schwebende Pille mit
  Ortsname, Ortszeit und Listen-Symbol.
- Hero: große Temperatur, Beschreibung, ↑Max / ↓Min, „Gefühlt wie“, Land und Ortszeit.
- Karte „Stündlich“: Kurztext, horizontale Leiste (Uhrzeit, Icon, Regen-%, Temperaturkurve),
  aufklappbar auf 48 Stunden inkl. Niederschlag und Wind.
- Karte „Täglich“: Gestern, Heute, Folgetage mit Regen-%, Tag- und Nacht-Icon, Max/Min.
- Karte „Radar“.
- Kacheln: UV-Index, Feuchtigkeit, Wind (Kompass), Niederschlag, Tageslicht (Sonnenbogen),
  Mond (Phase), Luftqualität, Pollen.
- Ortsliste als Overlay: Orte mit Region/Land, Ortszeit, Icon und Temperatur; Suche;
  Standort-Knopf; Bearbeiten-Modus zum Sortieren (Ziehen + Pfeile) und Löschen.
- Wechsel zwischen Orten: horizontaler Pager mit CSS Scroll-Snap (native Wischgeste),
  Punkte unten; Stundenleiste und Karte fangen ihre eigenen Gesten ab.
- Tag/Nacht: Icons je nach `is_day`; Hintergrundverlauf Nacht (Vorlage), Tag (Blau),
  Tag bedeckt/Regen (Graublau).

## Offline und Aktualität

- Service Worker cacht die App-Hülle (versioniert); API-Antworten laufen am Netz.
- Letzte Vorhersage je Ort liegt in localStorage und wird sofort angezeigt, dann aktualisiert
  (älter als 10 Minuten oder beim Zurückkehren in die App). Bei Fehler: alter Stand mit
  Hinweis „Stand: …“.

## Dem Bauenden überlassen

Genaue Abstände, Farben und Icon-Formen (an den Vorlagen orientiert), Formulierungen der
Kurztexte, Umfang der 48-Stunden-Ansicht.
