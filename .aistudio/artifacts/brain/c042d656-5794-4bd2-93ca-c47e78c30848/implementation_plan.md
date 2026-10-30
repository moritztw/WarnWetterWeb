# WarnWetter Web — Interaktives DWD-Wetter- & Warnsystem

Eine schlanke, werbefreie Webanwendung im Stil der offiziellen DWD WarnWetter-App, die amtliche Unwetterwarnungen, aktuelle SYNOP-Stationsmesswerte, stündliche MOSMIX-Vorhersagen sowie eine interaktive Deutschland-Warnkarte mit Niederschlagsradar visuell präzise aufbereitet.

## Nutzerentscheidungen & Gesetzte Eckpunkte

> [!IMPORTANT]
> Alle vier Kernentscheidungen aus Schritt 1 sind im Architektur- und Designkonzept verankert. Nach Freigabe dieses Plans erfolgt die Umsetzung sauber getrennt in testbaren Paketen inklusive automatisierter Node-Standard-Tests (`node:test`).

- **Bestätigte Datenstrategie**: **Bright Sky API** (`current_weather`, `weather`, `alerts`) kombiniert mit **Open-Meteo Geocoding** für die deutschlandweite Ortssuche sowie offiziellen **DWD GeoServer WMS-Layern** (`maps.dwd.de`) für Warngebiete und Radar.
- **Bestätigter Funktionsumfang**: Vollständige Erstausbaustufe mit amtlichen Warnungen, Stationsmesswerten, interaktiven Vorhersage-Kurven (Meteogramm) sowie interaktiver Deutschland-Warnkarte und Regenradar.
- **Bestätigtes Erscheinungsbild**: Umschaltbares Dual-Theme (**Dark Mode als Standard**, wechselbar zu klarem Behörden-Light-Mode).
- **Bestätigte Favoriten-Verwaltung**: Datenschutzfreundlich und wartungsfrei lokal im Browser via `localStorage` (plus Browser-GPS-Standortabfrage auf Wunsch).
- **Empfohlener Default für Diagramme (KISS)**: Verzicht auf schwere Diagramm-Bibliotheken (wie Recharts/Chart.js) zugunsten einer schlanken, maßgeschneiderten SVG-Komponente; lediglich `leaflet` wird als gezielte Karten-Abhängigkeit für flüssiges Zoomen und WMS-Tile-Rendering eingesetzt.

---

## 1. Überblick & Kernkonzept

- **Funktionsweise**: Nutzer wählen per Suche, Favoritenleiste, GPS oder direktem Kartenklick einen beliebigen Ort in Deutschland aus. Die Anwendung zeigt sofort aktive amtliche DWD-Warnungen inklusive Verhaltenshinweisen, aktuelle Messwerte der nächstgelegenen DWD-Wetterstation, ein interaktives 48-Stunden-Meteogramm, den 7-Tage-Trend sowie eine interaktive Karte mit Gemeinde-Warnpolygonen und Niederschlagsradar.
- **Zielgruppe**: Bürgerinnen und Bürger, Outdoor-Aktive sowie Einsatz- und Planungsorientierte, die schnelle, verlässliche und unaufgeregte meteorologische Informationen ohne Werbe-Ballast benötigen.
- **Mehrwert**: Verbindet die sachliche Klarheit der mobilen DWD WarnWetter-App mit einer großzügigen 1440px-Desktop-Übersicht und vollständiger mobiler Bedienbarkeit.

---

## 2. Nutzererlebnis & Visuelles Design

