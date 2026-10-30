# WarnWetter Web

Schlanke, werbefreie Webanwendung im Stil der offiziellen DWD WarnWetter-App zur Darstellung amtlicher Unwetterwarnungen, aktueller SYNOP-Stationsmesswerte, einer punktgenauen 2-Stunden-Regenradar-Vorhersage, einer synchronisierten Mehrfach-Diagrammansicht sowie einer interaktiven Deutschland-Warn- und Radarkarte auf Basis von **DWD Open Data**.

## Funktionsumfang

- **Amtliche DWD-Warnlage**: 4-Stufen-Farbsystem (Gelb, Orange, Rot, Violett) sowie Vorabinformationen inklusive Gültigkeitszeiträumen und ausklappbaren Verhaltenshinweisen.
- **Aktuelle SYNOP-Stationsmesswerte**: Temperatur, Taupunkt, Luftdruck (MSL), Windgeschwindigkeit, Spitzenböen, Kompassrichtung, Sichtweite, Bewölkung und Sonnenscheindauer der nächstgelegenen DWD-Messstation.
- **2-Stunden-Regenradar-Vorhersage (Standort-Nowcast)**: Punktgenauer 5-Minuten-Niederschlagsverlauf (-30 Min. Messung bis +120 Min. DWD-RV-Radarvorhersage in 1×1 km Auflösung).
- **Interaktive Live- & Prognosekarte (Mehrfach-Ebenenauswahl)**:
  - Amtliche Open-Data-Basiskarte **BKG TopPlusOpen** (`web_grau`, `dl-de/by-2-0`, ohne API-Key) mit CSS-Dark-Mode-Anpassung.
  - Frei kombinierbare Ebenen-Auswahlliste (`512px`-WMS-Kachelung für schnelle Ladezeiten):
    1. **Warngebiete**: Amtliche Gemeindewarnungen (`dwd:Warnungen_Gemeinden_vereinigt`).
    2. **Regen**: Zeitgesteuertes 1-km-Radarkomposit (`dwd:Radar_rv_product_1x1km_ger`, -60 Min. Messung bis +120 Min. Prognose).
    3. **Wolken**: Verzögerungsfreies HTML5-Canvas-Overlay aus dem **DWD ICON-D2** Modellgitter (-60 Min. Messung bis +120 Min. Prognose, räumlich & zeitlich interpoliert).
    4. **Gewitter**: 5-Minuten-Blitzdichte & Gewitterzellen (`dwd:Blitzdichte`, `dwd:Gewittercluster`) mit automatischem Wechsel auf das elektrische Vorhersageprodukt `dwd:NCEW_EU` (*NowCastELEC*) ab „Jetzt“.
  - Direkte Wetter- und Radarabfrage per Klick in die Karte.
- **Kombinierte WarnWetter-Stunden- & Diagrammansicht (Endlos scrollbar mit Trennlinien)**:
  - Obere Tageskachel-Leiste (inkl. Rückblick „Gestern“, „Heute“ und 7 Vorhersagetage) bidirektional gekoppelt mit der endlosen Stunden-Zeitleiste.
  - Durchgehende Mitternachts-Tagestrennlinien (`00:00`), markierte „Prognose“-Grenze und synchronisiertes Stunden-Fadenkreuz mit Live-Popovern über alle **6 Blöcke**:
    1. *Temperatur & Niederschlag* inkl. Modellstreuungsband und Zeile *Niederschlagswahrscheinlichkeit (%)*
    2. *Wind & Böen in km/h* inkl. gedrehter Windrichtungspfeile
    3. *Taupunkt & Temperatur & Feuchte* (blaue Stundensäulen + Kurven)
    4. *Luftdruck in hPa*
    5. *Bewölkung in %* (stündlicher DWD-MOSMIX-Bedeckungsgrad 0–100 %)
    6. *Sonne & Mond* (lokal berechnete Sonnen- und Mondbahnen inkl. Auf- und Untergangszeiten ohne Zusatzbibliothek)
- **7-Tage-Vorhersage**: Kompakte Wochenübersicht mit Direkt-Sprung in den jeweiligen Tag der Endlos-Diagrammansicht.

## Lokales Setup & Ausführung

```bash
npm install
npm run dev
```

Tests, Typprüfung & Produktions-Build:

```bash
npm test
npm run lint
npm run build
```

## Self-Hosting mit Docker Compose

Startet die Anwendung als gehärteten Einzel-Container (`node:22-alpine`, Non-Root, Read-Only-Dateisystem, 256 MB RAM-Limit) auf Port `3000`:

```bash
docker compose up -d --build
```

Hinter einem lokalen Reverse-Proxy (z. B. Nginx, Caddy, Traefik, Pangolin) lässt sich der Port ausschließlich lokal binden:

```bash
HOST_BIND=127.0.0.1:3000 docker compose up -d --build
```

