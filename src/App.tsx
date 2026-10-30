import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type {
  DeutschlandWarnUebersicht,
  RadarZeitachse,
  Standort,
  WetterPaket,
  WolkenGitterZeitreihe,
} from './shared/wetterTypen.ts';
import { Kopfzeile } from './components/Kopfzeile.tsx';
import { OrtsWerkzeugleiste } from './components/OrtsWerkzeugleiste.tsx';
import { WarnungsBereich } from './components/WarnungsBereich.tsx';
import { MesswertePanel } from './components/MesswertePanel.tsx';
import { RadarNowcastPanel } from './components/RadarNowcastPanel.tsx';
import { WarnUndRadarKarte } from './components/WarnUndRadarKarte.tsx';
import { WetterVerlaufKombi } from './components/WetterVerlaufKombi.tsx';
import { SiebenTageTrend } from './components/SiebenTageTrend.tsx';
import { OrtsSucheDialog } from './components/OrtsSucheDialog.tsx';

const FAVORITEN_STORAGE_KEY = 'warnwetter_favoriten_v1';
const THEME_STORAGE_KEY = 'warnwetter_theme_v1';

const STANDARD_FAVORITEN: Standort[] = [
  {
    id: 'de-frankfurt',
    name: 'Frankfurt am Main',
    bundesland: 'Hessen',
    land: 'Deutschland',
    breitengrad: 50.1109,
    laengengrad: 8.6821,
    hoeheMeter: 112,
  },
  {
    id: 'de-hannover',
    name: 'Hannover',
    bundesland: 'Niedersachsen',
    land: 'Deutschland',
    breitengrad: 52.3759,
    laengengrad: 9.732,
    hoeheMeter: 56,
  },
  {
    id: 'de-hamburg',
    name: 'Hamburg',
    bundesland: 'Hamburg',
    land: 'Deutschland',
    breitengrad: 53.5511,
    laengengrad: 9.9937,
    hoeheMeter: 6,
  },
  {
    id: 'de-muenchen',
    name: 'München',
    bundesland: 'Bayern',
    land: 'Deutschland',
    breitengrad: 48.1351,
    laengengrad: 11.582,
    hoeheMeter: 519,
  },
  {
    id: 'de-berlin',
    name: 'Berlin',
    bundesland: 'Berlin',
    land: 'Deutschland',
    breitengrad: 52.52,
    laengengrad: 13.405,
    hoeheMeter: 34,
  },
  {
    id: 'de-zugspitze',
    name: 'Zugspitze',
    bundesland: 'Bayern',
    land: 'Deutschland',
    breitengrad: 47.421,
    laengengrad: 10.9854,
    hoeheMeter: 2962,
  },
];

function ladeInitialeFavoriten(): Standort[] {
  try {
    const roh = window.localStorage.getItem(FAVORITEN_STORAGE_KEY);
    if (!roh) return STANDARD_FAVORITEN;
    const geparst = JSON.parse(roh) as unknown;
    if (Array.isArray(geparst) && geparst.length > 0) {
      return geparst as Standort[];
    }
    return STANDARD_FAVORITEN;
  } catch {
    return STANDARD_FAVORITEN;
  }
}

function ladeInitialesTheme(): boolean {
  try {
    const gespeichert = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!gespeichert) return true;
    return gespeichert === 'dark';
  } catch {
    return true;
  }
}