### Zentrale Nutzungsabläufe (User Flows)
1. **Sofort-Einstieg (Zero-State mit sinnvoll gesetztem Startort)**: Beim ersten Laden startet die App im Dark Mode mit einem vorkonfigurierten Referenzort (z. B. Frankfurt am Main / Offenbach – Sitz des DWD) oder den gespeicherten Favoriten, sodass sofort echte Live-Daten und die Deutschlandkarte sichtbar sind.
2. **Ortswechsel & Favoriten**: Über den Suchdialog in der Kopfzeile (oder die Schnellwahl-Leiste darunter) sucht der Nutzer nach Gemeinden/Postleitzahlen, nutzt die GPS-Ortung oder speichert Orte per Stern-Schaltfläche dauerhaft in seinen lokalen Favoriten.
3. **Warnungs-Inspektion**: Liegen für den Ort amtliche DWD-Warnungen vor, erscheint oberhalb der Messwerte ein strukturierter Warnblock mit offizieller DWD-Warnstufe, Gültigkeitszeitraum (`von – bis`), Beschreibungstext und ausklappbaren Handlungsempfehlungen. Liegt keine Warnung vor, erscheint ein ruhiger Statushinweis (`Keine amtlichen Warnungen aktiv`).
4. **Interaktive Warnkarte & Regenradar**: Nutzer schalten per Segmented Control zwischen *Amtlichen Warngebieten (Gemeinden)*, *Niederschlagsradar* und *Kombi-Ansicht* um, regeln die Deckkraft, animieren vergangene/aktuelle Radar-Zeitschritte und können direkt in die Karte klicken, um das Wetter für diese Koordinate zu laden.
5. **Vorhersage-Analyse**: Im interaktiven SVG-Meteogramm fährt der Nutzer mit Maus oder Finger per Fadenkreuz über die nächsten 48 Stunden und liest exakte Stundenwerte für Temperatur, Niederschlagswahrscheinlichkeit/-menge, Taupunkt und Windböen ab.

### Visuelle Identität & Theme (DWD WarnWetter-Ästhetik)
- **Ästhetische Leitlinie**: Meteorologisches Präzisions- und Zivilschutz-Interface – sachlich, kontraststark, aufgeräumt, null dekorative Spielereien.
- **60-30-10 Farbverteilung & Dual-Theme**:
  - *Dark Mode (Standard)*: 60 % tiefes Radar-Schiefer (`#0B1120` / `slate-950`), 30 % flache Instrumenten-Flächen (`#111827` / `slate-900`) mit 1px-Haarlinien (`#1E293B`), 10 % DWD-Kobaltblau (`#3B82F6`) für aktive Steuerungen und Fokus-Zustände.
  - *Light Mode*: 60 % klares Hellgrau (`#F8FAFC`), 30 % reinweiße Panels (`#FFFFFF`) mit `slate-200`-Haarlinien, 10 % DWD-Behördenblau (`#1D4ED8`).
  - *Offizielle DWD-Warnfarben (niemals nur über Farbe, immer mit Warnsymbol + explizitem Stufen-Textlabel)*:
    - **Stufe 1 – Wetterwarnung**: Gelb (`#EAB308`)
    - **Stufe 2 – Markantes Wetter**: Orange (`#F97316`)
    - **Stufe 3 – Unwetterwarnung**: Rot (`#DC2626`)
    - **Stufe 4 – Extremes Unwetter**: Violett (`#9333EA`)
    - **Vorabinformation**: Schraffiertes Kennzeichen + Label *Vorabinformation Unwetter*
- **Typografie & Tabellarische Disziplin (2+1 Regel)**:
  - *Display & Navigation*: `Plus Jakarta Sans` (klare geometrische Struktur für Ortsnamen und Sektionsköpfe).
  - *Fließtext & amtliche Warntexte*: `Public Sans` (optimiert für schnelle Lesbarkeit behördlicher Informationstexte).
  - *Messwerte, Zeitstempel & Koordinaten*: `IBM Plex Mono` mit `tabular-nums`, damit Temperaturen, Luftdruck (`hPa`), Windgeschwindigkeiten (`km/h`) und Uhrzeiten exakt vertikal fluchten.
- **Räumliche Architektur & Anti-Slop-Regeln**:
  - Einhaltung des einzeiligen 3-Zonen-Top-Bar-Kontrakts (`WarnWetter Web` | `Übersicht`, `Warnkarte`, `Meteogramm`, `7-Tage-Trend` | `Ort suchen`).
  - Favoriten-Schnellwahl, GPS-Button und Hell/Dunkel-Schalter liegen sauber geordnet in der kontextuellen Orts-Werkzeugleiste unterhalb der Kopfzeile.
  - Flache Single-Elevation-Panels mit 1px-Rahmen rundum (keine verschachtelten Karten, keine dicken linken Farbbalken, keine Pill-Badges um statische Metadaten wie Stationshöhe oder Modelllauf – stattdessen ruhige Trennung per `·`).

