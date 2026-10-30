import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { AmtlicheWarnung, DwdWarnstufe } from '../shared/wetterTypen.ts';

interface WarnungsBereichProps {
  warnungen: AmtlicheWarnung[];
  warnzelleName: string | null;
}

function holeStufenStil(warnstufe: DwdWarnstufe, istVorabinfo: boolean): {
  rahmen: string;
  kopfText: string;
  iconFarbe: string;
} {
  if (istVorabinfo) {
    return {
      rahmen:
        'border-rose-300 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/25',
      kopfText: 'text-rose-800 dark:text-rose-300',
      iconFarbe: 'text-rose-600 dark:text-rose-400',
    };
  }
  switch (warnstufe) {
    case 4:
      return {
        rahmen:
          'border-purple-400 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-950/35',
        kopfText: 'text-purple-900 dark:text-purple-200',
        iconFarbe: 'text-purple-700 dark:text-purple-300',
      };
    case 3:
      return {
        rahmen: 'border-red-400 dark:border-red-700 bg-red-50/80 dark:bg-red-950/35',
        kopfText: 'text-red-900 dark:text-red-200',
        iconFarbe: 'text-red-600 dark:text-red-400',
      };
    case 2:
      return {
        rahmen:
          'border-orange-300 dark:border-orange-700/80 bg-orange-50/80 dark:bg-orange-950/30',
        kopfText: 'text-orange-900 dark:text-orange-200',
        iconFarbe: 'text-orange-600 dark:text-orange-400',
      };
    default:
      return {
        rahmen:
          'border-amber-300 dark:border-amber-700/70 bg-amber-50/75 dark:bg-amber-950/25',
        kopfText: 'text-amber-900 dark:text-amber-200',
        iconFarbe: 'text-amber-600 dark:text-amber-400',
      };
  }
}

function formatiereWarnZeitraum(abIso: string, bisIso: string | null): string {
  const fmt = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const abDatum = new Date(abIso);
  const abText = Number.isFinite(abDatum.getTime()) ? fmt.format(abDatum) : abIso;
  if (!bisIso) return `Ab ${abText} Uhr`;
  const bisDatum = new Date(bisIso);
  const bisText = Number.isFinite(bisDatum.getTime()) ? fmt.format(bisDatum) : bisIso;
  return `${abText} – ${bisText} Uhr`;
}

/**
 * Stellt aktive amtliche DWD-Warnungen gemäß 4-Stufen-Farbsystem inklusive Verhaltenshinweisen dar.
 */
export function WarnungsBereich({ warnungen, warnzelleName }: WarnungsBereichProps) {
  const [offeneHinweise, setOffeneHinweise] = useState<Record<string, boolean>>({});

  const hinweisUmschalten = (id: string) => {
    setOffeneHinweise((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (warnungen.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Keine amtlichen Warnungen aktiv
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {warnzelleName
                ? `Für das Warngebiet ${warnzelleName} liegen derzeit keine DWD-Warnmeldungen vor.`
                : 'Derzeit liegen für diesen Standort keine DWD-Warnmeldungen vor.'}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
          Warnstufe 0
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label="Amtliche Wetterwarnungen">
      {warnungen.map((warnung) => {
        const stil = holeStufenStil(warnung.warnstufe, warnung.istVorabinformation);
        const istOffen = Boolean(offeneHinweise[warnung.id]);

        return (
          <article
            key={warnung.id}
            className={`rounded-xl border p-4 transition-colors ${stil.rahmen}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex items-start gap-2.5">
                {warnung.istVorabinformation ? (
                  <Info className={`w-5 h-5 mt-0.5 shrink-0 ${stil.iconFarbe}`} aria-hidden="true" />
                ) : (
                  <AlertTriangle
                    className={`w-5 h-5 mt-0.5 shrink-0 ${stil.iconFarbe}`}
                    aria-hidden="true"
                  />
                )}
                <div>
                  <div className={`text-xs font-semibold ${stil.kopfText}`}>
                    {warnung.stufenBezeichnung}
                    {warnzelleName ? ` · ${warnzelleName}` : ''}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                    {warnung.schlagzeile}
                  </h2>
                </div>
              </div>

              <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 sm:text-right whitespace-nowrap shrink-0">
                {formatiereWarnZeitraum(warnung.gueltigAb, warnung.gueltigBis)}
              </div>
            </div>

            {warnung.beschreibung && (
              <p className="mt-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {warnung.beschreibung}
              </p>
            )}

            {warnung.handlungsempfehlung && (
              <div className="mt-3 pt-2.5 border-t border-slate-900/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => hinweisUmschalten(warnung.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer whitespace-nowrap"
                >
                  {istOffen ? (
                    <>
                      <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Verhaltenshinweise ausblenden</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Amtliche Verhaltenshinweise anzeigen</span>
                    </>
                  )}
                </button>

                {istOffen && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {warnung.handlungsempfehlung}
                  </p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
