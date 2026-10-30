import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudRain,
  Crosshair,
  Globe,
  Layers,
  Pause,
  Play,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type {
  DeutschlandWarnUebersicht,
  RadarZeitachse,
  Standort,
  WolkenGitterZeitreihe,
} from '../shared/wetterTypen.ts';
import {
  interpoliereWolkenFeldAufZeitpunkt,
  interpoliereWolkenWertBilinear,
} from '../shared/wetterLogik.ts';

interface WarnUndRadarKarteProps {
  aktiverOrt: Standort;
  istDunkelModus: boolean;
  deutschlandWarnungen: DeutschlandWarnUebersicht | null;
  radarZeitachse: RadarZeitachse | null;
  wolkenGitter: WolkenGitterZeitreihe | null;
  aufKoordinateWaehlen: (breitengrad: number, laengengrad: number) => void;
}

type KartenEbeneKey = 'warngebiete' | 'regen' | 'wolken' | 'gewitter';

type EbenenAuswahl = Record<KartenEbeneKey, boolean>;

const BKG_TOPPLUS_GRAU_URL =
  'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png';
const DWD_WMS_URL = 'https://maps.dwd.de/geoserver/dwd/wms';
const DWD_WARN_LAYER = 'dwd:Warnungen_Gemeinden_vereinigt';
const DWD_RADAR_LAYER = 'dwd:Radar_rv_product_1x1km_ger';
const DWD_GEWITTER_MESSUNG_LAYER = 'dwd:Gewittercluster,dwd:Blitzdichte';
const DWD_GEWITTER_PROGNOSE_LAYER = 'dwd:NCEW_EU';

const EBENEN_DEFINITIONEN: ReadonlyArray<{
  key: KartenEbeneKey;
  titel: string;
  beschreibung: string;
}> = [
  {
    key: 'warngebiete',
    titel: 'Warngebiete',
    beschreibung: 'Amtliche DWD-Gemeindewarnungen (Stufen 1–4)',
  },
  {
    key: 'regen',
    titel: 'Regen',
    beschreibung: '1-km-Radarkomposit (-60 Min. bis +120 Min.)',
  },
  {
    key: 'wolken',
    titel: 'Wolken',
    beschreibung: 'DWD ICON-D2 Bewölkung (-60 Min. bis +120 Min.)',
  },
  {
    key: 'gewitter',
    titel: 'Gewitter',
    beschreibung: 'Blitzdichte, Zellen & NowCastELEC-Prognose',
  },
];