### Interaktives Feedback & Zustände
- Verzögerungsfreie Übergänge ($\le 180\text{ms}$) ausschließlich über `opacity` und `transform`.
- Vollständige Zustandsabdeckung für alle Bereiche: präzise Skeleton-Platzhalter beim Datenabruf, klare Leermeldungen (z. B. wenn ein Ort außerhalb des DWD-Abdeckungsgebiets liegt) und fehlertolerantes Retry-Banner bei Netzwerkproblemen.

---

## 3. Wichtige Architektur-Entscheidungen & Abwägungen (KISS)

- **Entscheidung 1: Backend-Proxy mit In-Memory-Cache statt direkter Browser-Aufrufe**
  - *Gewählter Ansatz*: Ein kompakter Express-Endpunkt bündelt `/current_weather`, `/weather` und `/alerts` von Bright Sky in einem einzigen Request pro Ortswechsel und hält Antworten 5 Minuten im Arbeitsspeicher.
  - *Warum*: Reduziert Client-Requests von 3 auf 1, verhindert CORS-Probleme, validiert Koordinaten zentral und macht Ortswechsel zwischen Favoriten nahezu verzögerungsfrei.
  - *Verworfene Alternative*: Einzelne ungepufferte Fetch-Aufrufe direkt aus React (höhere Latenz, unnötige API-Last bei schnellem Favoriten-Wechsel).

- **Entscheidung 2: Offizielle DWD OGC-WMS-Layer + RainViewer-Zeitachse auf Leaflet**
  - *Gewählter Ansatz*: Einsatz von `leaflet` mit themengerechter CartoDB-Basiskarte (Dark/Light) und direkter Einbindung des DWD GeoServers (`dwd:Warnungen_Gemeinden_vereinigt` & `dwd:Niederschlagsradar`) ergänzt um animierbare Radar-Zeitschritte.
  - *Warum*: Authentische amtliche DWD-Kartendarstellung ohne API-Schlüssel-Zwang, minimale Bundle-Größe und volle Interaktivität inklusive Koordinaten-Klick.
  - *Verworfene Alternative*: Statische Einzelbilder vom DWD-FTP (kein stufenloses Zoomen auf Gemeindeebene möglich).

- **Entscheidung 3: Natives SVG-Meteogramm statt externer Chart-Bibliothek**
  - *Gewählter Ansatz*: Schlanke, typisierte SVG-Komponente (~120 Zeilen) für Temperaturverlauf, Niederschlagsbalken und Hover-Fadenkreuz.
  - *Warum*: Spart >150 KB Bundle-Gewicht, volle Kontrolle über DWD-Farbgebung im Dark/Light-Mode und null Abhängigkeitsrisiko.

---

## 4. Technische Architektur & Datenstrategie

