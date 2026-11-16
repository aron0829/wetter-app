# Niederschlagsmenge je Stunde und lebendigerer Himmel

Stand: 2026-11-16. Kurzdesign, Entscheidungen von Claude getroffen (Aron: „selbst entscheiden").

## Wunsch

1. Die Stundenübersicht soll neben der Regenwahrscheinlichkeit auch die Menge in mm zeigen,
   darunter, wie in der Wochenübersicht.
2. Coolere Hintergrundanimationen. Frage dazu: Geht das mit Claude Motion?
3. Direkt deployen.

## Wege für die Animationen

- **Claude Motion:** erzeugt fertige MP4-Erklärvideos im Chat (Beta, Team/Enterprise). Ein
  Video als Hintergrund wäre groß, liefe nicht offline aus dem App-Cache und könnte nicht
  auf Wind, Regenstärke oder Uhrzeit reagieren. Verworfen.
- **WebGL-Shader (Wolken aus Rauschen):** sähe am weichsten aus, kostet auf dem Handy aber
  spürbar Akku und braucht einen zweiten Zeichenweg als Rückfall. Verworfen.
- **Vorhandenes Canvas ausbauen (gewählt):** bleibt klein, offline-fähig und sparsam, und die
  Szene kann an echten Messwerten hängen.

## Umsetzung

- `js/ui/page.js`: je Stunde `<small>` mit `fmtMm` unter der Wahrscheinlichkeit, nur ab
  0,05 mm (sonst stünde überall „0,0 mm"). Farbe wie in der Wochenübersicht (`--rain`).
- `js/scene.js`: neue reine Funktion `ambienceFor` – Wind 0…1 (60 km/h = 1) und Dämmerung
  0…1 (45 Minuten um Sonnenauf-/-untergang).
- `js/ui/sky.js` neu:
  - Wolken, Regen und Schnee in drei Tiefenebenen; Wind treibt Wolken und neigt Niederschlag
  - Sonne mit zweiter Strahlenebene, Linsenreflexen und Staub im Licht
  - Nacht: Mond in echter Phase (aus `astro.js`), Sternkreuze, Sternschnuppen
  - Gewitter: verzweigte Blitze zusätzlich zum Wetterleuchten
  - Dämmerung: warmer Horizont
  - Parallaxe beim Scrollen (`sky.scroll`)
- `prefers-reduced-motion` bleibt respektiert: dann ein Standbild ohne Blitz und Sternschnuppe.
- Service Worker auf `v3`.

## Nicht Teil davon

Neue Farbverläufe je Szene, Geräusche, Neigungssensor.
