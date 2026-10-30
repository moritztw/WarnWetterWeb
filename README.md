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

Startet die Anwendung als gehärteten Einzel-Container (`node:22-slim`, Non-Root, Read-Only-Dateisystem, 256 MB RAM-Limit) auf Port `3000`:

```bash
docker compose up -d --build
```

Hinter einem lokalen Reverse-Proxy (z. B. Nginx, Caddy, Traefik, Pangolin) lässt sich der Port ausschließlich lokal binden:

```bash
HOST_BIND=127.0.0.1:3000 docker compose up -d --build
```

## Transparenzhinweis zum KI-Einsatz (AI Full Disclosure)

- **KI-gestützte Softwareentwicklung (Vibe Coding):** Konzeptionelle Ausarbeitung, Anwendungslogik (Frontend, Backend-Proxy, astronomische und meteorologische Berechnungen, automatisierte Tests), Containerisierung (`Dockerfile`, `docker-compose.yml`) sowie Projektdokumentation wurden maßgeblich mithilfe großer Sprachmodelle (LLMs) im Rahmen eines iterativen KI-gestützten Entwicklungsprozesses erstellt.
- **Menschliche Steuerung & Qualitätskontrolle:** Architekturentscheidungen, fachliche Anforderungen, Sicherheitsvorgaben (Container-Härtung, Input-Validierung), Code-Reviews, Funktionstests sowie Deployment und Freigabe erfolgten durchgehend unter menschlicher Kontrolle und Verantwortung.
- **Kein KI-Einsatz zur Laufzeit (Zero Runtime AI):** Die produktive Anwendung enthält **keinerlei** KI-Modelle, Chatbots oder LLM-Schnittstellen. Zur Laufzeit werden ausschließlich deterministische Algorithmen ausgeführt und öffentliche Wetter- bzw. Geodaten-Schnittstellen abgefragt. Es werden zu keinem Zeitpunkt Nutzer- oder Standortdaten an KI-Dienste übertragen.

## Rechtliche Hinweise, Datenlizenzen & Haftungsausschluss

### 1. Inoffizielles Projekt & Markenhinweis
Dieses Repository ist ein unabhängiges, privates Open-Source-Projekt und steht in **keinerlei organisatorischer, wirtschaftlicher oder amtlicher Verbindung zum Deutschen Wetterdienst (DWD)** oder anderen genannten Institutionen. „WarnWetter“ ist eine geschützte Bezeichnung des Deutschen Wetterdienstes; die Bezugnahme erfolgt ausschließlich beschreibend zur Einordnung der visualisierten offenen DWD-Datenbestände.

### 2. Haftungsausschluss bei Unwetter- & Gefahrenlagen
Alle dargestellten Messwerte, Vorhersagen, Radarbilder und Unwetterwarnungen werden automatisiert über externe Schnittstellen abgerufen, zwischengespeichert und grafisch aufbereitet. Es wird **keinerlei Gewähr für Richtigkeit, Vollständigkeit, Aktualität oder ständige Verfügbarkeit** übernommen. Verzögerungen, Darstellungsfehler oder Schnittstellenausfälle können jederzeit auftreten.

> **Wichtiger Warnhinweis:** Diese Webanwendung ersetzt im Gefahren- oder Katastrophenfall **keine** offiziellen behördlichen Warnkanäle (wie die offizielle DWD-WarnWetter-App, NINA, Katwarn oder Rundfunkdurchsagen). Entscheidungen zum Schutz von Leben, Gesundheit und Sachwerten dürfen niemals allein auf Grundlage dieser Anwendung getroffen werden.

### 3. Datenquellen & Nutzungsbedingungen Dritter
Die MIT-Lizenz dieses Projekts gilt ausschließlich für den **Quellcode der Software**, nicht für die zur Laufzeit bezogenen Wetter-, Radar- und Geodaten. Beim Betrieb einer eigenen Instanz sind die jeweiligen Lizenzbedingungen der Datenanbieter einzuhalten:

