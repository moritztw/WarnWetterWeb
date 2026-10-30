import { Bookmark, LocateFixed, Moon, RefreshCw, Sun } from 'lucide-react';
import type { Standort, StationsMeta } from '../shared/wetterTypen.ts';

interface OrtsWerkzeugleisteProps {
  aktiverOrt: Standort;
  station: StationsMeta | null;
  messzeitpunktIso: string | null;
  favoriten: Standort[];
  istFavorit: boolean;
  istDunkelModus: boolean;
  laedtDaten: boolean;
  gpsLadeStatus: boolean;
  gpsHinweis: string | null;
  aufOrtWaehlen: (ort: Standort) => void;
  aufFavoritUmschalten: () => void;
  aufGpsAnfordern: () => void;
  aufAktualisieren: () => void;
  aufThemeUmschalten: () => void;
}

function formatiereUhrzeit(iso: string | null): string {
  if (!iso) return '–';
  const datum = new Date(iso);
  if (!Number.isFinite(datum.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(datum);
}

/**
 * Kontext-Leiste unterhalb der Navigation:
 * Zeigt Ortsnamen, ungeboxte Stations-Metadaten, Favoriten-Schnellwahl, GPS und Theme-Schalter.
 */
export function OrtsWerkzeugleiste({
  aktiverOrt,
  station,
  messzeitpunktIso,
  favoriten,
  istFavorit,
  istDunkelModus,
  laedtDaten,
  gpsLadeStatus,
  gpsHinweis,
  aufOrtWaehlen,
  aufFavoritUmschalten,
  aufGpsAnfordern,
  aufAktualisieren,
  aufThemeUmschalten,
}: OrtsWerkzeugleisteProps) {
  const standUhrzeit = formatiereUhrzeit(messzeitpunktIso);

  return (
    <section
      id="uebersicht"
      aria-label="Aktueller Standort und Werkzeuge"
      className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70"
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
              {aktiverOrt.name}
            </h1>

            {/* Ruhige, ungeboxte Metadaten mit typografischem Trenner · */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {station?.warnzelleName && (
                <>
                  <span>Warngebiet {station.warnzelleName}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {station?.name && (
                <>
                  <span>
                    Station {station.name}
                    {station.entfernungKm !== null ? ` (${station.entfernungKm.toFixed(1).replace('.', ',')} km)` : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {(station?.hoeheMeter !== null && station?.hoeheMeter !== undefined) && (
                <>
                  <span className="font-mono tabular-nums">{station.hoeheMeter} m ü. NHN</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="font-mono tabular-nums">
                {aktiverOrt.breitengrad.toFixed(2)}° N, {aktiverOrt.laengengrad.toFixed(2)}° O
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Messung {standUhrzeit} Uhr</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={aufFavoritUmschalten}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                istFavorit
                  ? 'border-blue-600/40 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 shrink-0 ${istFavorit ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              <span>{istFavorit ? 'Favorit gespeichert' : 'Als Favorit merken'}</span>
            </button>

            <button
              type="button"
              onClick={aufGpsAnfordern}
              disabled={gpsLadeStatus}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LocateFixed
                className={`w-3.5 h-3.5 shrink-0 ${gpsLadeStatus ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{gpsLadeStatus ? 'Ortung läuft…' : 'GPS-Standort'}</span>
            </button>

            <button
              type="button"
              onClick={aufAktualisieren}
              disabled={laedtDaten}
              title="Wetterdaten aktualisieren"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${laedtDaten ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Aktualisieren</span>
            </button>

            <button
              type="button"
              onClick={aufThemeUmschalten}
              aria-label={istDunkelModus ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {istDunkelModus ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Hell</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                  <span>Dunkel</span>
                </>
              )}
            </button>
          </div>
        </div>

        {gpsHinweis && (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
            {gpsHinweis}
          </p>
        )}

        {/* Interaktive Favoriten-Schnellwahl */}
        {favoriten.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 whitespace-nowrap shrink-0">
              Favoriten:
            </span>
            {favoriten.map((ort) => {
              const aktiv =
                Math.abs(ort.breitengrad - aktiverOrt.breitengrad) < 0.01 &&
                Math.abs(ort.laengengrad - aktiverOrt.laengengrad) < 0.01;
              return (
                <button
                  key={ort.id}
                  type="button"
                  onClick={() => aufOrtWaehlen(ort)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    aktiv
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {ort.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
