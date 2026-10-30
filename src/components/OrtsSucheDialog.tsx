import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import type { Standort } from '../shared/wetterTypen.ts';

interface OrtsSucheDialogProps {
  offen: boolean;
  aufSchliessen: () => void;
  aufOrtAuswaehlen: (ort: Standort) => void;
}

const REFERENZ_STATIONEN: Standort[] = [
  {
    id: 'preset-frankfurt',
    name: 'Frankfurt am Main',
    bundesland: 'Hessen',
    land: 'Deutschland',
    breitengrad: 50.1109,
    laengengrad: 8.6821,
    hoeheMeter: 112,
  },
  {
    id: 'preset-hamburg',
    name: 'Hamburg',
    bundesland: 'Hamburg',
    land: 'Deutschland',
    breitengrad: 53.5511,
    laengengrad: 9.9937,
    hoeheMeter: 6,
  },
  {
    id: 'preset-muenchen',
    name: 'München',
    bundesland: 'Bayern',
    land: 'Deutschland',
    breitengrad: 48.1351,
    laengengrad: 11.582,
    hoeheMeter: 519,
  },
  {
    id: 'preset-berlin',
    name: 'Berlin',
    bundesland: 'Berlin',
    land: 'Deutschland',
    breitengrad: 52.52,
    laengengrad: 13.405,
    hoeheMeter: 34,
  },
  {
    id: 'preset-koeln',
    name: 'Köln',
    bundesland: 'Nordrhein-Westfalen',
    land: 'Deutschland',
    breitengrad: 50.9375,
    laengengrad: 6.9603,
    hoeheMeter: 53,
  },
  {
    id: 'preset-zugspitze',
    name: 'Zugspitze',
    bundesland: 'Bayern',
    land: 'Deutschland',
    breitengrad: 47.421,
    laengengrad: 10.9854,
    hoeheMeter: 2962,
  },
];

/**
 * Dialog zur deutschlandweiten Ortssuche via Open-Meteo Geocoding Proxy.
 */
export function OrtsSucheDialog({
  offen,
  aufSchliessen,
  aufOrtAuswaehlen,
}: OrtsSucheDialogProps) {
  const [suchbegriff, setSuchbegriff] = useState('');
  const [ergebnisse, setErgebnisse] = useState<Standort[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const eingabeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!offen) return;
    setSuchbegriff('');
    setErgebnisse([]);
    setFehler(null);
    const timer = window.setTimeout(() => eingabeRef.current?.focus(), 40);

    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aufSchliessen();
    };
    window.addEventListener('keydown', beiTaste);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', beiTaste);
    };
  }, [offen, aufSchliessen]);

  useEffect(() => {
    if (!offen) return;
    const bereinigt = suchbegriff.trim();
    if (bereinigt.length < 2) {
      setErgebnisse([]);
      setFehler(null);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      setLaedt(true);
      setFehler(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(bereinigt)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Suchanfrage fehlgeschlagen.');
        const daten = (await res.json()) as { ergebnisse?: Standort[] };
        setErgebnisse(daten.ergebnisse ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setFehler('Ortssuche vorübergehend nicht verfügbar.');
        }
      } finally {
        setLaedt(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [suchbegriff, offen]);

  if (!offen) return null;

  const waehleUndSchliesse = (ort: Standort) => {
    aufOrtAuswaehlen(ort);
    aufSchliessen();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ortssuche-titel"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={aufSchliessen}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 id="ortssuche-titel" className="text-base font-bold text-slate-900 dark:text-slate-50">
            Standort oder Gemeinde wählen
          </h2>
          <button
            type="button"
            onClick={aufSchliessen}
            aria-label="Dialog schließen"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={eingabeRef}
              type="search"
              value={suchbegriff}
              onChange={(e) => setSuchbegriff(e.target.value)}
              placeholder="Stadt, Gemeinde oder Bergstation eingeben…"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-500"
            />
          </div>

          {fehler && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{fehler}</p>}

          {laedt && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Suche passende Orte…
            </p>
          )}

          {suchbegriff.trim().length >= 2 && !laedt && ergebnisse.length === 0 && !fehler && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Kein passender Ort gefunden. Bitte Schreibweise prüfen.
            </p>
          )}

          {ergebnisse.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {ergebnisse.map((ort) => (
                <li key={ort.id}>
                  <button
                    type="button"
                    onClick={() => waehleUndSchliesse(ort)}
                    className="w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {ort.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[ort.landkreis, ort.bundesland, ort.land].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                      {ort.breitengrad.toFixed(2)}° N
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {suchbegriff.trim().length < 2 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Wichtige DWD-Referenzorte in Deutschland:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REFERENZ_STATIONEN.map((ort) => (
                  <button
                    key={ort.id}
                    type="button"
                    onClick={() => waehleUndSchliesse(ort)}
                    className="px-3 py-2 text-xs font-medium text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors truncate cursor-pointer"
                  >
                    {ort.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
