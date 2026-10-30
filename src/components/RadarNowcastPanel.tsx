import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { CloudRain, Droplets } from 'lucide-react';
import type { RadarNowcastPunkt } from '../shared/wetterTypen.ts';

interface RadarNowcastPanelProps {
  punkte: RadarNowcastPunkt[];
}

function formatiereUhrzeit(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function holeBalkenFarbe(intensitaetMmH: number, istPrognose: boolean): string {
  if (intensitaetMmH >= 10) {
    return 'fill-purple-600 dark:fill-purple-400';
  }
  if (intensitaetMmH >= 2.5) {
    return 'fill-blue-600 dark:fill-blue-400';
  }
  if (intensitaetMmH > 0) {
    return istPrognose
      ? 'fill-sky-500 dark:fill-sky-400'
      : 'fill-teal-500 dark:fill-teal-400';
  }
  return 'fill-slate-200 dark:fill-slate-800';
}

/**
 * Punktgenaue 2-Stunden-Regenradar-Vorhersage im 5-Minuten-Takt (DWD RV 1x1 km Komposit).
 */
export function RadarNowcastPanel({ punkte }: RadarNowcastPanelProps) {
  const [fokusIndex, setFokusIndex] = useState<number | null>(null);

  const analyse = useMemo(() => {
    if (punkte.length === 0) return null;

    let jetztIndex = 0;
    for (let i = 0; i < punkte.length; i++) {
      if (!punkte[i]?.istPrognose) {
        jetztIndex = i;
      }
    }

    const prognosePunkte = punkte.filter((p) => p.istPrognose);
    const maxIntensitaet = Math.max(2, ...punkte.map((p) => p.intensitaetMmProStunde));
    const summe2hMm =
      Math.round(
        prognosePunkte.reduce((summe, p) => summe + p.niederschlag5MinMm, 0) * 10
      ) / 10;

    const regnetJetzt = (punkte[jetztIndex]?.niederschlag5MinMm ?? 0) > 0.01;
    const ersterRegenIdx = prognosePunkte.findIndex((p) => p.niederschlag5MinMm > 0.01);
    const erstesTrockenIdx = prognosePunkte.findIndex((p) => p.niederschlag5MinMm <= 0.01);

    let zusammenfassung = 'Kein Niederschlag in den nächsten 120 Minuten erwartet';
    if (regnetJetzt) {
      if (erstesTrockenIdx > 0) {
        zusammenfassung = `Aktuell Niederschlag · lässt in ca. ${erstesTrockenIdx * 5} Min. nach`;
      } else {
        zusammenfassung = 'Anhaltender Niederschlag in den nächsten 120 Minuten';
      }
    } else if (ersterRegenIdx >= 0) {
      const inMinuten = (ersterRegenIdx + 1) * 5;
      zusammenfassung = `Niederschlag setzt in ca. ${inMinuten} Min. ein (${formatiereUhrzeit(
        prognosePunkte[ersterRegenIdx]?.zeitpunkt ?? ''
      )} Uhr)`;
    }

    return {
      jetztIndex,
      maxIntensitaet,
      summe2hMm,
      hatNiederschlag: punkte.some((p) => p.niederschlag5MinMm > 0.01),
      zusammenfassung,
    };
  }, [punkte]);

  if (!analyse || punkte.length === 0) {
    return (
      <section
        aria-label="Regenradar-Kurzfristvorhersage"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4"
      >
        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Droplets className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            2-Stunden-Regenradar-Vorhersage (DWD RV 1×1 km) ist nur für Standorte innerhalb des
            deutschen Radarkomposits verfügbar.
          </span>
        </div>
      </section>
    );
  }

  const breite = 560;
  const hoehe = 96;
  const randLinks = 8;
  const randRechts = 8;
  const randOben = 14;
  const randUnten = 22;
  const plotBreite = breite - randLinks - randRechts;
  const plotHoehe = hoehe - randOben - randUnten;

  const aktiverIdx = fokusIndex !== null ? Math.min(fokusIndex, punkte.length - 1) : analyse.jetztIndex;
  const aktiverPunkt = punkte[aktiverIdx] ?? punkte[0];

  const beiMausBewegung = (ereignis: MouseEvent<SVGSVGElement>) => {
    const rect = ereignis.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((ereignis.clientX - rect.left) / rect.width) * breite;
    const norm = Math.max(0, Math.min(1, (relX - randLinks) / plotBreite));
    setFokusIndex(Math.round(norm * (punkte.length - 1)));
  };

  const schrittBreite = plotBreite / punkte.length;
  const balkenBreite = Math.max(3, schrittBreite - 2.5);
  const jetztX = randLinks + (analyse.jetztIndex + 0.5) * schrittBreite;

  return (
    <section
      aria-label="2-Stunden-Regenradar-Vorhersage am Standort"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <CloudRain
            className={`w-5 h-5 mt-0.5 shrink-0 ${
              analyse.hatNiederschlag
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Regenradar-Vorhersage · Nächste 2 Stunden (5-Min.-Takt)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {analyse.zusammenfassung}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          2h-Summe: {analyse.summe2hMm.toFixed(1).replace('.', ',')} mm
        </div>
      </div>

      {/* Einzelwert-Ablesezeile für den gewählten 5-Minuten-Schritt */}
      {aktiverPunkt && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatiereUhrzeit(aktiverPunkt.zeitpunkt)} Uhr
            </span>
            <span aria-hidden="true" className="text-slate-400"> · </span>
            <span
              className={
                aktiverPunkt.istPrognose
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {aktiverPunkt.istPrognose ? 'DWD-Radarvorhersage' : 'Radarmessung'}
            </span>
          </div>
          <div className="text-slate-700 dark:text-slate-300">
            Intensität:{' '}
            <strong className="text-slate-900 dark:text-white">
              {aktiverPunkt.intensitaetMmProStunde.toFixed(1).replace('.', ',')} mm/h
            </strong>
            <span aria-hidden="true" className="text-slate-400"> · </span>
            <span>{aktiverPunkt.niederschlag5MinMm.toFixed(2).replace('.', ',')} mm/5m</span>
          </div>
        </div>
      )}

      {/* 5-Minuten-Säulenverlauf */}
      <div className="mt-2.5">
        <svg
          viewBox={`0 0 ${breite} ${hoehe}`}
          onMouseMove={beiMausBewegung}
          onMouseLeave={() => setFokusIndex(null)}
          className="w-full h-24 select-none cursor-crosshair"
          role="img"
          aria-label="5-Minuten-Niederschlagsverlauf von Messung bis +120 Minuten Vorhersage"
        >
          {/* Grundlinie */}
          <line
            x1={randLinks}
            x2={breite - randRechts}
            y1={randOben + plotHoehe}
            y2={randOben + plotHoehe}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />

          {/* 5-Minuten-Balken */}
          {punkte.map((p, idx) => {
            const x = randLinks + idx * schrittBreite + (schrittBreite - balkenBreite) / 2;
            const hatRegen = p.intensitaetMmProStunde > 0;
            const balkenHoehe = hatRegen
              ? Math.max(6, (p.intensitaetMmProStunde / analyse.maxIntensitaet) * plotHoehe)
              : 3;
            const y = randOben + plotHoehe - balkenHoehe;
            const istFokus = idx === aktiverIdx;

            return (
              <rect
                key={p.zeitpunkt}
                x={x}
                y={y}
                width={balkenBreite}
                height={balkenHoehe}
                rx="1.5"
                className={`${holeBalkenFarbe(p.intensitaetMmProStunde, p.istPrognose)} ${
                  istFokus ? 'opacity-100' : 'opacity-85'
                }`}
              />
            );
          })}

          {/* Trennlinie "Jetzt" zwischen Radarmessung und 2h-Vorhersage */}
          <line
            x1={jetztX}
            x2={jetztX}
            y1={4}
            y2={randOben + plotHoehe + 3}
            className="stroke-amber-500 dark:stroke-amber-400"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <text
            x={jetztX + 4}
            y={11}
            className="fill-amber-600 dark:fill-amber-400 text-[9px] font-mono font-semibold"
          >
            Jetzt → +2h Vorhersage
          </text>

          {/* Zeitmarken unten */}
          {[0, analyse.jetztIndex, Math.floor((analyse.jetztIndex + punkte.length - 1) / 2), punkte.length - 1]
            .filter((wert, index, arr) => arr.indexOf(wert) === index && punkte[wert])
            .map((idx) => {
              const x = Math.min(
                breite - 24,
                Math.max(24, randLinks + (idx + 0.5) * schrittBreite)
              );
              return (
                <text
                  key={idx}
                  x={x}
                  y={hoehe - 5}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {formatiereUhrzeit(punkte[idx]?.zeitpunkt ?? '')}
                </text>
              );
            })}
        </svg>
      </div>
    </section>
  );
}