export default function App() {
  const [istDunkelModus, setIstDunkelModus] = useState<boolean>(ladeInitialesTheme);
  const [favoriten, setFavoriten] = useState<Standort[]>(ladeInitialeFavoriten);
  const [aktiverOrt, setAktiverOrt] = useState<Standort>(
    () => ladeInitialeFavoriten()[0] ?? STANDARD_FAVORITEN[0]
  );

  const [wetterPaket, setWetterPaket] = useState<WetterPaket | null>(null);
  const [aktiverTagDatum, setAktiverTagDatum] = useState<string>('');
  const [scrollTriggerZaehler, setScrollTriggerZaehler] = useState<number>(0);
  const [deutschlandWarnungen, setDeutschlandWarnungen] =
    useState<DeutschlandWarnUebersicht | null>(null);
  const [radarZeitachse, setRadarZeitachse] = useState<RadarZeitachse | null>(null);
  const [wolkenGitter, setWolkenGitter] = useState<WolkenGitterZeitreihe | null>(null);

  const [laedtWetter, setLaedtWetter] = useState<boolean>(true);
  const [fehlerNachricht, setFehlerNachricht] = useState<string | null>(null);
  const [sucheOffen, setSucheOffen] = useState<boolean>(false);
  const [gpsLaedt, setGpsLaedt] = useState<boolean>(false);
  const [gpsHinweis, setGpsHinweis] = useState<string | null>(null);
  const [neuladeZaehler, setNeuladeZaehler] = useState<number>(0);

  useEffect(() => {
    const wurzel = document.documentElement;
    if (istDunkelModus) {
      wurzel.classList.add('dark');
    } else {
      wurzel.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, istDunkelModus ? 'dark' : 'light');
    } catch {
      // Ignoriere Storage-Restriktionen
    }
  }, [istDunkelModus]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITEN_STORAGE_KEY, JSON.stringify(favoriten));
    } catch {
      // Ignoriere Storage-Restriktionen
    }
  }, [favoriten]);

  useEffect(() => {
    const controller = new AbortController();
    setLaedtWetter(true);
    setFehlerNachricht(null);

    const ladeDaten = async () => {
      try {
        const res = await fetch(
          `/api/weather?lat=${aktiverOrt.breitengrad}&lon=${aktiverOrt.laengengrad}`,
          { signal: controller.signal }
        );
        const daten = (await res.json()) as WetterPaket & { fehler?: string };
        if (!res.ok) {
          throw new Error(daten.fehler || 'Fehler beim Abrufen der DWD-Wetterdaten.');
        }
        setWetterPaket(daten);

        // Standardmäßig "Heute" in der Kachelleiste aktivieren
        const heuteKachel =
          daten.alleTageKacheln.find((k) => k.istHeute) ?? daten.tagesvorhersage[0];
        if (heuteKachel) {
          setAktiverTagDatum(heuteKachel.datum);
        }

        if (aktiverOrt.id.startsWith('map-') && daten.station.warnzelleName) {
          setAktiverOrt((prev) =>
            prev.id === aktiverOrt.id
              ? { ...prev, name: daten.station.warnzelleName || prev.name }
              : prev
          );
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setFehlerNachricht(
          err instanceof Error
            ? err.message
            : 'Verbindung zur Wetter-Schnittstelle fehlgeschlagen.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLaedtWetter(false);
        }
      }
    };

    ladeDaten();
    return () => controller.abort();
  }, [aktiverOrt.breitengrad, aktiverOrt.laengengrad, aktiverOrt.id, neuladeZaehler]);

  useEffect(() => {
    const controller = new AbortController();

    const ladeHintergrundDaten = async () => {
      const [warnRes, radarRes, wolkenRes] = await Promise.allSettled([
        fetch('/api/alerts-germany', { signal: controller.signal }),
        fetch('/api/radar', { signal: controller.signal }),
        fetch('/api/clouds', { signal: controller.signal }),
      ]);

      if (warnRes.status === 'fulfilled' && warnRes.value.ok) {
        const warnJson = (await warnRes.value.json()) as DeutschlandWarnUebersicht;
        setDeutschlandWarnungen(warnJson);
      }
      if (radarRes.status === 'fulfilled' && radarRes.value.ok) {
        const radarJson = (await radarRes.value.json()) as RadarZeitachse;
        setRadarZeitachse(radarJson);
      }
      if (wolkenRes.status === 'fulfilled' && wolkenRes.value.ok) {
        const wolkenJson = (await wolkenRes.value.json()) as WolkenGitterZeitreihe;
        setWolkenGitter(wolkenJson);
      }
    };

    ladeHintergrundDaten();
    return () => controller.abort();
  }, [neuladeZaehler]);

  const istFavorit = useMemo(
    () =>
      favoriten.some(
        (f) =>
          Math.abs(f.breitengrad - aktiverOrt.breitengrad) < 0.01 &&
          Math.abs(f.laengengrad - aktiverOrt.laengengrad) < 0.01
      ),
    [favoriten, aktiverOrt]
  );

  const favoritUmschalten = useCallback(() => {
    setFavoriten((bisher) => {
      const existiert = bisher.some(
        (f) =>
          Math.abs(f.breitengrad - aktiverOrt.breitengrad) < 0.01 &&
          Math.abs(f.laengengrad - aktiverOrt.laengengrad) < 0.01
      );
      if (existiert) {
        return bisher.filter(
          (f) =>
            !(
              Math.abs(f.breitengrad - aktiverOrt.breitengrad) < 0.01 &&
              Math.abs(f.laengengrad - aktiverOrt.laengengrad) < 0.01
            )
        );
      }
      return [aktiverOrt, ...bisher].slice(0, 12);
    });
  }, [aktiverOrt]);

  const gpsAnfordern = useCallback(() => {
    setGpsHinweis(null);
    if (!('geolocation' in navigator)) {
      setGpsHinweis('Standortbestimmung wird von diesem Browser nicht unterstützt.');
      return;
    }

    setGpsLaedt(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLaedt(false);
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        setAktiverOrt({
          id: `map-gps-${lat}-${lon}`,
          name: 'Mein GPS-Standort',
          breitengrad: lat,
          laengengrad: lon,
        });
      },
      () => {
        setGpsLaedt(false);
        setGpsHinweis(
          'Standortfreigabe wurde abgelehnt oder war nicht möglich. Bitte nutze die Ortssuche.'
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 }
    );
  }, []);

  const kartenKoordinateWaehlen = useCallback((lat: number, lon: number) => {
    const gerundetLat = Math.round(lat * 10000) / 10000;
    const gerundetLon = Math.round(lon * 10000) / 10000;
    setGpsHinweis(null);
    setAktiverOrt({
      id: `map-${gerundetLat}-${gerundetLon}`,
      name: `Kartenpunkt (${gerundetLat.toFixed(2)}° N, ${gerundetLon.toFixed(2)}° O)`,
      breitengrad: gerundetLat,
      laengengrad: gerundetLon,
    });
  }, []);

  const springeZuStundenTag = useCallback((datum: string) => {
    setAktiverTagDatum(datum);
    setScrollTriggerZaehler((z) => z + 1);
    document.getElementById('stundenvorhersage')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Kopfzeile aufSucheOeffnen={() => setSucheOffen(true)} />

      <OrtsWerkzeugleiste
        aktiverOrt={aktiverOrt}
        station={wetterPaket?.station ?? null}
        messzeitpunktIso={wetterPaket?.aktuell.zeitpunkt ?? null}
        favoriten={favoriten}
        istFavorit={istFavorit}
        istDunkelModus={istDunkelModus}
        laedtDaten={laedtWetter}
        gpsLadeStatus={gpsLaedt}
        gpsHinweis={gpsHinweis}
        aufOrtWaehlen={(ort) => {
          setGpsHinweis(null);
          setAktiverOrt(ort);
        }}
        aufFavoritUmschalten={favoritUmschalten}
        aufGpsAnfordern={gpsAnfordern}
        aufAktualisieren={() => setNeuladeZaehler((z) => z + 1)}
        aufThemeUmschalten={() => setIstDunkelModus((d) => !d)}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {fehlerNachricht && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-900 dark:text-red-200">{fehlerNachricht}</div>
            </div>
            <button
              type="button"
              onClick={() => setNeuladeZaehler((z) => z + 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Erneut versuchen</span>
            </button>
          </div>
        )}

        {/* Obere 2-Spalten-Hauptansicht: Links Warnlage, Messwerte & 2h-Radar-Nowcast | Rechts Warn- & Radarkarte */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-6">
            {laedtWetter && !wetterPaket ? (
              <div className="space-y-6 animate-pulse" aria-label="Wetterdaten werden geladen">
                <div className="h-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
                <div className="h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
                <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
              </div>
            ) : wetterPaket ? (
              <>
                <WarnungsBereich
                  warnungen={wetterPaket.warnungen}
                  warnzelleName={wetterPaket.station.warnzelleName}
                />
                <MesswertePanel
                  aktuell={wetterPaket.aktuell}
                  heute={wetterPaket.tagesvorhersage[0]}
                />
                <RadarNowcastPanel punkte={wetterPaket.radarNowcast} />
              </>
            ) : null}
          </div>

          <div className="lg:col-span-6">
            <WarnUndRadarKarte
              aktiverOrt={aktiverOrt}
              istDunkelModus={istDunkelModus}
              deutschlandWarnungen={deutschlandWarnungen}
              radarZeitachse={radarZeitachse}
              wolkenGitter={wolkenGitter}
              aufKoordinateWaehlen={kartenKoordinateWaehlen}
            />
          </div>
        </div>

        {/* Kombinierte, endlos horizontal scrollbare WarnWetter-Stunden- & Diagrammansicht (5 Blöcke) */}
        {wetterPaket && wetterPaket.stundenvorhersage.length > 0 && (
          <WetterVerlaufKombi
            stunden={wetterPaket.stundenvorhersage}
            tageKacheln={wetterPaket.alleTageKacheln}
            breitengrad={wetterPaket.koordinaten.breitengrad}
            laengengrad={wetterPaket.koordinaten.laengengrad}
            aktiverTagDatum={aktiverTagDatum}
            scrollTriggerZaehler={scrollTriggerZaehler}
            aufTagAktivieren={setAktiverTagDatum}
          />
        )}

        {/* Beibehaltene 7-Tage-Tabelle mit Direkt-Sprung in den Endlos-Verlauf */}
        {wetterPaket && wetterPaket.tagesvorhersage.length > 0 && (
          <SiebenTageTrend
            tage={wetterPaket.tagesvorhersage}
            aktiverTagDatum={aktiverTagDatum}
            aufTagAuswaehlen={springeZuStundenTag}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-5 px-4 sm:px-6">
        <div className="max-w-[1360px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>
            Quelle:{' '}
            <a
              href="https://www.dwd.de/DE/service/copyright/copyright_node.html"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
            >
              Deutscher Wetterdienst
            </a>{' '}
            (DWD Open Data, grafisch aufbereitet),{' '}
            <a
              href="https://brightsky.dev/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
            >
              Bright Sky API
            </a>
            , © GeoBasis-DE / BKG (
            <a
              href="https://www.govdata.de/dl-de/by-2-0"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
            >
              dl-de/by-2-0
            </a>
            ) &amp;{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
            >
              Open-Meteo.com
            </a>{' '}
            (CC BY 4.0, nicht-kommerziell).
          </p>
          <p>
            Inoffizielles Open-Source-Projekt ohne Verbindung zum DWD · Keine Gewähr · Im Gefahrenfall offizielle Warnkanäle beachten.
          </p>
        </div>
      </footer>

      <OrtsSucheDialog
        offen={sucheOffen}
        aufSchliessen={() => setSucheOffen(false)}
        aufOrtAuswaehlen={(ort) => {
          setGpsHinweis(null);
          setAktiverOrt(ort);
        }}
      />
    </div>
  );
}
