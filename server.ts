import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  bereiteRadarNowcastAuf,
  bereiteVorhersageAuf,
  erzeugeDwdWmsZeitachse,
  formatiereWindrichtung,
  klassifiziereDwdWarnungen,
  uebersetzeWetterzustand,
  validiereKoordinaten,
} from './src/shared/wetterLogik.ts';
import type {
  DeutschlandWarnUebersicht,
  RadarZeitachse,
  Standort,
  WetterPaket,
  WolkenGitterZeitreihe,
} from './src/shared/wetterTypen.ts';
import type {
  RohRadarEintrag,
  RohStundenWetter,
  RohWarnung,
} from './src/shared/wetterLogik.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const BRIGHTSKY_BASE_URL = (process.env.BRIGHTSKY_BASE_URL || 'https://api.brightsky.dev').replace(
  /\/$/,
  ''
);
const GEOCODING_BASE_URL = (
  process.env.GEOCODING_BASE_URL || 'https://geocoding-api.open-meteo.com/v1'
).replace(/\/$/, '');
const DWD_ICON_BASE_URL = (
  process.env.DWD_ICON_BASE_URL || 'https://api.open-meteo.com/v1/dwd-icon'
).replace(/\/$/, '');
const DWD_WMS_URL = 'https://maps.dwd.de/geoserver/dwd/wms';
const DWD_RADAR_RV_LAYER = 'dwd:Radar_rv_product_1x1km_ger';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 3 * 60 * 1000;
const MAX_CACHE_EINTRAEGE = 150;

interface CacheEintrag<T> {
  ablaufZeitMs: number;
  daten: T;
}

const speicherCache = new Map<string, CacheEintrag<unknown>>();

function leseAusCache<T>(schluessel: string): T | null {
  const eintrag = speicherCache.get(schluessel);
  if (!eintrag) return null;
  if (Date.now() > eintrag.ablaufZeitMs) {
    speicherCache.delete(schluessel);
    return null;
  }
  return eintrag.daten as T;
}

function schreibeInCache<T>(schluessel: string, daten: T, ttlMs: number = CACHE_TTL_MS): void {
  if (speicherCache.size >= MAX_CACHE_EINTRAEGE) {
    const aeltesterSchluessel = speicherCache.keys().next().value;
    if (aeltesterSchluessel) {
      speicherCache.delete(aeltesterSchluessel);
    }
  }
  speicherCache.set(schluessel, {
    ablaufZeitMs: Date.now() + ttlMs,
    daten,
  });
}

async function holeJsonMitTimeout<T>(url: string, timeoutMs: number = 9000): Promise<T> {
  const antwort = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WarnWetter-Web/1.1 (DWD Open Data Visualisierung)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!antwort.ok) {
    throw new Error(`Upstream-Antwort ${antwort.status} bei Abruf von ${new URL(url).hostname}`);
  }

  return (await antwort.json()) as T;
}

interface BrightSkyCurrentAntwort {
  weather?: {
    timestamp?: string;
    temperature?: number | null;
    dew_point?: number | null;
    relative_humidity?: number | null;
    pressure_msl?: number | null;
    wind_speed_10?: number | null;
    wind_speed_30?: number | null;
    wind_speed_60?: number | null;
    wind_gust_speed_10?: number | null;
    wind_gust_speed_30?: number | null;
    wind_gust_speed_60?: number | null;
    wind_direction_10?: number | null;
    wind_direction_30?: number | null;
    wind_direction_60?: number | null;
    precipitation_60?: number | null;
    precipitation_30?: number | null;
    precipitation_10?: number | null;
    cloud_cover?: number | null;
    visibility?: number | null;
    sunshine_60?: number | null;
    sunshine_30?: number | null;
    condition?: string | null;
    icon?: string | null;
  };
  sources?: Array<{
    station_name?: string | null;
    dwd_station_id?: string | null;
    height?: number | null;
    distance?: number | null;
  }>;
}

interface BrightSkyWeatherAntwort {
  weather?: RohStundenWetter[];
}

interface BrightSkyAlertsAntwort {
  alerts?: RohWarnung[];
  location?: {
    name?: string | null;
    district?: string | null;
    state?: string | null;
  };
}

