import { Search } from 'lucide-react';

interface KopfzeileProps {
  aufSucheOeffnen: () => void;
}

/**
 * Einzeilige 3-Zonen-Kopfzeile im sachlichen DWD-Behördenstil:
 * Zone 1: Wortmarke | Zone 2: Abschnitts-Navigation | Zone 3: Primäre Ortssuche
 */
export function Kopfzeile({ aufSucheOeffnen }: KopfzeileProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
      <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        <a
          href="#uebersicht"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
        >
          WarnWetter Web
        </a>

        <nav
          aria-label="Hauptnavigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#uebersicht"
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Übersicht
          </a>
          <a
            href="#warnkarte"
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Warnkarte &amp; Radar
          </a>
          <a
            href="#stundenvorhersage"
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Stundenvorhersage
          </a>
          <a
            href="#sieben-tage"
            className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            7-Tage-Trend
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={aufSucheOeffnen}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ort suchen</span>
          </button>
        </div>
      </div>
    </header>
  );
}