- **Deutscher Wetterdienst (DWD Open Data & GeoServer WMS):**
  - *Umfang:* SYNOP-Stationsmeldungen, MOSMIX-Vorhersagen, amtliche CAP-Gemeindewarnungen, RV-Radarkomposit (`1×1 km`), Blitzdichte, Gewittercluster und NowCastELEC.
  - *Lizenz & Pflichtangabe:* Bereitgestellt gemäß § 7 DWD-Gesetz (DWDG) i. V. m. der Geodatennutzungsverordnung (GeoNutzV) sowie den [DWD Open-Data-Nutzungsbedingungen](https://www.dwd.de/DE/service/copyright/copyright_node.html) (*Quelle: Deutscher Wetterdienst*).
  - *Verarbeitungshinweis gemäß DWD-Vorgaben:* Die Originaldaten des DWD werden durch diese Software zeitlich zusammengeführt, räumlich interpoliert und grafisch neu dargestellt.
- **Bundesamt für Kartographie und Geodäsie (BKG – TopPlusOpen):**
  - *Umfang:* Amtliche Web-Basiskarte (`sgx.geodatenzentrum.de`, Layer `web_grau`).
  - *Lizenz & Pflichtangabe:* `© GeoBasis-DE / BKG`, lizenziert unter der [Datenlizenz Deutschland – Namensnennung – Version 2.0 (`dl-de/by-2-0`)](https://www.govdata.de/dl-de/by-2-0).
- **Bright Sky API (`api.brightsky.dev`):**
  - *Umfang:* Öffentliches JSON-Gateway zur Aufbereitung von DWD Open Data ([Quellcode unter MIT-Lizenz](https://github.com/jdemaeyer/brightsky)). Bei dauerhaft hohem Abfrageaufkommen sollten die Fair-Use-Regeln des Dienstes beachtet oder eine eigene Bright-Sky-Instanz betrieben werden.
- **Open-Meteo (`open-meteo.com`):**
  - *Umfang:* Ortssuche (`geocoding-api.open-meteo.com`) sowie das DWD-ICON-D2-Bewölkungsgitter (`api.open-meteo.com/v1/dwd-icon`).
  - *Lizenz & Einschränkung für kommerzielle Nutzung:* Daten bereitgestellt durch [Open-Meteo.com](https://open-meteo.com/) unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Gemäß den [Open-Meteo Nutzungsbedingungen](https://open-meteo.com/en/terms) ist der kostenfreie öffentliche API-Endpunkt **ausschließlich für die nicht-kommerzielle Nutzung** zugelassen. Für jeglichen kommerziellen Betrieb (z. B. gewerbliche Websites, werbefinanzierte Angebote oder interne Unternehmensnutzung) muss ein kostenpflichtiger API-Zugang bei Open-Meteo erworben und über `DWD_ICON_BASE_URL` / `GEOCODING_BASE_URL` hinterlegt werden.

### 4. Datenschutz-Hinweis für Betreiber (Self-Hosting / DSGVO)
- **Kein Tracking & keine Cookies:** Die Anwendung bindet keinerlei Analyse-, Werbe- oder Tracking-Dienste ein und setzt keine Cookies. Favoriten und Darstellungsoptionen verbleiben lokal im Browser (`localStorage`); die GPS-Standortbestimmung erfolgt ausschließlich lokal nach expliziter Browser-Freigabe.
- **Serverseitige Proxy-Bündelung:** Abrufe von Wetter-, Radar-, Wolken- und Ortsdaten (`/api/*`) erfolgen über das eigene Node.js-Backend, sodass gegenüber Bright Sky und Open-Meteo lediglich die IP-Adresse des Host-Servers auftritt.
- **Direkte Kartenkachel-Abrufe im Browser:** Beim Anzeigen der interaktiven Karte lädt der Browser der Besucher WMS- und WMTS-Grafikkacheln direkt von den Servern des **DWD (`maps.dwd.de`)** sowie des **BKG (`sgx.geodatenzentrum.de`)**. Hierbei wird technisch bedingt die IP-Adresse des aufrufenden Endgeräts an diese öffentlichen Behördenserver übermittelt. Bei öffentlichem Betrieb im Geltungsbereich der DSGVO sollte dies in der eigenen Datenschutzerklärung berücksichtigt und ein Impressum verlinkt werden.

## Lizenz des Quellcodes

Der Quellcode dieser Anwendung ist unter der **MIT-Lizenz** veröffentlicht – siehe [LICENSE](./LICENSE). Alle Rechte an den abgerufenen Fach-, Wetter- und Kartendaten verbleiben bei den oben genannten Urhebern und Datenanbietern.

