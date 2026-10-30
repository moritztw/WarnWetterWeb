import { ChevronRight } from 'lucide-react';
import type { TagesVorhersagePunkt } from '../shared/wetterTypen.ts';
import { WetterSymbol } from './WetterSymbol.tsx';

interface SiebenTageTrendProps {
  tage: TagesVorhersagePunkt[];
  aktiverTagDatum?: string;
  aufTagAuswaehlen?: (datum: string) => void;
}

function formatDatumKurz(isoDatum: string): string {
  const teile = isoDatum.split('-');
  if (teile.length !== 3) return isoDatum;
  return `${teile[2]}.${teile[1]}.`;
}

/**
 * Tabellarischer 7-Tage-Trend mit SVG-Temperaturspannen-Balken und Direktklick in die Stundenvorhersage.
 */
export function SiebenTageTrend({
  tage,
  aktiverTagDatum,
  aufTagAuswaehlen,
}: SiebenTageTrendProps) {
  if (tage.length === 0) return null;

  const wochenMin = Math.min(...tage.map((t) => t.temperaturMin));
  const wochenMax = Math.max(...tage.map((t) => t.temperaturMax));
  const gesamtSpanne = Math.max(1, wochenMax - wochenMin);

  return (
    <section
      id="sieben-tage"
      aria-label="7-Tage-Wettertrend"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
    >
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            7-Tage-Vorhersage
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Klicke auf einen Wochentag, um dessen detaillierte Stundenvorhersage oben zu öffnen
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {tage.map((tag) => {
          const startX = ((tag.temperaturMin - wochenMin) / gesamtSpanne) * 108 + 6;
          const endeX = ((tag.temperaturMax - wochenMin) / gesamtSpanne) * 108 + 6;
          const balkenBreite = Math.max(8, endeX - startX);
          const istAktiv = aktiverTagDatum === tag.datum;

          return (
            <button
              key={tag.datum}
              type="button"
              onClick={() => aufTagAuswaehlen?.(tag.datum)}
              className={`w-full text-left px-5 sm:px-6 py-3.5 grid grid-cols-12 items-center gap-3 transition-colors cursor-pointer ${
                istAktiv
                  ? 'bg-blue-50/70 dark:bg-blue-950/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              {/* Wochentag & Datum */}
              <div className="col-span-4 sm:col-span-2 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {tag.wochentagKurz}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatDatumKurz(tag.datum)}
                </span>
              </div>

              {/* Wettersymbol & Text */}
              <div className="col-span-8 sm:col-span-3 flex items-center gap-2.5 min-w-0">
                <WetterSymbol iconCode={tag.iconCode} groesse="w-5 h-5" />
                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 truncate">
                  {tag.zustandText}
                </span>
              </div>

              {/* Niederschlag & Windböen */}
              <div className="col-span-6 sm:col-span-3 flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <span title="Tagesniederschlagssumme">
                  {tag.niederschlagSummeMm.toFixed(1).replace('.', ',')} mm
                </span>
                <span aria-hidden="true">·</span>
                <span title="Maximale Windböen">
                  {tag.maxWindboeenKmh !== null ? `${tag.maxWindboeenKmh} km/h` : '–'}
                </span>
              </div>

              {/* Temperaturspanne (Min — SVG-Balken — Max) */}
              <div className="col-span-6 sm:col-span-4 flex items-center justify-end gap-2 font-mono tabular-nums">
                <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                  {tag.temperaturMin.toFixed(0)}°
                </span>
                <svg
                  viewBox="0 0 120 10"
                  className="w-20 sm:w-28 h-2.5 shrink-0"
                  aria-hidden="true"
                >
                  <rect
                    x="0"
                    y="2"
                    width="120"
                    height="6"
                    rx="3"
                    className="fill-slate-200 dark:fill-slate-800"
                  />
                  <rect
                    x={startX}
                    y="2"
                    width={balkenBreite}
                    height="6"
                    rx="3"
                    className="fill-blue-500 dark:fill-amber-400"
                  />
                </svg>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 w-12 text-left">
                  {tag.temperaturMax.toFixed(0)} °C
                </span>
                <ChevronRight
                  className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 hidden sm:block"
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
