import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, UIEvent } from 'react';
import { Droplets, Sun } from 'lucide-react';
import type {
  StundenVorhersagePunkt,
  TagesVorhersagePunkt,
} from '../shared/wetterTypen.ts';
import {
  berechneAufUndUntergang,
  berechneMondHoeheGrad,
  berechneSonnenHoeheGrad,
} from '../shared/astronomie.ts';
import { WetterSymbol } from './WetterSymbol.tsx';

interface WetterVerlaufKombiProps {
  stunden: StundenVorhersagePunkt[];
  tageKacheln: TagesVorhersagePunkt[];
  breitengrad: number;
  laengengrad: number;
  aktiverTagDatum: string;
  scrollTriggerZaehler: number;
  aufTagAktivieren: (datum: string) => void;
}

const STUNDEN_BREITE = 34;
const RAND_LINKS = 52;
const RAND_RECHTS = 56;

// Einheitliche SVG-Höhen & Y-Startpositionen für exakte Synchronisation zwischen Skalen und Kurven
const H_KOPF_ZEITLEISTE = 82;
const H_TEMP_CHART = 176;
const H_REGEN_WAHRSCH = 26;
const H_WIND_CHART = 152;
const H_WIND_PFEILE = 30;
const H_FEUCHTE_CHART = 172;
const H_DRUCK_CHART = 128;
const H_WOLKEN_CHART = 128;
const H_ASTRO_CHART = 156;

const Y_BLOCK_TEMP = H_KOPF_ZEITLEISTE;
const Y_BLOCK_WIND = Y_BLOCK_TEMP + H_TEMP_CHART + H_REGEN_WAHRSCH;
const Y_BLOCK_FEUCHTE = Y_BLOCK_WIND + H_WIND_CHART + H_WIND_PFEILE;
const Y_BLOCK_DRUCK = Y_BLOCK_FEUCHTE + H_FEUCHTE_CHART;
const Y_BLOCK_WOLKEN = Y_BLOCK_DRUCK + H_DRUCK_CHART;
const Y_BLOCK_ASTRO = Y_BLOCK_WOLKEN + H_WOLKEN_CHART;
const GESAMT_SVG_HOEHE = Y_BLOCK_ASTRO + H_ASTRO_CHART;

