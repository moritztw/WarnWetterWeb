import {
  Cloud,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
} from 'lucide-react';

interface WetterSymbolProps {
  iconCode: string;
  groesse?: string;
}

/**
 * Stellt das passende meteorologische Symbol anhand des DWD-/Bright-Sky-Codes dar.
 */
export function WetterSymbol({ iconCode, groesse = 'w-6 h-6' }: WetterSymbolProps) {
  const code = (iconCode || '').toLowerCase();

  if (code.includes('thunder')) {
    return <CloudLightning className={`${groesse} text-amber-500 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('hail')) {
    return <CloudHail className={`${groesse} text-cyan-500 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('snow') || code.includes('sleet')) {
    return <CloudSnow className={`${groesse} text-sky-400 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('rain')) {
    return <CloudRain className={`${groesse} text-blue-500 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('fog')) {
    return <CloudFog className={`${groesse} text-slate-400 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('wind')) {
    return <Wind className={`${groesse} text-teal-500 shrink-0`} aria-hidden="true" />;
  }
  if (code === 'partly-cloudy-night') {
    return <CloudMoon className={`${groesse} text-indigo-400 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('partly-cloudy')) {
    return <CloudSun className={`${groesse} text-amber-400 shrink-0`} aria-hidden="true" />;
  }
  if (code === 'clear-night') {
    return <Moon className={`${groesse} text-indigo-300 shrink-0`} aria-hidden="true" />;
  }
  if (code.includes('clear')) {
    return <Sun className={`${groesse} text-amber-400 shrink-0`} aria-hidden="true" />;
  }

  return <Cloud className={`${groesse} text-slate-400 shrink-0`} aria-hidden="true" />;
}