### System- & Komponenten-Diagramm

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Browser Client (React 19)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: Marke │ Navigation (Übersicht/Karte/Verlauf) │ Ort suchen  │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Kontext-Leiste: Aktiver Ort · Stationsmeta │ Favoriten │ GPS │ ☀/☾  │  │
│  └───────────────┬──────────────────────────────────┬──────────────────┘  │
│                  ▼                                  ▼                     │
│  ┌───────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Linke/Obere Hauptspalte       │  │ Rechte/Interaktive Kartenspalte  │  │
│  │ • Amtlicher DWD-Warnblock     │  │ • Leaflet Deutschland-Karte      │  │
│  │   (4 Warnstufen + Hinweise)   │  │ • Layer-Umschalter:              │  │
│  │ • Aktuelle SYNOP-Messwerte    │  │   [Warngebiete] [Radar] [Kombi]  │  │
│  │   (Temp, Böen, hPa, Feuchte)  │  │ • Radar-Zeitregler & Legende     │  │
│  └───────────────┬───────────────┘  └───────────────┬──────────────────┘  │
│                  └──────────────────┬───────────────┘                     │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Zeitreihen-Sektion:                                                 │  │
│  │ • Interaktives 48h SVG-Meteogramm (Temp, Regen mm, Wind, Crosshair) │  │
│  │ • Kompakte 7-Tage-Tagesübersicht (Min/Max-Spanne, Symbol, Regen)    │  │
│  └──────────────────────────────────┬──────────────────────────────────┘  │
│                                     │                                     │
│         localStorage (Favoriten & Theme)                                  │
└─────────────────────────────────────┼─────────────────────────────────────┘
                                      │ GET /api/weather?lat=..&lon=..
                                      │ GET /api/search?q=..
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                Node.js / Express Server (Port 3000 + Cache)               │
│  • Parameter-Validierung (Koordinaten-Grenzen, Sanitisierung)             │
│  • 5-Minuten TTL In-Memory-Cache für schnelle Ortswechsel                 │
│  • Automatisierte Unit-/Integrations-Tests via Standard `node:test`       │
└──────────────────┬─────────────────────────────────────┬──────────────────┘
                   │                                     │
                   ▼                                     ▼
     ┌───────────────────────────┐         ┌───────────────────────────┐
     │ Bright Sky API (DWD Data) │         │ Open-Meteo Geocoding API  │
     │ • /current_weather        │         │ • /v1/search (DE/Europa)  │
     │ • /weather (MOSMIX 7d)    │         └───────────────────────────┘
     │ • /alerts (CAP Warnungen) │         ┌───────────────────────────┐
     └───────────────────────────┘         │ DWD GeoServer OGC WMS     │
                                           │ • Warnungen_Gemeinden     │
                                           │ • Niederschlagsradar      │
                                           └───────────────────────────┘
```

### Datenmodell & Zustandsverwaltung
- **`ActiveLocation`**: `{ id, name, adminArea, latitude, longitude, elevation }` – hält den aktuell fokussierten Ort; Änderungen triggern den kombinierten Wetterabruf und zentrieren optional die Karte.
- **`FavoritesStore` (`localStorage`)**: Persistente Liste gespeicherter `ActiveLocation`-Einträge (inkl. Duplikatschutz, Hinzufügen/Entfernen mit einem Klick).
- **`WeatherBundle`**: Normiertes Antwortobjekt des Backend-Proxys bestehend aus:
  - `current`: Aktuelle Stationsmessung inkl. Stationsname, Entfernung und Messzeitpunkt.
  - `hourly`: 48-Stunden-Zeitreihe für das Meteogramm.
  - `daily`: Aggregierte 7-Tage-Werte (Tiefst-/Höchsttemperatur, Niederschlagssumme, maximale Böe, Wetterzustand).
  - `alerts`: Sortierte Liste amtlicher DWD-Warnungen (absteigend nach Warnstufe 4 → 1, inkl. deutschen Stufenbezeichnungen und Verhaltenshinweisen).
- **`MapState`**: Aktiver Layer-Modus (`warnings` | `radar` | `both`), Deckkraft (`0.4`–`0.9`), Radar-Animationsstatus (`playing`, aktueller Zeitstempel) und ausgewählte Warnstufen-Legende.

### Interaktive Komponenten- & Handler-Zuordnung
- **Ortssuche-Modal**: Debounced Eingabe (300 ms) → `/api/search` → Tastatur- und Mausauswahl → setzt `ActiveLocation` und schließt Modal.
- **GPS-Standort-Button**: Nutzt `navigator.geolocation` mit sauberem Timeout/Fehler-Fallback (falls Berechtigung im iFrame verweigert wird, klare Statusmeldung ohne Browser-`alert()`).
- **Warnkarten-Interaktion**: Klick auf beliebige Stelle innerhalb Deutschlands aktualisiert über Reverse-Koordinaten direkt die Ortsansicht („Wetter an Kartenpunkt prüfen“).
- **Inkrementelle Umsetzung & Qualitätssicherung**:
  1. *Paket 1*: Backend-Proxy, Daten-Normalisierung, DWD-Warnstufen-Logik & automatisierte `node:test`-Suite.
  2. *Paket 2*: Grundlayout, Dual-Theme (`@custom-variant dark`), Ortssuche, Favoriten (`localStorage`), Warnbanner & Stationsmesswerte.
  3. *Paket 3*: Interaktive Leaflet-Warnkarte mit DWD-WMS-Layern, Regenradar-Steuerung, 48h-SVG-Meteogramm, 7-Tage-Trend & `README.md`-Dokumentation.