function formatUhrzeit(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatMsUhrzeit(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function holeStundeBerlin(iso: string): number {
  const teile = formatUhrzeit(iso).split(':');
  return Number(teile[0] ?? 0);
}

function baueGlattenPfad(punkte: Array<{ x: number; y: number } | null>): string {
  let pfad = '';
  let segmentAktiv = false;

  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i];
    if (!p) {
      segmentAktiv = false;
      continue;
    }
    if (!segmentAktiv) {
      pfad += `${pfad ? ' ' : ''}M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      segmentAktiv = true;
    } else {
      const vor = punkte[i - 1];
      if (vor) {
        const cx = ((vor.x + p.x) / 2).toFixed(1);
        pfad += ` C ${cx} ${vor.y.toFixed(1)}, ${cx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      } else {
        pfad += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
    }
  }

  return pfad;
}

/**
 * Kombinierte, endlos horizontal scrollbare Stundenvorhersage & Mehrfach-Diagrammansicht
 * nach Vorbild der offiziellen DWD WarnWetter-App (5 synchronisierte Blöcke + Trennlinien).
 */
export function WetterVerlaufKombi({
  stunden,
  tageKacheln,
  breitengrad,
  laengengrad,
  aktiverTagDatum,
  scrollTriggerZaehler,
  aufTagAktivieren,
}: WetterVerlaufKombiProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const kachelLeisteRef = useRef<HTMLDivElement | null>(null);
  const ziehtFadenkreuzRef = useRef<boolean>(false);
  const programmiertesScrollenRef = useRef<boolean>(false);

  // Initialer Fokus auf die erste Vorhersagestunde ("Jetzt")
  const ersterPrognoseIndex = useMemo(() => {
    const idx = stunden.findIndex((s) => !s.istVergangenheit);
    return idx >= 0 ? idx : 0;
  }, [stunden]);

  const [fokusIndex, setFokusIndex] = useState<number>(ersterPrognoseIndex);

  useEffect(() => {
    setFokusIndex(ersterPrognoseIndex);
  }, [ersterPrognoseIndex]);

  const gesamtBreite = useMemo(
    () => Math.max(760, RAND_LINKS + RAND_RECHTS + Math.max(1, stunden.length - 1) * STUNDEN_BREITE),
    [stunden.length]
  );

  const xVonIndex = useCallback(
    (idx: number) => RAND_LINKS + idx * STUNDEN_BREITE,
    []
  );

  // Scrolle zu einem bestimmten Kalendertag (bei "Heute" direkt auf die aktuelle Stunde)
  const scrolleZuTag = useCallback(
    (datum: string, setzeAuchFokus: boolean) => {
      const container = scrollContainerRef.current;
      if (!container || stunden.length === 0) return;

      const heuteKachel = tageKacheln.find((k) => k.istHeute);
      let zielIndex = stunden.findIndex((s) => s.datumSchluessel === datum);
      if (zielIndex < 0) return;

      if (heuteKachel && datum === heuteKachel.datum) {
        zielIndex = ersterPrognoseIndex;
      } else if (setzeAuchFokus) {
        // Setze Fokus im gewählten Tag auf 12:00 Uhr mittags (falls vorhanden), sonst Tagesbeginn
        const mittagsIdx = stunden.findIndex(
          (s) => s.datumSchluessel === datum && holeStundeBerlin(s.zeitpunkt) === 12
        );
        if (mittagsIdx >= 0) {
          zielIndex = mittagsIdx;
        }
      }

      if (setzeAuchFokus) {
        setFokusIndex(zielIndex);
      }

      const tagStartIdx = stunden.findIndex((s) => s.datumSchluessel === datum);
      const scrollZielX = Math.max(
        0,
        xVonIndex(datum === heuteKachel?.datum ? Math.max(0, ersterPrognoseIndex - 4) : tagStartIdx) -
          RAND_LINKS
      );

      programmiertesScrollenRef.current = true;
      container.scrollTo({ left: scrollZielX, behavior: 'smooth' });
      window.setTimeout(() => {
        programmiertesScrollenRef.current = false;
      }, 450);
    },
    [stunden, tageKacheln, ersterPrognoseIndex, xVonIndex]
  );

  // Einmalig beim Ortswechsel auf "Heute / Jetzt" positionieren
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || stunden.length === 0) return;
    const startX = Math.max(0, xVonIndex(Math.max(0, ersterPrognoseIndex - 4)) - RAND_LINKS);
    container.scrollLeft = startX;
  }, [stunden, ersterPrognoseIndex, xVonIndex]);

  // Wenn aus der unteren 7-Tage-Tabelle ein Tag angeklickt wird, dorthin scrollen
  useEffect(() => {
    if (scrollTriggerZaehler > 0 && aktiverTagDatum) {
      scrolleZuTag(aktiverTagDatum, true);
    }
  }, [scrollTriggerZaehler, aktiverTagDatum, scrolleZuTag]);

  // Berechne Skalen, Kurvenpfade, Trennlinien und Astronomie-Daten in einem einzigen Memo-Block
  const berechnung = useMemo(() => {
    if (stunden.length === 0) return null;

    // 1. Mitternachts-Tagestrennlinien (00:00 Uhr jedes neuen Kalendertages)
    const tagesTrennlinien: Array<{ idx: number; x: number; datum: string; label: string }> = [];
    const kachelMap = new Map(tageKacheln.map((k) => [k.datum, k.kachelTitel]));

    for (let i = 0; i < stunden.length; i++) {
      const akt = stunden[i];
      const vor = i > 0 ? stunden[i - 1] : null;
      if (akt && (!vor || akt.datumSchluessel !== vor.datumSchluessel)) {
        tagesTrennlinien.push({
          idx: i,
          x: i === 0 ? xVonIndex(0) : (xVonIndex(i - 1) + xVonIndex(i)) / 2,
          datum: akt.datumSchluessel,
          label: kachelMap.get(akt.datumSchluessel) ?? akt.datumSchluessel,
        });
      }
    }

    // 2. Prognose-Trennlinie ("Jetzt" zwischen Messung und Vorhersage)
    const prognoseTrennX =
      ersterPrognoseIndex > 0
        ? (xVonIndex(ersterPrognoseIndex - 1) + xVonIndex(ersterPrognoseIndex)) / 2
        : null;

    // 3. Temperatur-, Taupunkt- & Niederschlags-Skala (5°C-Raster)
    const alleTemps: number[] = [];
    for (const s of stunden) {
      if (s.temperatur !== null) alleTemps.push(s.temperatur);
      if (s.taupunkt !== null) alleTemps.push(s.taupunkt);
    }
    const rohTempMin = alleTemps.length > 0 ? Math.min(...alleTemps) : 0;
    const rohTempMax = alleTemps.length > 0 ? Math.max(...alleTemps) : 15;
    const tempMin = Math.floor((rohTempMin - 3) / 5) * 5;
    const tempMax = Math.ceil((rohTempMax + 4) / 5) * 5;
    const tempSpanne = Math.max(10, tempMax - tempMin);

    const tempTicks: number[] = [];
    for (let w = tempMin; w <= tempMax; w += 5) {
      tempTicks.push(w);
    }

    const tempRandOben = 28;
    const tempRandUnten = 12;
    const tempPlotH = H_TEMP_CHART - tempRandOben - tempRandUnten;
    const yTemp = (grad: number) =>
      tempRandOben + tempPlotH - ((grad - tempMin) / tempSpanne) * tempPlotH;

    const tempPunkte = stunden.map((s, idx) =>
      s.temperatur !== null ? { x: xVonIndex(idx), y: yTemp(s.temperatur) } : null
    );
    const tempPfad = baueGlattenPfad(tempPunkte);

    // Modellstreuungs-Band um die Temperaturkurve (ab Prognosebeginn leicht aufweitend wie im DWD-Ensemble)
    const bandOben: string[] = [];
    const bandUnten: string[] = [];
    stunden.forEach((s, idx) => {
      if (s.temperatur === null) return;
      const stundenInZukunft = Math.max(0, idx - ersterPrognoseIndex);
      const unsicherheit = s.istVergangenheit
        ? 0.8
        : Math.min(3.2, 1.3 + stundenInZukunft * 0.015);
      const x = xVonIndex(idx).toFixed(1);
      bandOben.push(`${x} ${yTemp(s.temperatur + unsicherheit).toFixed(1)}`);
      bandUnten.unshift(`${x} ${yTemp(s.temperatur - unsicherheit).toFixed(1)}`);
    });
    const streuungsBandPfad =
      bandOben.length > 1 ? `M ${bandOben.join(' L ')} L ${bandUnten.join(' L ')} Z` : '';

    // 4. Wind & Böen Skala (10 km/h-Raster)
    const maxBoe = Math.max(
      35,
      ...stunden.map((s) => Math.max(s.windboeenKmh ?? 0, s.windgeschwindigkeitKmh ?? 0))
    );
    const windMax = Math.ceil((maxBoe + 6) / 10) * 10;
    const windSchritt = windMax > 60 ? 20 : 10;
    const windTicks: number[] = [];
    for (let w = 0; w <= windMax; w += windSchritt) {
      windTicks.push(w);
    }
    const windRandOben = 28;
    const windRandUnten = 10;
    const windPlotH = H_WIND_CHART - windRandOben - windRandUnten;
    const yWind = (kmh: number) =>
      windRandOben + windPlotH - (Math.max(0, kmh) / windMax) * windPlotH;

    const mittelwindPunkte = stunden.map((s, idx) =>
      s.windgeschwindigkeitKmh !== null
        ? { x: xVonIndex(idx), y: yWind(s.windgeschwindigkeitKmh) }
        : null
    );
    const boeenPunkte = stunden.map((s, idx) =>
      s.windboeenKmh !== null ? { x: xVonIndex(idx), y: yWind(s.windboeenKmh) } : null
    );
    const mittelwindPfad = baueGlattenPfad(mittelwindPunkte);
    const boeenPfad = baueGlattenPfad(boeenPunkte);

    // 5. Taupunkt, Temperatur & Feuchte (0–100 % rechts, °C links)
    const feuchteRandOben = 28;
    const feuchteRandUnten = 10;
    const feuchtePlotH = H_FEUCHTE_CHART - feuchteRandOben - feuchteRandUnten;
    const yTempFeuchte = (grad: number) =>
      feuchteRandOben + feuchtePlotH - ((grad - tempMin) / tempSpanne) * feuchtePlotH;
    const yFeuchteProzent = (prozent: number) =>
      feuchteRandOben + feuchtePlotH - (Math.max(0, Math.min(100, prozent)) / 100) * feuchtePlotH;

    const tempFeuchtePfad = baueGlattenPfad(
      stunden.map((s, idx) =>
        s.temperatur !== null ? { x: xVonIndex(idx), y: yTempFeuchte(s.temperatur) } : null
      )
    );
    const taupunktPfad = baueGlattenPfad(
      stunden.map((s, idx) =>
        s.taupunkt !== null ? { x: xVonIndex(idx), y: yTempFeuchte(s.taupunkt) } : null
      )
    );

    // 6. Luftdruck in hPa (5-hPa-Raster)
    const druckWerte = stunden
      .map((s) => s.luftdruckHpa)
      .filter((p): p is number => p !== null && Number.isFinite(p));
    const rohDruckMin = druckWerte.length > 0 ? Math.min(...druckWerte) : 1005;
    const rohDruckMax = druckWerte.length > 0 ? Math.max(...druckWerte) : 1030;
    const druckMin = Math.min(1005, Math.floor((rohDruckMin - 3) / 5) * 5);
    const druckMax = Math.max(1030, Math.ceil((rohDruckMax + 3) / 5) * 5);
    const druckSpanne = Math.max(20, druckMax - druckMin);
    const druckTicks: number[] = [];
    for (let p = druckMin; p <= druckMax; p += 5) {
      druckTicks.push(p);
    }
    const druckRandOben = 26;
    const druckRandUnten = 10;
    const druckPlotH = H_DRUCK_CHART - druckRandOben - druckRandUnten;
    const yDruck = (hpa: number) =>
      druckRandOben + druckPlotH - ((hpa - druckMin) / druckSpanne) * druckPlotH;
    const druckPfad = baueGlattenPfad(
      stunden.map((s, idx) =>
        s.luftdruckHpa !== null ? { x: xVonIndex(idx), y: yDruck(s.luftdruckHpa) } : null
      )
    );

    // 7. Bewölkung in % (0–100 %, Kurve + Flächenfüllung)
    const wolkenRandOben = 26;
    const wolkenRandUnten = 10;
    const wolkenPlotH = H_WOLKEN_CHART - wolkenRandOben - wolkenRandUnten;
    const yWolkenProzent = (prozent: number) =>
      wolkenRandOben + wolkenPlotH - (Math.max(0, Math.min(100, prozent)) / 100) * wolkenPlotH;
    const wolkenPunkte = stunden.map((s, idx) =>
      s.bewoelkungProzent !== null
        ? { x: xVonIndex(idx), y: yWolkenProzent(s.bewoelkungProzent) }
        : null
    );
    const wolkenPfad = baueGlattenPfad(wolkenPunkte);

    const basisWolkenY = yWolkenProzent(0).toFixed(1);
    const flaechenTeile: string[] = [];
    let laufendesSegment: Array<{ x: number; y: number }> = [];
    const schliesseSegment = () => {
      if (laufendesSegment.length > 1) {
        const kurve = baueGlattenPfad(laufendesSegment);
        const startX = (laufendesSegment[0]?.x ?? RAND_LINKS).toFixed(1);
        const endX = (laufendesSegment[laufendesSegment.length - 1]?.x ?? RAND_LINKS).toFixed(1);
        flaechenTeile.push(`${kurve} L ${endX} ${basisWolkenY} L ${startX} ${basisWolkenY} Z`);
      }
      laufendesSegment = [];
    };
    for (const p of wolkenPunkte) {
      if (p) laufendesSegment.push(p);
      else schliesseSegment();
    }
    schliesseSegment();
    const wolkenFlaechePfad = flaechenTeile.join(' ');

    // 8. Sonne & Mond Kurven + tägliche Auf- & Untergangsmarken
    const astroRandOben = 28;
    const astroRandUnten = 22;
    const astroPlotH = H_ASTRO_CHART - astroRandOben - astroRandUnten;
    const horizontY = astroRandOben + astroPlotH * 0.56;
    const yAstro = (hoeheGrad: number) => {
      const begrenzt = Math.max(-65, Math.min(65, hoeheGrad));
      return horizontY - (begrenzt / 65) * (astroPlotH * 0.44);
    };

    const sonnenPunkte = stunden.map((s, idx) => {
      const ms = Date.parse(s.zeitpunkt);
      return {
        x: xVonIndex(idx),
        y: yAstro(berechneSonnenHoeheGrad(ms, breitengrad, laengengrad)),
        ms,
      };
    });
    const mondPunkte = stunden.map((s, idx) => {
      const ms = Date.parse(s.zeitpunkt);
      return {
        x: xVonIndex(idx),
        y: yAstro(berechneMondHoeheGrad(ms, breitengrad, laengengrad)),
        ms,
      };
    });

    const sonnenPfad = baueGlattenPfad(sonnenPunkte);
    const mondPfad = baueGlattenPfad(mondPunkte);

    const startMs = sonnenPunkte[0]?.ms ?? Date.now();
    const endeMs = sonnenPunkte[sonnenPunkte.length - 1]?.ms ?? startMs + 3600_000;
    const xVonZeitMs = (zielMs: number): number | null => {
      if (zielMs < startMs || zielMs > endeMs || endeMs <= startMs) return null;
      const bruchteil = ((zielMs - startMs) / (endeMs - startMs)) * (stunden.length - 1);
      return xVonIndex(bruchteil);
    };

    const tagesAstroMarken: Array<{
      datum: string;
      aufgangX: number | null;
      aufgangText: string | null;
      untergangX: number | null;
      untergangText: string | null;
      mondAufX: number | null;
      mondAufText: string | null;
      mondUnterX: number | null;
      mondUnterText: string | null;
    }> = [];

    for (let t = 0; t < tagesTrennlinien.length; t++) {
      const startIdx = tagesTrennlinien[t]?.idx ?? 0;
      const endIdx =
        t + 1 < tagesTrennlinien.length
          ? (tagesTrennlinien[t + 1]?.idx ?? stunden.length - 1)
          : stunden.length - 1;
      const tStartMs = Date.parse(stunden[startIdx]?.zeitpunkt ?? '');
      const tEndeMs = Date.parse(stunden[endIdx]?.zeitpunkt ?? '') + 3600_000;
      if (!Number.isFinite(tStartMs) || !Number.isFinite(tEndeMs)) continue;

      const ereignisse = berechneAufUndUntergang(tStartMs, tEndeMs, breitengrad, laengengrad);
      tagesAstroMarken.push({
        datum: tagesTrennlinien[t]?.datum ?? `${t}`,
        aufgangX: ereignisse.sonnenaufgangMs ? xVonZeitMs(ereignisse.sonnenaufgangMs) : null,
        aufgangText: ereignisse.sonnenaufgangMs
          ? formatMsUhrzeit(ereignisse.sonnenaufgangMs)
          : null,
        untergangX: ereignisse.sonnenuntergangMs
          ? xVonZeitMs(ereignisse.sonnenuntergangMs)
          : null,
        untergangText: ereignisse.sonnenuntergangMs
          ? formatMsUhrzeit(ereignisse.sonnenuntergangMs)
          : null,
        mondAufX: ereignisse.mondaufgangMs ? xVonZeitMs(ereignisse.mondaufgangMs) : null,
        mondAufText: ereignisse.mondaufgangMs ? formatMsUhrzeit(ereignisse.mondaufgangMs) : null,
        mondUnterX: ereignisse.monduntergangMs
          ? xVonZeitMs(ereignisse.monduntergangMs)
          : null,
        mondUnterText: ereignisse.monduntergangMs
          ? formatMsUhrzeit(ereignisse.monduntergangMs)
          : null,
      });
    }

    return {
      tagesTrennlinien,
      prognoseTrennX,
      tempMin,
      tempMax,
      tempTicks,
      tempRandOben,
      tempPlotH,
      yTemp,
      tempPfad,
      streuungsBandPfad,
      windMax,
      windTicks,
      windRandOben,
      windPlotH,
      yWind,
      mittelwindPfad,
      boeenPfad,
      feuchteRandOben,
      feuchtePlotH,
      yTempFeuchte,
      yFeuchteProzent,
      tempFeuchtePfad,
      taupunktPfad,
      druckTicks,
      druckRandOben,
      druckPlotH,
      yDruck,
      druckPfad,
      wolkenRandOben,
      wolkenPlotH,
      yWolkenProzent,
      wolkenPfad,
      wolkenFlaechePfad,
      astroRandOben,
      astroPlotH,
      horizontY,
      sonnenPunkte,
      mondPunkte,
      sonnenPfad,
      mondPfad,
      tagesAstroMarken,
    };
  }, [stunden, tageKacheln, ersterPrognoseIndex, breitengrad, laengengrad, xVonIndex]);

  if (!berechnung || stunden.length === 0) {
    return null;
  }

  const sichererFokusIndex = Math.min(Math.max(0, fokusIndex), stunden.length - 1);
  const fokusStunde = stunden[sichererFokusIndex] ?? stunden[0];
  const fokusX = xVonIndex(sichererFokusIndex);

  // Aktualisiere den fokussierten Stundenindex anhand der Zeigerposition im Scroll-Container
  const aktualisiereFokusAusZeiger = (clientX: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const xImInhalt = clientX - rect.left + container.scrollLeft;
    const rohIdx = Math.round((xImInhalt - RAND_LINKS) / STUNDEN_BREITE);
    const geklemmt = Math.max(0, Math.min(stunden.length - 1, rohIdx));
    setFokusIndex(geklemmt);
    const neuerTag = stunden[geklemmt]?.datumSchluessel;
    if (neuerTag && neuerTag !== aktiverTagDatum) {
      aufTagAktivieren(neuerTag);
    }
  };

  const beiPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    ziehtFadenkreuzRef.current = true;
    aktualisiereFokusAusZeiger(e.clientX);
  };

  const beiPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ziehtFadenkreuzRef.current && e.pointerType !== 'mouse') return;
    if (e.pointerType === 'mouse' || ziehtFadenkreuzRef.current) {
      aktualisiereFokusAusZeiger(e.clientX);
    }
  };

  const beiPointerUp = () => {
    ziehtFadenkreuzRef.current = false;
  };

  // Synchronisiere beim freien horizontalen Scrollen die oben hervorgehobene Tageskachel
  const beiHorizontalScroll = (e: UIEvent<HTMLDivElement>) => {
    if (programmiertesScrollenRef.current) return;
    const mitteX = e.currentTarget.scrollLeft + e.currentTarget.clientWidth * 0.35;
    const idx = Math.max(
      0,
      Math.min(stunden.length - 1, Math.round((mitteX - RAND_LINKS) / STUNDEN_BREITE))
    );
    const sichtbarerTag = stunden[idx]?.datumSchluessel;
    if (sichtbarerTag && sichtbarerTag !== aktiverTagDatum) {
      aufTagAktivieren(sichtbarerTag);
    }
  };

  const klemmePopoverX = (breiteBox: number) =>
    Math.max(RAND_LINKS + breiteBox / 2 + 6, Math.min(gesamtBreite - RAND_RECHTS - breiteBox / 2 - 6, fokusX));

  return (
    <section
      id="stundenvorhersage"
      aria-label="Kombinierte Stundenvorhersage und Wetterdiagramme"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081226] overflow-hidden"
    >
      {/* 1. Horizontale Tageskarten-Leiste (inkl. Rückblick "Gestern" + Heute + 7 Tage) */}
      <div
        ref={kachelLeisteRef}
        role="tablist"
        aria-label="Tag im Wetterverlauf auswählen"
        className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800/90 bg-slate-100/90 dark:bg-[#0B1730] flex items-stretch gap-2.5 overflow-x-auto"
      >
        {tageKacheln.map((kachel) => {
          const istAktiv = kachel.datum === aktiverTagDatum;
          return (
            <button
              key={kachel.datum}
              type="button"
              role="tab"
              aria-selected={istAktiv}
              onClick={() => {
                aufTagAktivieren(kachel.datum);
                scrolleZuTag(kachel.datum, true);
              }}
              className={`min-w-[116px] sm:min-w-[126px] px-3 py-2.5 rounded-lg border flex flex-col items-center justify-between gap-1.5 transition-colors shrink-0 cursor-pointer ${
                istAktiv
                  ? 'bg-[#2A58A8] border-[#5B8DEF] text-white shadow-sm'
                  : kachel.istVergangenheit
                  ? 'bg-slate-200/70 dark:bg-[#192846]/70 border-slate-300 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E3156]'
                  : 'bg-white dark:bg-[#0E1B36] border-slate-300 dark:border-slate-700/90 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#15264A]'
              }`}
            >
              <span className="text-xs font-bold whitespace-nowrap">{kachel.kachelTitel}</span>

              <WetterSymbol iconCode={kachel.iconCode} groesse="w-6 h-6" />

              <span className="text-xs font-mono tabular-nums font-semibold whitespace-nowrap">
                {Math.round(kachel.temperaturMin)}° | {Math.round(kachel.temperaturMax)}°
              </span>

              <div
                className={`flex items-center gap-2 text-[11px] font-mono tabular-nums whitespace-nowrap ${
                  istAktiv ? 'text-blue-100' : 'text-slate-500 dark:text-slate-300'
                }`}
              >
                <span className="inline-flex items-center gap-0.5">
                  <Droplets className="w-3 h-3 text-sky-400 shrink-0" aria-hidden="true" />
                  <span>{Math.round(kachel.niederschlagSummeMm)}mm</span>
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Sun className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>
                    {kachel.sonnenscheinStunden !== null
                      ? `${Math.round(kachel.sonnenscheinStunden)}h`
                      : '– h'}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Endlos horizontal scrollbare Synchron-Bühne mit fixierten Achsen-Overlays */}
      <div className="relative select-none">
        {/* Fixierte linke Achsen- & Diagrammtitel-Spalte (bleibt beim Scrollen links stehen) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-64 z-20 flex flex-col"
        >
          {/* Platzhalter für die obere Stundenleiste */}
          <div className="h-[82px]" />

          {/* Block 1 Links: Temperatur & Niederschlag */}
          <div className="h-[176px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Temperatur &amp; Niederschlag
            </span>
          </div>
          <div className="h-[26px] flex items-center px-3">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-[#0D1B36]/90 px-1.5 rounded">
              Niederschlagswahrscheinlichkeit
            </span>
          </div>

          {/* Block 2 Links: Wind & Böen */}
          <div className="h-[152px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Wind &amp; Böen in km/h
            </span>
          </div>
          <div className="h-[30px]" />

          {/* Block 3 Links: Taupunkt & Temperatur & Feuchte */}
          <div className="h-[172px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Taupunkt &amp; Temperatur &amp; Feuchte
            </span>
          </div>

          {/* Block 4 Links: Luftdruck */}
          <div className="h-[128px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Luftdruck in hPa
            </span>
          </div>

          {/* Block 5 Links: Bewölkung */}
          <div className="h-[128px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Bewölkung in %
            </span>
          </div>

          {/* Block 6 Links: Sonne & Mond */}
          <div className="h-[156px] relative px-3 pt-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/85 dark:bg-[#081226]/85 px-1.5 py-0.5 rounded">
              Sonne &amp; Mond
            </span>
          </div>
        </div>

        {/* Fixierte linke Y-Skalenwerte */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-13 z-20 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-[#081226] dark:via-[#081226]/90 dark:to-transparent"
        >
          <svg viewBox={`0 0 52 ${GESAMT_SVG_HOEHE}`} className="w-full h-full">
            {/* Block 1 Temp-Skala */}
            <g transform={`translate(0, ${Y_BLOCK_TEMP})`}>
              {berechnung.tempTicks.map((t) => (
                <text
                  key={`t1-${t}`}
                  x="8"
                  y={berechnung.yTemp(t) - 3}
                  className="fill-slate-600 dark:fill-slate-200 text-[11px] font-mono"
                >
                  {t}°
                </text>
              ))}
            </g>

            {/* Block 2 Wind-Skala */}
            <g transform={`translate(0, ${Y_BLOCK_WIND})`}>
              {berechnung.windTicks.map((w) => (
                <text
                  key={`w-${w}`}
                  x="8"
                  y={berechnung.yWind(w) - 3}
                  className="fill-slate-600 dark:fill-slate-200 text-[11px] font-mono"
                >
                  {w}
                </text>
              ))}
            </g>

            {/* Block 3 Taupunkt/Temp-Skala */}
            <g transform={`translate(0, ${Y_BLOCK_FEUCHTE})`}>
              {berechnung.tempTicks.map((t) => (
                <text
                  key={`t3-${t}`}
                  x="8"
                  y={berechnung.yTempFeuchte(t) - 3}
                  className="fill-slate-600 dark:fill-slate-200 text-[11px] font-mono"
                >
                  {t}°
                </text>
              ))}
            </g>

            {/* Block 4 Druck-Skala */}
            <g transform={`translate(0, ${Y_BLOCK_DRUCK})`}>
              {berechnung.druckTicks.map((p) => (
                <text
                  key={`p-${p}`}
                  x="6"
                  y={berechnung.yDruck(p) + 3}
                  className="fill-slate-600 dark:fill-slate-200 text-[10px] font-mono"
                >
                  {p}
                </text>
              ))}
            </g>
          </svg>
        </div>

        {/* Fixierte rechte Y-Skalenwerte (Intensität, Luftfeuchte % & Bewölkung %) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-15 z-20 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-[#081226] dark:via-[#081226]/90 dark:to-transparent"
        >
          <svg viewBox={`0 0 60 ${GESAMT_SVG_HOEHE}`} className="w-full h-full">
            {/* Block 1 Rechts: Niederschlagsintensität */}
            <g transform={`translate(0, ${Y_BLOCK_TEMP})`}>
              {[
                { label: 'extrem', faktor: 0.16 },
                { label: 'stark', faktor: 0.42 },
                { label: 'leicht', faktor: 0.68 },
                { label: 'gering', faktor: 0.94 },
              ].map((stufe) => (
                <text
                  key={stufe.label}
                  x="54"
                  y={berechnung.tempRandOben + berechnung.tempPlotH * stufe.faktor}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-200 text-[10px]"
                >
                  {stufe.label}
                </text>
              ))}
            </g>

            {/* Block 3 Rechts: Relative Luftfeuchtigkeit 0% - 80% */}
            <g transform={`translate(0, ${Y_BLOCK_FEUCHTE})`}>
              {[80, 60, 40, 20, 0].map((proz) => (
                <text
                  key={`rh-${proz}`}
                  x="54"
                  y={berechnung.yFeuchteProzent(proz) - 2}
                  textAnchor="end"
                  className="fill-slate-600 dark:fill-slate-100 text-[10px] font-mono"
                >
                  {proz} %
                </text>
              ))}
            </g>

            {/* Block 5 Rechts: Bewölkungsgrad 0% - 100% */}
            <g transform={`translate(0, ${Y_BLOCK_WOLKEN})`}>
              {[100, 75, 50, 25, 0].map((proz) => (
                <text
                  key={`cl-${proz}`}
                  x="54"
                  y={berechnung.yWolkenProzent(proz) + 3}
                  textAnchor="end"
                  className="fill-slate-600 dark:fill-slate-200 text-[10px] font-mono"
                >
                  {proz} %
                </text>
              ))}
            </g>
          </svg>
        </div>

        {/* Endlos horizontal scrollbarer Haupt-Container */}
        <div
          ref={scrollContainerRef}
          onScroll={beiHorizontalScroll}
          onPointerDown={beiPointerDown}
          onPointerMove={beiPointerMove}
          onPointerUp={beiPointerUp}
          onPointerCancel={beiPointerUp}
          className="overflow-x-auto cursor-crosshair"
        >
          <svg
            viewBox={`0 0 ${gesamtBreite} ${GESAMT_SVG_HOEHE}`}
            width={gesamtBreite}
            height={GESAMT_SVG_HOEHE}
            className="block"
            role="img"
            aria-label="Synchronisierte DWD-Stundenübersicht und Verlaufsdiagramme über alle Tage"
          >
            {/* =====================================================================
                ZEILE 0: STUNDEN- & WETTERSYMBOL-LEISTE (00:00, 03:00, 06:00 ...)
               ===================================================================== */}
            <rect
              x="0"
              y="0"
              width={gesamtBreite}
              height={H_KOPF_ZEITLEISTE - 16}
              className="fill-slate-100 dark:fill-[#162952]"
            />

            {/* 3-Stunden-Wettersymbole & Uhrzeiten */}
            {stunden.map((stunde, idx) => {
              const x = xVonIndex(idx);
              const uhrStunde = holeStundeBerlin(stunde.zeitpunkt);
              const istDreiStundenRaster = uhrStunde % 3 === 0;

              return (
                <g key={`head-${stunde.zeitpunkt}`}>
                  {/* Stündlicher Teilstrich unten an der Stundenleiste */}
                  <line
                    x1={x}
                    x2={x}
                    y1={istDreiStundenRaster ? 58 : 62}
                    y2={66}
                    className="stroke-slate-400 dark:stroke-slate-300"
                    strokeWidth={istDreiStundenRaster ? '1.5' : '1'}
                  />

                  {istDreiStundenRaster && idx !== sichererFokusIndex && (
                    <>
                      <foreignObject x={x - 12} y={8} width={24} height={24}>
                        <div className="flex items-center justify-center w-6 h-6">
                          <WetterSymbol iconCode={stunde.iconCode} groesse="w-5 h-5" />
                        </div>
                      </foreignObject>
                      <text
                        x={x}
                        y={51}
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-200 text-[11px] font-mono"
                      >
                        {formatUhrzeit(stunde.zeitpunkt)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Aktive Fokus-Stundenbox oben (wie "16:00" bzw. "15:00" in den Screenshots) */}
            {fokusStunde && (
              <g transform={`translate(${fokusX - 25}, 3)`}>
                <rect
                  x="0"
                  y="0"
                  width="50"
                  height="56"
                  rx="4"
                  className="fill-slate-900 dark:fill-[#070F1F] stroke-slate-700 dark:stroke-slate-600"
                  strokeWidth="1"
                />
                <foreignObject x="11" y="5" width="28" height="28">
                  <div className="flex items-center justify-center w-7 h-7">
                    <WetterSymbol iconCode={fokusStunde.iconCode} groesse="w-6 h-6" />
                  </div>
                </foreignObject>
                <text
                  x="25"
                  y="49"
                  textAnchor="middle"
                  className="fill-white text-[11px] font-mono font-bold"
                >
                  {formatUhrzeit(fokusStunde.zeitpunkt)}
                </text>
              </g>
            )}

            {/* "Prognose"-Hinweis rechts neben der Vergangenheit/Zukunft-Grenze */}
            {berechnung.prognoseTrennX !== null && (
              <text
                x={berechnung.prognoseTrennX + 8}
                y={78}
                className="fill-slate-600 dark:fill-slate-200 text-[11px] font-semibold"
              >
                Prognose →
              </text>
            )}

            {/* =====================================================================
                DURCHGEHENDE VERTIKALE TAGESTRENNLINIEN (00:00 UHR) & PROGNOSE-GRENZE
               ===================================================================== */}
            {berechnung.tagesTrennlinien.map((trenn, idx) => {
              if (idx === 0) return null;
              return (
                <g key={`day-sep-${trenn.datum}`}>
                  <line
                    x1={trenn.x}
                    x2={trenn.x}
                    y1={0}
                    y2={GESAMT_SVG_HOEHE}
                    className="stroke-blue-500/70 dark:stroke-sky-400/65"
                    strokeWidth="1.5"
                    strokeDasharray="6 3"
                  />
                  <rect
                    x={trenn.x + 4}
                    y={68}
                    width={76}
                    height={14}
                    rx="3"
                    className="fill-blue-600 dark:fill-[#2A58A8]"
                  />
                  <text
                    x={trenn.x + 42}
                    y={78}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-semibold"
                  >
                    {trenn.label}
                  </text>
                </g>
              );
            })}

            {berechnung.prognoseTrennX !== null && (
              <line
                x1={berechnung.prognoseTrennX}
                x2={berechnung.prognoseTrennX}
                y1={66}
                y2={GESAMT_SVG_HOEHE}
                className="stroke-amber-500/80 dark:stroke-amber-400/75"
                strokeWidth="1.5"
              />
            )}

            {/* =====================================================================
                BLOCK 1: TEMPERATUR & NIEDERSCHLAG + NIEDERSCHLAGSWAHRSCHEINLICHKEIT
               ===================================================================== */}
            <g transform={`translate(0, ${H_KOPF_ZEITLEISTE})`}>
              <line
                x1="0"
                x2={gesamtBreite}
                y1="22"
                y2="22"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {/* Horizontale 5°C-Gitterlinien (0°C durchgezogen, übrige gepunktet) */}
              {berechnung.tempTicks.map((t) => (
                <line
                  key={`grid-t1-${t}`}
                  x1="0"
                  x2={gesamtBreite}
                  y1={berechnung.yTemp(t)}
                  y2={berechnung.yTemp(t)}
                  className={
                    t === 0
                      ? 'stroke-slate-400 dark:stroke-slate-400/80'
                      : 'stroke-slate-200 dark:stroke-slate-700/80'
                  }
                  strokeDasharray={t === 0 ? undefined : '2 3'}
                  strokeWidth="1"
                />
              ))}

              {/* Stündliche blaue Niederschlagsbalken (mm/h) */}
              {stunden.map((s, idx) => {
                if (s.niederschlagMm <= 0) return null;
                const x = xVonIndex(idx) - (STUNDEN_BREITE - 4) / 2;
                // Skaliert nichtlinear bis ~15 mm/h ("extrem")
                const norm = Math.min(1, Math.sqrt(s.niederschlagMm / 12));
                const balkenH = Math.max(4, norm * (berechnung.tempPlotH * 0.85));
                const y = berechnung.tempRandOben + berechnung.tempPlotH - balkenH;
                return (
                  <rect
                    key={`rain-${s.zeitpunkt}`}
                    x={x}
                    y={y}
                    width={STUNDEN_BREITE - 4}
                    height={balkenH}
                    rx="1.5"
                    className="fill-sky-500/55 dark:fill-sky-400/55"
                  />
                );
              })}

              {/* Graues Modellstreuungs-Band */}
              {berechnung.streuungsBandPfad && (
                <path
                  d={berechnung.streuungsBandPfad}
                  className="fill-slate-400/20 dark:fill-slate-300/18"
                />
              )}

              {/* Limettengrüne Temperaturkurve */}
              <path
                d={berechnung.tempPfad}
                fill="none"
                className="stroke-lime-600 dark:stroke-[#9CE62A]"
                strokeWidth="2.4"
              />

              {/* Zeile Niederschlagswahrscheinlichkeit (%) direkt darunter */}
              <g transform={`translate(0, ${H_TEMP_CHART})`}>
                <rect
                  x="0"
                  y="0"
                  width={gesamtBreite}
                  height={H_REGEN_WAHRSCH}
                  className="fill-slate-100 dark:fill-[#0F1E3D]"
                />
                {stunden.map((s, idx) => {
                  if (holeStundeBerlin(s.zeitpunkt) % 3 !== 0) return null;
                  const proz = s.regenwahrscheinlichkeit ?? 0;
                  return (
                    <text
                      key={`pop-${s.zeitpunkt}`}
                      x={xVonIndex(idx)}
                      y="17"
                      textAnchor="middle"
                      className={`text-[11px] font-mono font-semibold ${
                        proz >= 30
                          ? 'fill-blue-600 dark:fill-sky-400'
                          : 'fill-slate-500 dark:fill-slate-400'
                      }`}
                    >
                      {proz}%
                    </text>
                  );
                })}
              </g>
            </g>

            {/* =====================================================================
                BLOCK 2: WIND & BÖEN IN KM/H + WINDRICHTUNGSPFEILE
               ===================================================================== */}
            <g
              transform={`translate(0, ${
                H_KOPF_ZEITLEISTE + H_TEMP_CHART + H_REGEN_WAHRSCH
              })`}
            >
              <line
                x1="0"
                x2={gesamtBreite}
                y1="22"
                y2="22"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {berechnung.windTicks.map((w, i) => (
                <line
                  key={`grid-w-${w}`}
                  x1="0"
                  x2={gesamtBreite}
                  y1={berechnung.yWind(w)}
                  y2={berechnung.yWind(w)}
                  className="stroke-slate-200 dark:stroke-slate-700/80"
                  strokeDasharray={i % 2 === 1 ? '2 3' : undefined}
                  strokeWidth="1"
                />
              ))}

              {/* Spitzenböen (Rot) & Mittelwind (Weiß / Dunkelgrau) */}
              <path
                d={berechnung.boeenPfad}
                fill="none"
                className="stroke-red-500 dark:stroke-[#EA4335]"
                strokeWidth="2.2"
              />
              <path
                d={berechnung.mittelwindPfad}
                fill="none"
                className="stroke-slate-800 dark:stroke-white"
                strokeWidth="2.2"
              />

              {/* Windrichtungspfeile alle 3 Stunden */}
              <g transform={`translate(0, ${H_WIND_CHART})`}>
                <rect
                  x="0"
                  y="0"
                  width={gesamtBreite}
                  height={H_WIND_PFEILE}
                  className="fill-slate-100 dark:fill-[#0F1E3D]"
                />
                {stunden.map((s, idx) => {
                  if (holeStundeBerlin(s.zeitpunkt) % 3 !== 0 || s.windrichtungGrad === null) {
                    return null;
                  }
                  const cx = xVonIndex(idx);
                  const rot = (s.windrichtungGrad + 180) % 360;
                  return (
                    <g
                      key={`wdir-${s.zeitpunkt}`}
                      transform={`translate(${cx}, 15) rotate(${rot})`}
                    >
                      <path
                        d="M 0 -7 L 5 6 L 0 3 L -5 6 Z"
                        className="fill-slate-500 dark:fill-slate-400"
                      />
                    </g>
                  );
                })}
              </g>
            </g>

            {/* =====================================================================
                BLOCK 3: TAUPUNKT & TEMPERATUR & FEUCHTE (BLAUE SÄULEN + KURVEN)
               ===================================================================== */}
            <g
              transform={`translate(0, ${
                H_KOPF_ZEITLEISTE +
                H_TEMP_CHART +
                H_REGEN_WAHRSCH +
                H_WIND_CHART +
                H_WIND_PFEILE
              })`}
            >
              <line
                x1="0"
                x2={gesamtBreite}
                y1="22"
                y2="22"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {/* Stündliche blaue Luftfeuchte-Säulen (aktive Stunde weiß umrahmt wie in Screenshot 2) */}
              {stunden.map((s, idx) => {
                const feuchte = s.luftfeuchtigkeit ?? 0;
                const x = xVonIndex(idx) - STUNDEN_BREITE / 2 + 0.5;
                const y = berechnung.yFeuchteProzent(feuchte);
                const h = berechnung.feuchteRandOben + berechnung.feuchtePlotH - y;
                const istAktiv = idx === sichererFokusIndex;
                return (
                  <rect
                    key={`rh-bar-${s.zeitpunkt}`}
                    x={x}
                    y={y}
                    width={STUNDEN_BREITE - 1}
                    height={Math.max(1, h)}
                    className={
                      istAktiv
                        ? 'fill-blue-400/75 dark:fill-[#4B79C9] stroke-slate-900 dark:stroke-white'
                        : 'fill-blue-300/60 dark:fill-[#4B79C9]/85'
                    }
                    strokeWidth={istAktiv ? '1.5' : '0'}
                  />
                );
              })}

              {/* Horizontale Gitterlinien darüber */}
              {berechnung.tempTicks.map((t) => (
                <line
                  key={`grid-t3-${t}`}
                  x1="0"
                  x2={gesamtBreite}
                  y1={berechnung.yTempFeuchte(t)}
                  y2={berechnung.yTempFeuchte(t)}
                  className="stroke-slate-500/25 dark:stroke-slate-950/35"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
              ))}

              {/* Weiße Taupunktkurve & Limettengrüne Temperaturkurve */}
              <path
                d={berechnung.taupunktPfad}
                fill="none"
                className="stroke-slate-900 dark:stroke-white"
                strokeWidth="2.2"
              />
              <path
                d={berechnung.tempFeuchtePfad}
                fill="none"
                className="stroke-lime-600 dark:stroke-[#9CE62A]"
                strokeWidth="2.4"
              />
            </g>

            {/* =====================================================================
                BLOCK 4: LUFTDRUCK IN HPA
               ===================================================================== */}
            <g transform={`translate(0, ${Y_BLOCK_DRUCK})`}>
              <line
                x1="0"
                x2={gesamtBreite}
                y1="20"
                y2="20"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {berechnung.druckTicks.map((p) => (
                <line
                  key={`grid-p-${p}`}
                  x1="0"
                  x2={gesamtBreite}
                  y1={berechnung.yDruck(p)}
                  y2={berechnung.yDruck(p)}
                  className="stroke-slate-200 dark:stroke-slate-700/80"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
              ))}

              <path
                d={berechnung.druckPfad}
                fill="none"
                className="stroke-red-600 dark:stroke-[#EA4335]"
                strokeWidth="2.2"
              />
            </g>

            {/* =====================================================================
                BLOCK 5: BEWÖLKUNG IN %
               ===================================================================== */}
            <g transform={`translate(0, ${Y_BLOCK_WOLKEN})`}>
              <line
                x1="0"
                x2={gesamtBreite}
                y1="20"
                y2="20"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {[100, 75, 50, 25, 0].map((proz) => (
                <line
                  key={`grid-cl-${proz}`}
                  x1="0"
                  x2={gesamtBreite}
                  y1={berechnung.yWolkenProzent(proz)}
                  y2={berechnung.yWolkenProzent(proz)}
                  className="stroke-slate-200 dark:stroke-slate-700/80"
                  strokeDasharray={proz === 0 ? undefined : '2 3'}
                  strokeWidth="1"
                />
              ))}

              {berechnung.wolkenFlaechePfad && (
                <path
                  d={berechnung.wolkenFlaechePfad}
                  className="fill-slate-400/28 dark:fill-slate-400/22"
                />
              )}

              {berechnung.wolkenPfad && (
                <path
                  d={berechnung.wolkenPfad}
                  fill="none"
                  className="stroke-slate-600 dark:stroke-slate-200"
                  strokeWidth="2"
                />
              )}
            </g>

            {/* =====================================================================
                BLOCK 6: SONNE & MOND (AUF-/UNTERGANG + BAHNEN)
               ===================================================================== */}
            <g transform={`translate(0, ${Y_BLOCK_ASTRO})`}>
              <line
                x1="0"
                x2={gesamtBreite}
                y1="22"
                y2="22"
                className="stroke-slate-200 dark:stroke-slate-700/70"
              />

              {/* Tageslicht-Schimmer zwischen Sonnenaufgang und Sonnenuntergang jedes Tages */}
              {berechnung.tagesAstroMarken.map((m) => {
                if (m.aufgangX === null || m.untergangX === null || m.untergangX <= m.aufgangX) {
                  return null;
                }
                return (
                  <rect
                    key={`daylight-${m.datum}`}
                    x={m.aufgangX}
                    y="23"
                    width={m.untergangX - m.aufgangX}
                    height={H_ASTRO_CHART - 24}
                    className="fill-sky-200/35 dark:fill-blue-500/18"
                  />
                );
              })}

              {/* Horizontlinie */}
              <line
                x1="0"
                x2={gesamtBreite}
                y1={berechnung.horizontY}
                y2={berechnung.horizontY}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth="1.2"
              />

              {/* Mondbahn (Weiß/Grau) & Sonnenbahn (Orange) */}
              <path
                d={berechnung.mondPfad}
                fill="none"
                className="stroke-slate-500 dark:stroke-slate-200"
                strokeWidth="2"
              />
              <path
                d={berechnung.sonnenPfad}
                fill="none"
                className="stroke-amber-500 dark:stroke-[#F59E0B]"
                strokeWidth="2.2"
              />

              {/* Auf- & Untergangs-Uhrzeiten für Sonne (oben) und Mond (unten) je Tag */}
              {berechnung.tagesAstroMarken.map((m) => (
                <g key={`astro-lbl-${m.datum}`}>
                  {m.aufgangX !== null && m.aufgangText && (
                    <g>
                      <line
                        x1={m.aufgangX}
                        x2={m.aufgangX}
                        y1={42}
                        y2={berechnung.horizontY}
                        className="stroke-amber-500/80"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={m.aufgangX}
                        cy={berechnung.horizontY}
                        r="3"
                        className="fill-amber-500"
                      />
                      <text
                        x={m.aufgangX}
                        y={38}
                        textAnchor="middle"
                        className="fill-amber-700 dark:fill-amber-300 text-[10px] font-mono font-semibold"
                      >
                        ↑ {m.aufgangText}
                      </text>
                    </g>
                  )}

                  {m.untergangX !== null && m.untergangText && (
                    <g>
                      <line
                        x1={m.untergangX}
                        x2={m.untergangX}
                        y1={42}
                        y2={berechnung.horizontY}
                        className="stroke-amber-500/80"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={m.untergangX}
                        cy={berechnung.horizontY}
                        r="3"
                        className="fill-amber-500"
                      />
                      <text
                        x={m.untergangX}
                        y={38}
                        textAnchor="middle"
                        className="fill-amber-700 dark:fill-amber-300 text-[10px] font-mono font-semibold"
                      >
                        ↓ {m.untergangText}
                      </text>
                    </g>
                  )}

                  {m.mondAufX !== null && m.mondAufText && (
                    <g>
                      <line
                        x1={m.mondAufX}
                        x2={m.mondAufX}
                        y1={berechnung.horizontY}
                        y2={H_ASTRO_CHART - 20}
                        className="stroke-slate-400/70"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={m.mondAufX}
                        cy={berechnung.horizontY}
                        r="2.5"
                        className="fill-slate-400 dark:fill-slate-200"
                      />
                      <text
                        x={m.mondAufX}
                        y={H_ASTRO_CHART - 8}
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-300 text-[10px] font-mono"
                      >
                        ☾↑ {m.mondAufText}
                      </text>
                    </g>
                  )}

                  {m.mondUnterX !== null && m.mondUnterText && (
                    <g>
                      <line
                        x1={m.mondUnterX}
                        x2={m.mondUnterX}
                        y1={berechnung.horizontY}
                        y2={H_ASTRO_CHART - 20}
                        className="stroke-slate-400/70"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={m.mondUnterX}
                        cy={berechnung.horizontY}
                        r="2.5"
                        className="fill-slate-400 dark:fill-slate-200"
                      />
                      <text
                        x={m.mondUnterX}
                        y={H_ASTRO_CHART - 8}
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-300 text-[10px] font-mono"
                      >
                        ☾↓ {m.mondUnterText}
                      </text>
                    </g>
                  )}
                </g>
              ))}

              {/* Sonnen- und Mondscheibe auf der gewählten Fadenkreuz-Stunde */}
              {berechnung.mondPunkte[sichererFokusIndex] && (
                <circle
                  cx={fokusX}
                  cy={berechnung.mondPunkte[sichererFokusIndex].y}
                  r="6"
                  className="fill-slate-200 stroke-slate-600 dark:fill-slate-100 dark:stroke-slate-800"
                  strokeWidth="1.5"
                />
              )}
              {berechnung.sonnenPunkte[sichererFokusIndex] && (
                <circle
                  cx={fokusX}
                  cy={berechnung.sonnenPunkte[sichererFokusIndex].y}
                  r="6.5"
                  className="fill-amber-400 stroke-amber-600 dark:stroke-amber-200"
                  strokeWidth="2"
                />
              )}
            </g>

            {/* =====================================================================
                DURCHGEHENDES VERTIKALES FADENKREUZ + SCHWEBENDE WERT-POPOVER
               ===================================================================== */}
            <line
              x1={fokusX}
              x2={fokusX}
              y1={59}
              y2={GESAMT_SVG_HOEHE}
              className="stroke-slate-500/70 dark:stroke-slate-300/45"
              strokeWidth="1"
            />

            {fokusStunde && (
              <>
                {/* Popover 1: Temperatur & Niederschlag */}
                {fokusStunde.temperatur !== null && (
                  <g transform={`translate(0, ${Y_BLOCK_TEMP})`}>
                    <circle
                      cx={fokusX}
                      cy={berechnung.yTemp(fokusStunde.temperatur)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                    <g transform={`translate(${klemmePopoverX(182) - 91}, 26)`}>
                      <rect
                        x="0"
                        y="0"
                        width="182"
                        height="44"
                        rx="5"
                        className="fill-slate-900/95 dark:fill-[#070F1F]/95 stroke-slate-700"
                        strokeWidth="1"
                      />
                      <text x="10" y="16" className="fill-slate-400 text-[10px] font-semibold">
                        Temperatur
                      </text>
                      <text
                        x="10"
                        y="35"
                        className="fill-white text-[14px] font-mono font-semibold"
                      >
                        {fokusStunde.temperatur.toFixed(1).replace('.', ',')} °C
                      </text>
                      <text x="96" y="16" className="fill-slate-400 text-[10px] font-semibold">
                        Niederschlag
                      </text>
                      <text
                        x="96"
                        y="35"
                        className="fill-white text-[14px] font-mono font-semibold"
                      >
                        {fokusStunde.niederschlagMm.toFixed(1).replace('.', ',')} mm/h
                      </text>
                    </g>
                  </g>
                )}

                {/* Popover 2: Wind, Böen & Richtung */}
                <g transform={`translate(0, ${Y_BLOCK_WIND})`}>
                  {fokusStunde.windboeenKmh !== null && (
                    <circle
                      cx={fokusX}
                      cy={berechnung.yWind(fokusStunde.windboeenKmh)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                  )}
                  {fokusStunde.windgeschwindigkeitKmh !== null && (
                    <circle
                      cx={fokusX}
                      cy={berechnung.yWind(fokusStunde.windgeschwindigkeitKmh)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                  )}
                  <g transform={`translate(${klemmePopoverX(226) - 113}, 26)`}>
                    <rect
                      x="0"
                      y="0"
                      width="226"
                      height="44"
                      rx="5"
                      className="fill-slate-900/95 dark:fill-[#070F1F]/95 stroke-slate-700"
                      strokeWidth="1"
                    />
                    <text x="10" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Wind
                    </text>
                    <text
                      x="10"
                      y="35"
                      className="fill-white text-[13px] font-mono font-semibold"
                    >
                      {fokusStunde.windgeschwindigkeitKmh !== null
                        ? `${Math.round(fokusStunde.windgeschwindigkeitKmh)} km/h`
                        : '–'}
                    </text>
                    <text x="74" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Böen
                    </text>
                    <text
                      x="74"
                      y="35"
                      className="fill-white text-[13px] font-mono font-semibold"
                    >
                      {fokusStunde.windboeenKmh !== null
                        ? `${Math.round(fokusStunde.windboeenKmh)} km/h`
                        : '–'}
                    </text>
                    <text x="142" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Richtung
                    </text>
                    <text x="142" y="35" className="fill-white text-[13px] font-semibold">
                      {fokusStunde.windrichtungLang}
                    </text>
                  </g>
                </g>

                {/* Popover 3: Taupunkt, Temperatur & Feuchte */}
                <g transform={`translate(0, ${Y_BLOCK_FEUCHTE})`}>
                  {fokusStunde.temperatur !== null && (
                    <circle
                      cx={fokusX}
                      cy={berechnung.yTempFeuchte(fokusStunde.temperatur)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                  )}
                  {fokusStunde.taupunkt !== null && (
                    <circle
                      cx={fokusX}
                      cy={berechnung.yTempFeuchte(fokusStunde.taupunkt)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                  )}
                  <g transform={`translate(${klemmePopoverX(224) - 112}, 26)`}>
                    <rect
                      x="0"
                      y="0"
                      width="224"
                      height="44"
                      rx="5"
                      className="fill-slate-900/95 dark:fill-[#070F1F]/95 stroke-slate-700"
                      strokeWidth="1"
                    />
                    <text x="10" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Taupunkt
                    </text>
                    <text
                      x="10"
                      y="35"
                      className="fill-white text-[13px] font-mono font-semibold"
                    >
                      {fokusStunde.taupunkt !== null
                        ? `${fokusStunde.taupunkt.toFixed(1).replace('.', ',')} °C`
                        : '–'}
                    </text>
                    <text x="82" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Temperatur
                    </text>
                    <text
                      x="82"
                      y="35"
                      className="fill-white text-[13px] font-mono font-semibold"
                    >
                      {fokusStunde.temperatur !== null
                        ? `${fokusStunde.temperatur.toFixed(1).replace('.', ',')} °C`
                        : '–'}
                    </text>
                    <text x="164" y="16" className="fill-slate-400 text-[10px] font-semibold">
                      Feuchte
                    </text>
                    <text
                      x="164"
                      y="35"
                      className="fill-white text-[13px] font-mono font-semibold"
                    >
                      {fokusStunde.luftfeuchtigkeit !== null
                        ? `${fokusStunde.luftfeuchtigkeit} %`
                        : '–'}
                    </text>
                  </g>
                </g>

                {/* Popover 4: Luftdruck in hPa */}
                {fokusStunde.luftdruckHpa !== null && (
                  <g transform={`translate(0, ${Y_BLOCK_DRUCK})`}>
                    <circle
                      cx={fokusX}
                      cy={berechnung.yDruck(fokusStunde.luftdruckHpa)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                    <g transform={`translate(${klemmePopoverX(104) - 52}, 22)`}>
                      <rect
                        x="0"
                        y="0"
                        width="104"
                        height="42"
                        rx="5"
                        className="fill-slate-900/95 dark:fill-[#070F1F]/95 stroke-slate-700"
                        strokeWidth="1"
                      />
                      <text x="10" y="15" className="fill-slate-400 text-[10px] font-semibold">
                        Luftdruck
                      </text>
                      <text
                        x="10"
                        y="33"
                        className="fill-white text-[13px] font-mono font-semibold"
                      >
                        {Math.round(fokusStunde.luftdruckHpa)} hPa
                      </text>
                    </g>
                  </g>
                )}

                {/* Popover 5: Bewölkung in % */}
                {fokusStunde.bewoelkungProzent !== null && (
                  <g transform={`translate(0, ${Y_BLOCK_WOLKEN})`}>
                    <circle
                      cx={fokusX}
                      cy={berechnung.yWolkenProzent(fokusStunde.bewoelkungProzent)}
                      r="4.5"
                      className="fill-slate-900 dark:fill-[#162952] stroke-white"
                      strokeWidth="2"
                    />
                    <g transform={`translate(${klemmePopoverX(104) - 52}, 22)`}>
                      <rect
                        x="0"
                        y="0"
                        width="104"
                        height="42"
                        rx="5"
                        className="fill-slate-900/95 dark:fill-[#070F1F]/95 stroke-slate-700"
                        strokeWidth="1"
                      />
                      <text x="10" y="15" className="fill-slate-400 text-[10px] font-semibold">
                        Bewölkung
                      </text>
                      <text
                        x="10"
                        y="33"
                        className="fill-white text-[13px] font-mono font-semibold"
                      >
                        {Math.round(fokusStunde.bewoelkungProzent)} %
                      </text>
                    </g>
                  </g>
                )}
              </>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
}