function formatiereRadarUhrzeit(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatiereRelativLabel(minuten: number): string {
  if (minuten === 0) return 'Live-Analyse';
  if (minuten > 0) return `Vorhersage +${minuten} Min.`;
  return `Messung ${minuten} Min.`;
}

function ebeneIcon(key: KartenEbeneKey) {
  switch (key) {
    case 'warngebiete':
      return <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />;
    case 'regen':
      return <CloudRain className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />;
    case 'wolken':
      return <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />;
    case 'gewitter':
      return <Zap className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" aria-hidden="true" />;
  }
}

function breitengradZuMercatorY(latGrad: number): number {
  const rad = (latGrad * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function mercatorYZuBreitengrad(mercY: number): number {
  return ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
}

/**
 * Rendert das räumlich und zeitlich interpolierte DWD-ICON-D2-Wolkenfeld in < 2 ms
 * projektionsgetreu (EPSG:3857 Web Mercator) in eine transparente PNG-Data-URL.
 */
function erzeugeWolkenDataUrl(
  gitter: WolkenGitterZeitreihe,
  zielMs: number,
  istDunkelModus: boolean
): string | null {
  const breite = 208;
  const hoehe = 224;
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const feld = interpoliereWolkenFeldAufZeitpunkt(gitter, zielMs);
  const bildDaten = ctx.createImageData(breite, hoehe);
  const pixel = bildDaten.data;

  const mercMin = breitengradZuMercatorY(gitter.latMin);
  const mercMax = breitengradZuMercatorY(gitter.latMax);

  // Helle Silber-Wolken im Dark Mode, kontrastreiche Schiefer-Wolken auf heller BKG-Karte
  const basisR = istDunkelModus ? 226 : 94;
  const basisG = istDunkelModus ? 236 : 112;
  const basisB = istDunkelModus ? 250 : 138;
  const maxAlpha = istDunkelModus ? 185 : 168;

  for (let py = 0; py < hoehe; py++) {
    const mercY = mercMax - (py / (hoehe - 1)) * (mercMax - mercMin);
    const lat = mercatorYZuBreitengrad(mercY);

    for (let px = 0; px < breite; px++) {
      const lon = gitter.lonMin + (px / (breite - 1)) * (gitter.lonMax - gitter.lonMin);
      const bewoelkung = interpoliereWolkenWertBilinear(gitter, feld, lat, lon);

      const offset = (py * breite + px) * 4;
      if (bewoelkung <= 8) {
        pixel[offset + 3] = 0;
        continue;
      }

      const norm = (bewoelkung - 8) / 92;
      const intensiv = Math.pow(norm, 1.15);
      pixel[offset] = basisR;
      pixel[offset + 1] = basisG;
      pixel[offset + 2] = basisB;
      pixel[offset + 3] = Math.round(intensiv * maxAlpha);
    }
  }

  ctx.putImageData(bildDaten, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Interaktive Deutschland-Warn-, Regen-, Wolken- & Gewitterkarte (-60 Min. Messung bis +120 Min. Vorhersage)
 * auf Basis von Leaflet, BKG TopPlusOpen, DWD ICON-D2 Wolkengitter und DWD GeoServer WMS/WMS-T Layern.
 */
export function WarnUndRadarKarte({
  aktiverOrt,
  istDunkelModus,
  deutschlandWarnungen,
  radarZeitachse,
  wolkenGitter,
  aufKoordinateWaehlen,
}: WarnUndRadarKarteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const karteRef = useRef<L.Map | null>(null);
  const wolkenOverlayRef = useRef<L.ImageOverlay | null>(null);
  const warnLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const dwdRadarLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const gewitterLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const klickCallbackRef = useRef(aufKoordinateWaehlen);

  const [ebenen, setEbenen] = useState<EbenenAuswahl>({
    warngebiete: true,
    regen: true,
    wolken: false,
    gewitter: true,
  });
  const [menueOffen, setMenueOffen] = useState<boolean>(false);
  const [deckkraft, setDeckkraft] = useState<number>(0.72);
  const [spieltAnimation, setSpieltAnimation] = useState<boolean>(false);
  const [frameIndex, setFrameIndex] = useState<number>(0);

  klickCallbackRef.current = aufKoordinateWaehlen;

  const frames = radarZeitachse?.frames ?? [];
  const zeitSteuerungAktiv = ebenen.regen || ebenen.gewitter || ebenen.wolken;

  // Index des aktuellen Live-Analysebildes (relativMinuten === 0 bzw. letzter Nicht-Prognose-Frame)
  const liveIndex = useMemo(() => {
    if (frames.length === 0) return 0;
    let gefunden = 0;
    for (let i = 0; i < frames.length; i++) {
      if (!frames[i]?.istPrognose) {
        gefunden = i;
      }
    }
    return gefunden;
  }, [frames]);

  useEffect(() => {
    if (frames.length > 0) {
      setFrameIndex(liveIndex);
    }
  }, [liveIndex, frames.length]);

  // Schließe das Ebenen-Dropdown bei Klick außerhalb oder Escape
  useEffect(() => {
    if (!menueOffen) return;
    const beiMausKlick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenueOffen(false);
      }
    };
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenueOffen(false);
    };
    document.addEventListener('mousedown', beiMausKlick);
    document.addEventListener('keydown', beiTaste);
    return () => {
      document.removeEventListener('mousedown', beiMausKlick);
      document.removeEventListener('keydown', beiTaste);
    };
  }, [menueOffen]);

  // Film-Animation über Vergangenheit (-60 Min.) und Vorhersage (+120 Min.)
  useEffect(() => {
    if (!spieltAnimation || !zeitSteuerungAktiv || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((aktuell) => (aktuell + 1) % frames.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [spieltAnimation, zeitSteuerungAktiv, frames.length]);

  // Einmalige Initialisierung der Leaflet-Karte inkl. amtlicher BKG TopPlusOpen-Basiskarte (ohne API-Key)
  useEffect(() => {
    if (!containerRef.current || karteRef.current) return;

    const karte = L.map(containerRef.current, {
      center: [51.1657, 10.4515],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: true,
    });

    // Eigenes Karten-Pane für das Wolken-Overlay oberhalb der Basiskarte, aber unterhalb von Warnungen/Radar
    karte.createPane('wolkenPane');

    L.tileLayer(BKG_TOPPLUS_GRAU_URL, {
      attribution: '&copy; BKG TopPlusOpen (dl-de/by-2-0) &copy; DWD',
      maxZoom: 18,
      zIndex: 1,
      className: 'bkg-basemap-kacheln',
    }).addTo(karte);

    karte.on('click', (ereignis: L.LeafletMouseEvent) => {
      const { lat, lng } = ereignis.latlng;
      if (lat >= 45.5 && lat <= 56.5 && lng >= 4.0 && lng <= 17.5) {
        klickCallbackRef.current(lat, lng);
      }
    });

    karteRef.current = karte;

    return () => {
      karte.remove();
      karteRef.current = null;
      wolkenOverlayRef.current = null;
      warnLayerRef.current = null;
      dwdRadarLayerRef.current = null;
      gewitterLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Synchronisiere das verzögerungsfreie DWD-ICON-D2-Wolken-Canvas (-60 Min. bis +120 Min.)
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte) return;

    if (!ebenen.wolken || !wolkenGitter) {
      if (wolkenOverlayRef.current) {
        karte.removeLayer(wolkenOverlayRef.current);
        wolkenOverlayRef.current = null;
      }
      return;
    }

    const aktiverFrame = zeitSteuerungAktiv ? frames[frameIndex] : frames[liveIndex];
    const zielMs = aktiverFrame?.zeitpunktMs ?? Date.now();
    const dataUrl = erzeugeWolkenDataUrl(wolkenGitter, zielMs, istDunkelModus);
    if (!dataUrl) return;

    const grenzen: L.LatLngBoundsExpression = [
      [wolkenGitter.latMin, wolkenGitter.lonMin],
      [wolkenGitter.latMax, wolkenGitter.lonMax],
    ];

    if (!wolkenOverlayRef.current) {
      wolkenOverlayRef.current = L.imageOverlay(dataUrl, grenzen, {
        opacity: deckkraft,
        pane: 'wolkenPane',
        interactive: false,
      });
      wolkenOverlayRef.current.addTo(karte);
    } else {
      wolkenOverlayRef.current.setUrl(dataUrl);
      wolkenOverlayRef.current.setOpacity(deckkraft);
    }
  }, [
    ebenen.wolken,
    wolkenGitter,
    deckkraft,
    frameIndex,
    liveIndex,
    frames,
    zeitSteuerungAktiv,
    istDunkelModus,
  ]);

  // Synchronisiere DWD-WMS-Layer (tileSize: 512 senkt parallele GeoServer-Requests um 75 %)
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte) return;

    const wmsUrl = radarZeitachse?.wmsUrl || DWD_WMS_URL;
    const aktiverFrame = zeitSteuerungAktiv ? frames[frameIndex] : frames[liveIndex];
    const zeitParam = aktiverFrame?.zeitpunktIso;
    const istPrognoseZeitpunkt = Boolean(zeitSteuerungAktiv && aktiverFrame?.istPrognose);

    // 1. Amtliche DWD-Gemeindewarnungen
    if (ebenen.warngebiete) {
      if (!warnLayerRef.current) {
        warnLayerRef.current = L.tileLayer.wms(wmsUrl, {
          layers: DWD_WARN_LAYER,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          tileSize: 512,
          opacity: deckkraft,
          zIndex: 10,
        });
        warnLayerRef.current.addTo(karte);
      } else {
        warnLayerRef.current.setOpacity(deckkraft);
      }
    } else if (warnLayerRef.current) {
      karte.removeLayer(warnLayerRef.current);
      warnLayerRef.current = null;
    }

    // 2. Regenradar (DWD RV 1×1 km Analyse & +120 Min. Vorhersage mit WMS-TIME)
    if (ebenen.regen) {
      const radarLayerName = radarZeitachse?.layerName || DWD_RADAR_LAYER;
      if (!dwdRadarLayerRef.current) {
        const wmsOptionen: L.WMSOptions & { time?: string } = {
          layers: radarLayerName,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          tileSize: 512,
          opacity: deckkraft,
          zIndex: 20,
        };
        if (zeitParam) {
          wmsOptionen.time = zeitParam;
        }
        dwdRadarLayerRef.current = L.tileLayer.wms(wmsUrl, wmsOptionen);
        dwdRadarLayerRef.current.addTo(karte);
      } else {
        dwdRadarLayerRef.current.setOpacity(deckkraft);
        if (zeitParam) {
          const wmsUpdate: L.WMSParams & { time: string } = {
            layers: radarLayerName,
            time: zeitParam,
          };
          dwdRadarLayerRef.current.setParams(wmsUpdate);
        }
      }
    } else if (dwdRadarLayerRef.current) {
      karte.removeLayer(dwdRadarLayerRef.current);
      dwdRadarLayerRef.current = null;
    }

    // 3. Gewitter & Blitze (<= Jetzt: Gewittercluster + Blitzdichte | > Jetzt: NowCastELEC-WarnWetterApp)
    if (ebenen.gewitter) {
      const zielGewitterLayer = istPrognoseZeitpunkt
        ? DWD_GEWITTER_PROGNOSE_LAYER
        : DWD_GEWITTER_MESSUNG_LAYER;
      const gewitterDeckkraft = Math.min(0.95, deckkraft + 0.12);

      if (!gewitterLayerRef.current) {
        const wmsOptionen: L.WMSOptions & { time?: string } = {
          layers: zielGewitterLayer,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          tileSize: 512,
          opacity: gewitterDeckkraft,
          zIndex: 30,
        };
        if (zeitParam) {
          wmsOptionen.time = zeitParam;
        }
        gewitterLayerRef.current = L.tileLayer.wms(wmsUrl, wmsOptionen);
        gewitterLayerRef.current.addTo(karte);
      } else {
        gewitterLayerRef.current.setOpacity(gewitterDeckkraft);
        if (zeitParam) {
          const wmsUpdate: L.WMSParams & { time: string } = {
            layers: zielGewitterLayer,
            time: zeitParam,
          };
          gewitterLayerRef.current.setParams(wmsUpdate);
        } else {
          gewitterLayerRef.current.setParams({ layers: zielGewitterLayer });
        }
      }
    } else if (gewitterLayerRef.current) {
      karte.removeLayer(gewitterLayerRef.current);
      gewitterLayerRef.current = null;
    }
  }, [ebenen.warngebiete, ebenen.regen, ebenen.gewitter, deckkraft, frameIndex, liveIndex, frames, radarZeitachse, zeitSteuerungAktiv]);

  // Positionsmarker für aktiven Ort
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([aktiverOrt.breitengrad, aktiverOrt.laengengrad]);
      markerRef.current.bindTooltip(aktiverOrt.name, { direction: 'top', offset: [0, -6] });
    } else {
      const marker = L.circleMarker([aktiverOrt.breitengrad, aktiverOrt.laengengrad], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 1,
      });
      marker.bindTooltip(aktiverOrt.name, { direction: 'top', offset: [0, -6] });
      marker.addTo(karte);
      markerRef.current = marker;
    }
  }, [aktiverOrt]);

  const ebeneUmschalten = (key: KartenEbeneKey) => {
    setEbenen((bisher) => {
      const naechste = { ...bisher, [key]: !bisher[key] };
      if (!naechste.regen && !naechste.gewitter && !naechste.wolken) {
        setSpieltAnimation(false);
      }
      return naechste;
    });
  };

  const springeAufRelativMinuten = (zielMinuten: number) => {
    if (frames.length === 0) return;
    setSpieltAnimation(false);
    let besterIdx = 0;
    let kleinsteDiff = Infinity;
    frames.forEach((f, idx) => {
      const diff = Math.abs(f.relativMinuten - zielMinuten);
      if (diff < kleinsteDiff) {
        kleinsteDiff = diff;
        besterIdx = idx;
      }
    });
    setFrameIndex(besterIdx);
  };

  const aktiverRadarFrame = zeitSteuerungAktiv ? frames[frameIndex] : frames[liveIndex];
  const anzahlAktiv = EBENEN_DEFINITIONEN.filter((d) => ebenen[d.key]).length;
  const aktiveKurzliste = EBENEN_DEFINITIONEN.filter((d) => ebenen[d.key])
    .map((d) => d.titel)
    .join(', ');

  return (
    <section
      id="warnkarte"
      aria-label="Deutschland-Warnkarte mit Regenradar, Wolken und Gewitter-Nowcast"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
    >
      {/* Karten-Kopfzeile & Mehrfach-Auswahlliste für Ebenen */}
      <div className="p-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
            Live- &amp; Prognosekarte
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {anzahlAktiv > 0 ? `Aktiv: ${aktiveKurzliste}` : 'Keine Überlagerung aktiv'}
          </p>
        </div>

        {/* Aufklappbare Checkbox-Liste (Warngebiete, Regen, Wolken, Gewitter) */}
        <div ref={dropdownRef} className="relative self-start sm:self-auto">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={menueOffen}
            onClick={() => setMenueOffen((offen) => !offen)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Layers
              className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"
              aria-hidden="true"
            />
            <span>Kartenebenen ({anzahlAktiv}/4)</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                menueOffen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {menueOffen && (
            <div
              role="group"
              aria-label="Darzustellende Kartenebenen auswählen"
              className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-[500] p-1.5 space-y-0.5"
            >
              {EBENEN_DEFINITIONEN.map((def) => {
                const aktiv = ebenen[def.key];
                return (
                  <button
                    key={def.key}
                    type="button"
                    role="checkbox"
                    aria-checked={aktiv}
                    onClick={() => ebeneUmschalten(def.key)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-colors cursor-pointer ${
                      aktiv
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 text-slate-900 dark:text-slate-50'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        aktiv
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950'
                      }`}
                    >
                      {aktiv && <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {ebeneIcon(def.key)}
                        <span>{def.titel}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {def.beschreibung}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Karten-Bühne */}
      <div className="relative h-[410px] sm:h-[450px] w-full">
        <div ref={containerRef} className="h-full w-full z-0 cursor-crosshair" />

        {/* Aktiver Radar-/Wolken-/Gewitter-Zeitstempel direkt im Karten-HUD */}
        {zeitSteuerungAktiv && aktiverRadarFrame && (
          <div className="absolute top-3 left-14 z-[400] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-xs text-xs font-mono tabular-nums pointer-events-none">
            <span className="font-semibold text-slate-900 dark:text-slate-50">
              {formatiereRadarUhrzeit(aktiverRadarFrame.zeitpunktMs)} Uhr
            </span>
            <span aria-hidden="true" className="text-slate-400"> · </span>
            <span
              className={
                aktiverRadarFrame.istPrognose
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-emerald-700 dark:text-emerald-400'
              }
            >
              {formatiereRelativLabel(aktiverRadarFrame.relativMinuten)}
            </span>
          </div>
        )}

        {/* Navigations-Buttons rechts oben */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() =>
              karteRef.current?.flyTo([aktiverOrt.breitengrad, aktiverOrt.laengengrad], 9, {
                duration: 0.6,
              })
            }
            title="Auf gewählten Ort zoomen"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Zum Ort</span>
          </button>
          <button
            type="button"
            onClick={() =>
              karteRef.current?.flyTo([51.1657, 10.4515], 6, {
                duration: 0.6,
              })
            }
            title="Gesamtansicht Deutschland"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Deutschland</span>
          </button>
        </div>
      </div>

      {/* Fließende 5-Minuten-Zeitsteuerung (für Regen, Wolken & Gewitter) & Legenden */}
      <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 space-y-3">
        {zeitSteuerungAktiv && frames.length > 1 && aktiverRadarFrame && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpieltAnimation((aktiv) => !aktiv)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {spieltAnimation ? (
                    <>
                      <Pause className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Verlauf &amp; Prognose</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  aria-label="5 Minuten zurück"
                  onClick={() => {
                    setSpieltAnimation(false);
                    setFrameIndex((i) => Math.max(0, i - 1));
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="5 Minuten vor"
                  onClick={() => {
                    setSpieltAnimation(false);
                    setFrameIndex((i) => Math.min(frames.length - 1, i + 1));
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Schnellwahl-Zeitpunkte für Vergangenheit, Live & Zukunft */}
              <div className="flex items-center gap-1 font-mono tabular-nums text-xs">
                {[
                  { label: '-60m', min: -60 },
                  { label: 'Jetzt', min: 0 },
                  { label: '+60m', min: 60 },
                  { label: '+120m', min: 120 },
                ].map((ziel) => {
                  const istNah = Math.abs(aktiverRadarFrame.relativMinuten - ziel.min) <= 3;
                  return (
                    <button
                      key={ziel.label}
                      type="button"
                      onClick={() => springeAufRelativMinuten(ziel.min)}
                      className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        istNah
                          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold'
                          : 'bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      {ziel.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Durchgehender 5-Minuten-Zeitregler */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatiereRadarUhrzeit(frames[0]?.zeitpunktMs ?? Date.now())}
              </span>
              <input
                type="range"
                aria-label="Zeitpunkt zwischen -60 Minuten Messung und +120 Minuten Vorhersage wählen"
                min={0}
                max={frames.length - 1}
                value={frameIndex}
                onChange={(e) => {
                  setSpieltAnimation(false);
                  setFrameIndex(Number(e.target.value));
                }}
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] font-mono tabular-nums text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {formatiereRadarUhrzeit(frames[frames.length - 1]?.zeitpunktMs ?? Date.now())} (+2h)
              </span>
            </div>
          </div>
        )}

        {/* DWD-Warnstufen-, Wolken-, Gewitter- & Deckkraft-Leiste */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Legende:</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
              <span>1 Gelb</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 shrink-0" />
              <span>2 Orange</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 shrink-0" />
              <span>3 Rot</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-700 shrink-0" />
              <span>4 Violett</span>
            </span>
            {ebenen.wolken && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-600 dark:text-slate-300">
                <Cloud className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Wolken (ICON-D2)</span>
              </span>
            )}
            {ebenen.gewitter && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-fuchsia-700 dark:text-fuchsia-300">
                <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Blitze / NowCastELEC</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 dark:text-slate-400">Deckkraft:</span>
            {[0.55, 0.72, 0.9].map((wert) => (
              <button
                key={wert}
                type="button"
                onClick={() => setDeckkraft(wert)}
                className={`px-2 py-0.5 font-mono tabular-nums rounded text-xs cursor-pointer ${
                  Math.abs(deckkraft - wert) < 0.02
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {Math.round(wert * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* Bundesweite Live-Warnzusammenfassung */}
        {deutschlandWarnungen && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span>Bundesweit aktive DWD-Meldungen: </span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {deutschlandWarnungen.gesamtAktiv}
              </strong>
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">
                Stufe 1: {deutschlandWarnungen.nachStufe.stufe1} · Stufe 2:{' '}
                {deutschlandWarnungen.nachStufe.stufe2} · Stufe 3:{' '}
                {deutschlandWarnungen.nachStufe.stufe3} · Stufe 4:{' '}
                {deutschlandWarnungen.nachStufe.stufe4}
              </span>
            </div>
            {deutschlandWarnungen.schwerpunkte[0] && (
              <div className="truncate">
                Häufigstes Ereignis: {deutschlandWarnungen.schwerpunkte[0].ereignis} (
                <span className="font-mono tabular-nums">
                  {deutschlandWarnungen.schwerpunkte[0].anzahlGebiete}
                </span>
                )
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
