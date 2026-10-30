import type { AktuellesWetter, TagesVorhersagePunkt } from '../shared/wetterTypen.ts';
import { WetterSymbol } from './WetterSymbol.tsx';

interface MesswertePanelProps {
  aktuell: AktuellesWetter;
  heute: TagesVorhersagePunkt | undefined;
}

function formatZahl(wert: number | null | undefined, nachkomma: number = 1): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '–';
  return wert.toFixed(nachkomma).replace('.', ',');
}

/**
 * Stellt die aktuellen SYNOP-Messwerte der nächstgelegenen DWD-Wetterstation dar.
 * Getrennt durch feine 1px-Linien statt verschachtelter Einzelkarten.
 */
export function MesswertePanel({ aktuell, heute }: MesswertePanelProps) {
  return (
    <section
      aria-label="Aktuelle Messwerte"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
    >
      {/* Dominanter Hauptanker: Temperatur & Wetterzustand */}
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <WetterSymbol iconCode={aktuell.iconCode} groesse="w-12 h-12" />
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
                {formatZahl(aktuell.temperatur, 1)}
              </span>
              <span className="text-lg font-mono text-slate-500 dark:text-slate-400">°C</span>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">
              {aktuell.zustandText}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-col sm:items-end gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {heute && (
            <div className="font-mono tabular-nums">
              <span>Tagesspanne: </span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {formatZahl(heute.temperaturMin, 1)} °C
              </span>
              <span> bis </span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {formatZahl(heute.temperaturMax, 1)} °C
              </span>
            </div>
          )}
          <div className="font-mono tabular-nums">
            <span>Taupunkt: {formatZahl(aktuell.taupunkt, 1)} °C</span>
            <span aria-hidden="true"> · </span>
            <span>Niederschlag (1h): {formatZahl(aktuell.niederschlagLetzteStundeMm, 1)} mm</span>
          </div>
        </div>
      </div>

      {/* Präzisions-Messgitter mit 1px-Haarlinien */}
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Wind &amp; Richtung</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.windgeschwindigkeitKmh, 0)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              km/h · {aktuell.windrichtungKompass}
            </span>
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Böen bis {formatZahl(aktuell.windboeenKmh, 0)} km/h
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Luftdruck (MSL)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.luftdruckHpa, 1)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">hPa</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Reduziert auf Meereshöhe
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Rel. Luftfeuchte</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.luftfeuchtigkeit, 0)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">%</span>
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Taupunkt {formatZahl(aktuell.taupunkt, 1)} °C
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Niederschlag (60 Min.)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.niederschlagLetzteStundeMm, 1)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">mm</span>
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Tagessumme {heute ? `${formatZahl(heute.niederschlagSummeMm, 1)} mm` : '–'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Sichtweite</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.sichtweiteKm, 1)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">km</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Horizontale Bodensicht
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Bewölkung &amp; Sonne</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatZahl(aktuell.bewoelkungProzent, 0)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">%</span>
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Sonne (1h): {aktuell.sonnenscheinMinuten !== null ? `${aktuell.sonnenscheinMinuten} Min.` : '–'}
          </div>
        </div>
      </div>
    </section>
  );
}