interface BrightSkyRadarAntwort {
  radar?: RohRadarEintrag[];
}

async function starteServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');

  // Leichtgewichtiger Healthcheck für Docker Compose & Reverse-Proxies (ohne Upstream-Aufruf)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // 1. Kombinierter DWD-Wetter-, 168h-Stunden-, 2h-Radar-Nowcast- & Warnungs-Endpunkt
  app.get('/api/weather', async (req: Request, res: Response) => {
    const validierung = validiereKoordinaten(req.query.lat, req.query.lon);
    if (!validierung.gueltig) {
      res.status(400).json({ fehler: validierung.fehler });
      return;
    }

    const { breitengrad, laengengrad } = validierung;
    const gerundetSchluessel = `weather:v3:${breitengrad.toFixed(3)}:${laengengrad.toFixed(3)}`;
    const gecacht = leseAusCache<WetterPaket>(gerundetSchluessel);
    if (gecacht) {
      res.json(gecacht);
      return;
    }

    try {
      const startDatum = new Date(Date.now() - 36 * 3600_000).toISOString().slice(0, 10);
      const endDatum = new Date(Date.now() + 8 * 24 * 3600_000).toISOString().slice(0, 10);
      const radarStartIso = new Date(Date.now() - 35 * 60_000).toISOString();
      const radarEndeIso = new Date(Date.now() + 130 * 60_000).toISOString();

      const currentUrl = `${BRIGHTSKY_BASE_URL}/current_weather?lat=${breitengrad}&lon=${laengengrad}`;
      const forecastUrl = `${BRIGHTSKY_BASE_URL}/weather?lat=${breitengrad}&lon=${laengengrad}&date=${startDatum}&last_date=${endDatum}&tz=Europe/Berlin`;
      const alertsUrl = `${BRIGHTSKY_BASE_URL}/alerts?lat=${breitengrad}&lon=${laengengrad}`;
      const radarNowcastUrl = `${BRIGHTSKY_BASE_URL}/radar?lat=${breitengrad}&lon=${laengengrad}&distance=1000&format=plain&date=${encodeURIComponent(
        radarStartIso
      )}&last_date=${encodeURIComponent(radarEndeIso)}`;

      const [aktuellRes, vorhersageRes, warnungenRes, radarRes] = await Promise.allSettled([
        holeJsonMitTimeout<BrightSkyCurrentAntwort>(currentUrl),
        holeJsonMitTimeout<BrightSkyWeatherAntwort>(forecastUrl),
        holeJsonMitTimeout<BrightSkyAlertsAntwort>(alertsUrl),
        holeJsonMitTimeout<BrightSkyRadarAntwort>(radarNowcastUrl, 6000),
      ]);

      if (aktuellRes.status === 'rejected' && vorhersageRes.status === 'rejected') {
        res.status(502).json({
          fehler:
            'Für diesen Standort sind aktuell keine DWD-Stations- oder Vorhersagedaten abrufbar (bitte einen Ort in Deutschland oder Mitteleuropa wählen).',
        });
        return;
      }

      const aktuellRoh = aktuellRes.status === 'fulfilled' ? aktuellRes.value : {};
      const vorhersageRoh =
        vorhersageRes.status === 'fulfilled' ? (vorhersageRes.value.weather ?? []) : [];
      const warnungenRoh = warnungenRes.status === 'fulfilled' ? warnungenRes.value : {};
      const radarRoh = radarRes.status === 'fulfilled' ? (radarRes.value.radar ?? []) : [];

      const { stundenvorhersage, alleTageKacheln, tagesvorhersage } =
        bereiteVorhersageAuf(vorhersageRoh);
      const radarNowcast = bereiteRadarNowcastAuf(radarRoh);
      const ersteStunde =
        stundenvorhersage.find((s) => !s.istVergangenheit) ?? stundenvorhersage[0];
      const hauptQuelle = aktuellRoh.sources?.[0];
      const w = aktuellRoh.weather;

      const windGrad =
        w?.wind_direction_10 ??
        w?.wind_direction_30 ??
        w?.wind_direction_60 ??
        ersteStunde?.windrichtungGrad ??
        null;

      const iconCode = w?.icon || ersteStunde?.iconCode || 'cloudy';
      const conditionCode = w?.condition || iconCode;

      const paket: WetterPaket = {
        abgerufenAm: new Date().toISOString(),
        koordinaten: { breitengrad, laengengrad },
        station: {
          name: hauptQuelle?.station_name || 'DWD-Messnetz',
          dwdStationId: hauptQuelle?.dwd_station_id ?? null,
          hoeheMeter:
            typeof hauptQuelle?.height === 'number' ? Math.round(hauptQuelle.height) : null,
          entfernungKm:
            typeof hauptQuelle?.distance === 'number'
              ? Math.round((hauptQuelle.distance / 1000) * 10) / 10
              : null,
          warnzelleName:
            warnungenRoh.location?.district || warnungenRoh.location?.name || null,
          bundesland: warnungenRoh.location?.state || null,
        },
        aktuell: {
          zeitpunkt: w?.timestamp || ersteStunde?.zeitpunkt || new Date().toISOString(),
          temperatur: w?.temperature ?? ersteStunde?.temperatur ?? null,
          taupunkt: w?.dew_point ?? ersteStunde?.taupunkt ?? null,
          luftfeuchtigkeit: w?.relative_humidity ?? null,
          luftdruckHpa: w?.pressure_msl ?? ersteStunde?.luftdruckHpa ?? null,
          windgeschwindigkeitKmh:
            w?.wind_speed_10 ??
            w?.wind_speed_30 ??
            w?.wind_speed_60 ??
            ersteStunde?.windgeschwindigkeitKmh ??
            null,
          windboeenKmh:
            w?.wind_gust_speed_10 ??
            w?.wind_gust_speed_30 ??
            w?.wind_gust_speed_60 ??
            ersteStunde?.windboeenKmh ??
            null,
          windrichtungGrad: windGrad,
          windrichtungKompass: formatiereWindrichtung(windGrad),
          niederschlagLetzteStundeMm:
            w?.precipitation_60 ?? w?.precipitation_30 ?? w?.precipitation_10 ?? 0,
          bewoelkungProzent: w?.cloud_cover ?? ersteStunde?.bewoelkungProzent ?? null,
          sichtweiteKm:
            typeof w?.visibility === 'number'
              ? Math.round((w.visibility / 1000) * 10) / 10
              : null,
          sonnenscheinMinuten: w?.sunshine_60 ?? w?.sunshine_30 ?? null,
          zustandCode: conditionCode,
          zustandText: uebersetzeWetterzustand(w?.condition, iconCode),
          iconCode,
        },
        radarNowcast,
        stundenvorhersage,
        alleTageKacheln,
        tagesvorhersage,
        warnungen: klassifiziereDwdWarnungen(warnungenRoh.alerts ?? []),
      };

      schreibeInCache(gerundetSchluessel, paket);
      res.json(paket);
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error ? fehler.message : 'Unbekannter Fehler beim DWD-Datenabruf';
      res
        .status(502)
        .json({ fehler: `DWD-Schnittstelle vorübergehend nicht erreichbar: ${nachricht}` });
    }
  });

  // 2. Bundesweite DWD-Warnlage-Zusammenfassung für die Deutschlandkarte
  app.get('/api/alerts-germany', async (_req: Request, res: Response) => {
    const cacheKey = 'alerts:germany';
    const gecacht = leseAusCache<DeutschlandWarnUebersicht>(cacheKey);
    if (gecacht) {
      res.json(gecacht);
      return;
    }

    try {
      const roh = await holeJsonMitTimeout<{ alerts?: RohWarnung[] }>(
        `${BRIGHTSKY_BASE_URL}/alerts`
      );
      const klassifiziert = klassifiziereDwdWarnungen(roh.alerts ?? []);

      const nachStufe = {
        stufe1: 0,
        stufe2: 0,
        stufe3: 0,
        stufe4: 0,
        vorabinfo: 0,
      };

      const ereignisZaehler = new Map<
        string,
        { ereignis: string; warnstufe: 0 | 1 | 2 | 3 | 4; anzahlGebiete: number }
      >();

      for (const w of klassifiziert) {
        if (w.istVorabinformation) nachStufe.vorabinfo += 1;
        else if (w.warnstufe === 4) nachStufe.stufe4 += 1;
        else if (w.warnstufe === 3) nachStufe.stufe3 += 1;
        else if (w.warnstufe === 2) nachStufe.stufe2 += 1;
        else nachStufe.stufe1 += 1;

        const key = `${w.warnstufe}:${w.ereignis}`;
        const bisher = ereignisZaehler.get(key);
        if (bisher) {
          bisher.anzahlGebiete += 1;
        } else {
          ereignisZaehler.set(key, {
            ereignis: w.ereignis,
            warnstufe: w.warnstufe,
            anzahlGebiete: 1,
          });
        }
      }

      const schwerpunkte = Array.from(ereignisZaehler.values())
        .sort((a, b) => b.warnstufe - a.warnstufe || b.anzahlGebiete - a.anzahlGebiete)
        .slice(0, 5);

      const uebersicht: DeutschlandWarnUebersicht = {
        aktualisiertAm: new Date().toISOString(),
        gesamtAktiv: klassifiziert.length,
        nachStufe,
        schwerpunkte,
      };

      schreibeInCache(cacheKey, uebersicht, CACHE_TTL_MS);
      res.json(uebersicht);
    } catch {
      res.status(502).json({ fehler: 'Bundesweite Warnübersicht derzeit nicht verfügbar.' });
    }
  });

  // 3. Ortssuche via Open-Meteo Geocoding (priorisiert Deutschland & Nachbarregionen)
  app.get('/api/search', async (req: Request, res: Response) => {
    const suchbegriff = String(req.query.q ?? '').trim();
    if (suchbegriff.length < 2) {
      res.json({ ergebnisse: [] });
      return;
    }

    const cacheKey = `search:${suchbegriff.toLowerCase()}`;
    const gecacht = leseAusCache<{ ergebnisse: Standort[] }>(cacheKey);
    if (gecacht) {
      res.json(gecacht);
      return;
    }

    try {
      interface GeocodingAntwort {
        results?: Array<{
          id: number;
          name: string;
          latitude: number;
          longitude: number;
          elevation?: number;
          country_code?: string;
          country?: string;
          admin1?: string;
          admin3?: string;
        }>;
      }

      const url = `${GEOCODING_BASE_URL}/search?name=${encodeURIComponent(
        suchbegriff
      )}&count=12&language=de&format=json`;
      const daten = await holeJsonMitTimeout<GeocodingAntwort>(url, 6000);

      const sortiert = (daten.results ?? []).sort((a, b) => {
        const aDe = a.country_code === 'DE' ? 1 : 0;
        const bDe = b.country_code === 'DE' ? 1 : 0;
        return bDe - aDe;
      });

      const ergebnisse: Standort[] = sortiert.slice(0, 8).map((ort) => ({
        id: `${ort.id}`,
        name: ort.name,
        bundesland: ort.admin1,
        landkreis: ort.admin3,
        land: ort.country || ort.country_code,
        breitengrad: Math.round(ort.latitude * 10000) / 10000,
        laengengrad: Math.round(ort.longitude * 10000) / 10000,
        hoeheMeter: typeof ort.elevation === 'number' ? Math.round(ort.elevation) : undefined,
      }));

      const antwortPayload = { ergebnisse };
      schreibeInCache(cacheKey, antwortPayload, 30 * 60 * 1000);
      res.json(antwortPayload);
    } catch {
      res.status(502).json({ fehler: 'Ortssuche vorübergehend nicht erreichbar.' });
    }
  });

  // 4. Offizielle DWD RV-Radar-Zeitachse (-60 Min. Analyse bis +120 Min. Vorhersage) für WMS-TIME
  app.get('/api/radar', async (_req: Request, res: Response) => {
    const cacheKey = 'radar:dwd-rv-timeline';
    const gecacht = leseAusCache<RadarZeitachse>(cacheKey);
    if (gecacht) {
      res.json(gecacht);
      return;
    }

    try {
      const endeIso = new Date(Date.now() + 135 * 60_000).toISOString();
      const url = `${BRIGHTSKY_BASE_URL}/radar?bbox=0,0,0,0&format=plain&last_date=${encodeURIComponent(
        endeIso
      )}`;
      const roh = await holeJsonMitTimeout<BrightSkyRadarAntwort>(url, 6000);
      const { analyseZeitpunktIso, frames } = erzeugeDwdWmsZeitachse(roh.radar ?? []);

      const zeitachse: RadarZeitachse = {
        wmsUrl: DWD_WMS_URL,
        layerName: DWD_RADAR_RV_LAYER,
        analyseZeitpunktIso,
        frames,
      };

      schreibeInCache(cacheKey, zeitachse, 2 * 60 * 1000);
      res.json(zeitachse);
    } catch {
      const { analyseZeitpunktIso, frames } = erzeugeDwdWmsZeitachse([]);
      res.json({
        wmsUrl: DWD_WMS_URL,
        layerName: DWD_RADAR_RV_LAYER,
        analyseZeitpunktIso,
        frames,
      } satisfies RadarZeitachse);
    }
  });

  // 5. DWD ICON-D2 Bewölkungs-Gitter (-75 Min. Messung bis +135 Min. Prognose) für flüssiges Canvas-Overlay
  app.get('/api/clouds', async (_req: Request, res: Response) => {
    const cacheKey = 'clouds:dwd-icon-grid:v1';
    const gecacht = leseAusCache<WolkenGitterZeitreihe>(cacheKey);
    if (gecacht) {
      res.json(gecacht);
      return;
    }

    const latMin = 46.8;
    const latMax = 55.2;
    const lonMin = 5.2;
    const lonMax = 15.6;
    const zeilen = 14;
    const spalten = 13;

    const lats: string[] = [];
    const lons: string[] = [];
    for (let z = 0; z < zeilen; z++) {
      const lat = latMin + (z / (zeilen - 1)) * (latMax - latMin);
      for (let s = 0; s < spalten; s++) {
        const lon = lonMin + (s / (spalten - 1)) * (lonMax - lonMin);
        lats.push(lat.toFixed(2));
        lons.push(lon.toFixed(2));
      }
    }

    try {
      interface IconPunktAntwort {
        minutely_15?: {
          time?: string[];
          cloud_cover?: Array<number | null>;
        };
      }

      const url = `${DWD_ICON_BASE_URL}?latitude=${lats.join(',')}&longitude=${lons.join(
        ','
      )}&minutely_15=cloud_cover&past_minutely_15=5&forecast_minutely_15=10&timezone=UTC`;

      const roh = await holeJsonMitTimeout<IconPunktAntwort[]>(url, 8000);
      if (!Array.isArray(roh) || roh.length !== zeilen * spalten) {
        throw new Error('Ungültige Gitterantwort vom DWD-ICON-Dienst');
      }

      const roheZeiten = roh[0]?.minutely_15?.time ?? [];
      const zeitpunkteMs = roheZeiten.map((iso) =>
        iso.includes('Z') || iso.includes('+') ? Date.parse(iso) : Date.parse(`${iso}:00Z`)
      );

      const werteJeZeitpunkt: number[][] = zeitpunkteMs.map((_, zeitIdx) =>
        roh.map((punkt) => {
          const wert = punkt.minutely_15?.cloud_cover?.[zeitIdx];
          return typeof wert === 'number' && Number.isFinite(wert)
            ? Math.round(Math.max(0, Math.min(100, wert)))
            : 0;
        })
      );

      const gitter: WolkenGitterZeitreihe = {
        aktualisiertAm: new Date().toISOString(),
        latMin,
        latMax,
        lonMin,
        lonMax,
        zeilen,
        spalten,
        zeitpunkteMs,
        werteJeZeitpunkt,
      };

      schreibeInCache(cacheKey, gitter, 5 * 60 * 1000);
      res.json(gitter);
    } catch {
      res.status(502).json({ fehler: 'DWD-ICON-Bewölkungsdaten derzeit nicht abrufbar.' });
    }
  });

  // Entwicklung: Vite-Middleware einbinden | Produktion: Statisches Build ausliefern
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPfad = path.join(__dirname, 'dist');
    app.use(express.static(distPfad));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPfad, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WarnWetter Web Server aktiv auf Port ${PORT}`);
  });
}

starteServer();
