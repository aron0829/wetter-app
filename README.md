# Wetter

Persönliche Wetter-App als Progressive Web App: aktueller Standort, beliebig viele gespeicherte
Orte weltweit, stündliche und tägliche Vorhersage, Regenradar. Oberfläche auf Deutsch, °C und km/h,
alle Uhrzeiten in der Ortszeit des jeweiligen Ortes.

Live: <https://wetter.mercao.de>

## Aufbau

Statische App ohne Build-Schritt. Der Ordner `public/` ist genau das, was auf den Webspace kommt.

```
public/
  index.html, manifest.webmanifest, sw.js
  css/app.css
  js/            Logik (ohne DOM): time, weathercodes, model, places, api, astro
  js/ui/         Oberfläche: page, pager, places-sheet, radar, chart
  vendor/leaflet Leaflet 1.9.4 (lokal, kein CDN)
  fonts/         Plus Jakarta Sans (lokal)
  icons/         App-Icons
tests/           Tests der Logik (node:test)
tools/           lokaler Server, Icon-Erzeugung
Designideen/     Designvorlagen
docs/            Design und Umsetzungsplan
```

## Entwickeln

```bash
npm run serve   # http://localhost:5173
npm test        # Tests der Logik
npm run icons   # App-Icons neu erzeugen (braucht einmalig: npm install)
```

Die App selbst hat keine Abhängigkeiten; `npm install` wird nur für `npm run icons` gebraucht.

## Veröffentlichen

Ein Push auf `main` genügt: Der Workflow `.github/workflows/deploy.yml` lässt die Tests laufen und
veröffentlicht `public/` über GitHub Pages. `wetter.mercao.de` zeigt per CNAME (bei STRATO) auf
`aron0829.github.io`; das Zertifikat stellt GitHub aus, HTTPS ist erzwungen.

HTTPS ist Pflicht: ohne SSL funktionieren weder Standortabfrage noch Installation als App.

Nach einem Update zeigt die App beim ersten Öffnen noch den alten Stand und lädt den neuen im
Hintergrund; ab dem zweiten Öffnen ist er aktiv. Wer ein Update erzwingen will, erhöht `VERSION`
in `public/sw.js`.

## Datenquellen

| Zweck | Quelle |
|---|---|
| Vorhersage | [Open-Meteo](https://open-meteo.com/) Forecast API, `models=best_match`, `timezone=auto` |
| Luftqualität, Pollen | Open-Meteo Air Quality API (Pollen nur in Europa) |
| Ortssuche | Open-Meteo Geocoding API |
| Name des aktuellen Standorts | [Nominatim](https://nominatim.org/) (OpenStreetMap) |
| Radar | [RainViewer](https://www.rainviewer.com/api.html) – derzeit nur die letzten 2 Stunden, kein Nowcast |
| Karte | [OpenStreetMap](https://www.openstreetmap.org/copyright) über [Leaflet](https://leafletjs.com/) |

Alle Quellen funktionieren ohne API-Schlüssel. Gespeicherte Orte und der letzte Datenstand liegen
nur im Browser (`localStorage`).
