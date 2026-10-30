/**
 * Kompakte astronomische Standardberechnungen (ohne externe Abhängigkeiten)
 * für Sonnen- und Mondhöhe sowie Auf- und Untergangszeiten am jeweiligen Standort.
 */

const GRAD_ZU_RAD = Math.PI / 180;
const RAD_ZU_GRAD = 180 / Math.PI;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TAG_MS = 86_400_000;

function normiereGrad(winkel: number): number {
  return ((winkel % 360) + 360) % 360;
}

/**
 * Berechnet den Höhenwinkel der Sonne über dem Horizont in Grad (-90° bis +90°).
 * Genauigkeit: ca. 1–2 Bogenminuten (Jean Meeus Kurzformel).
 */
export function berechneSonnenHoeheGrad(
  zeitMs: number,
  breitengrad: number,
  laengengrad: number
): number {
  const tageSeitJ2000 = (zeitMs - J2000_MS) / TAG_MS;

  const mittlereAnomalie = normiereGrad(357.5291 + 0.98560028 * tageSeitJ2000);
  const mRad = mittlereAnomalie * GRAD_ZU_RAD;

  const mittelpunktsgleichung =
    1.9148 * Math.sin(mRad) + 0.02 * Math.sin(2 * mRad) + 0.0003 * Math.sin(3 * mRad);
  const ekliptikaleLaenge = normiereGrad(
    mittlereAnomalie + mittelpunktsgleichung + 180 + 102.9372
  );
  const lambdaRad = ekliptikaleLaenge * GRAD_ZU_RAD;
  const schiefeRad = 23.4393 * GRAD_ZU_RAD;

  const sinDeklination = Math.sin(schiefeRad) * Math.sin(lambdaRad);
  const deklinationRad = Math.asin(sinDeklination);
  const rektaszensionGrad =
    Math.atan2(Math.cos(schiefeRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * RAD_ZU_GRAD;

  const sternzeitGreenwich = normiereGrad(280.46061837 + 360.98564736629 * tageSeitJ2000);
  const stundenwinkelRad =
    normiereGrad(sternzeitGreenwich + laengengrad - rektaszensionGrad) * GRAD_ZU_RAD;

  const latRad = breitengrad * GRAD_ZU_RAD;
  const sinHoehe =
    Math.sin(latRad) * Math.sin(deklinationRad) +
    Math.cos(latRad) * Math.cos(deklinationRad) * Math.cos(stundenwinkelRad);

  return Math.asin(Math.max(-1, Math.min(1, sinHoehe))) * RAD_ZU_GRAD;
}

/**
 * Berechnet den Höhenwinkel des Mondes über dem Horizont in Grad (-90° bis +90°).
 */
export function berechneMondHoeheGrad(
  zeitMs: number,
  breitengrad: number,
  laengengrad: number
): number {
  const d = (zeitMs - J2000_MS) / TAG_MS;

  const lStrich = normiereGrad(218.316 + 13.176396 * d) * GRAD_ZU_RAD;
  const mMond = normiereGrad(134.963 + 13.064993 * d) * GRAD_ZU_RAD;
  const fArg = normiereGrad(93.272 + 13.22935 * d) * GRAD_ZU_RAD;

  const ekliptikLaengeRad = (lStrich * RAD_ZU_GRAD + 6.289 * Math.sin(mMond)) * GRAD_ZU_RAD;
  const ekliptikBreiteRad = 5.128 * Math.sin(fArg) * GRAD_ZU_RAD;
  const schiefeRad = 23.4393 * GRAD_ZU_RAD;

  const sinDekl =
    Math.sin(ekliptikBreiteRad) * Math.cos(schiefeRad) +
    Math.cos(ekliptikBreiteRad) * Math.sin(schiefeRad) * Math.sin(ekliptikLaengeRad);
  const deklRad = Math.asin(Math.max(-1, Math.min(1, sinDekl)));

  const y =
    Math.sin(ekliptikLaengeRad) * Math.cos(schiefeRad) -
    Math.tan(ekliptikBreiteRad) * Math.sin(schiefeRad);
  const x = Math.cos(ekliptikLaengeRad);
  const rektaszensionGrad = Math.atan2(y, x) * RAD_ZU_GRAD;

  const sternzeitGreenwich = normiereGrad(280.46061837 + 360.98564736629 * d);
  const stundenwinkelRad =
    normiereGrad(sternzeitGreenwich + laengengrad - rektaszensionGrad) * GRAD_ZU_RAD;

  const latRad = breitengrad * GRAD_ZU_RAD;
  const sinHoehe =
    Math.sin(latRad) * Math.sin(deklRad) +
    Math.cos(latRad) * Math.cos(deklRad) * Math.cos(stundenwinkelRad);

  // Korrektur um mittlere Mondparallaxe (~0.7°)
  return Math.asin(Math.max(-1, Math.min(1, sinHoehe))) * RAD_ZU_GRAD - 0.7;
}

export interface TagesAstronomieEreignisse {
  sonnenaufgangMs: number | null;
  sonnenuntergangMs: number | null;
  mondaufgangMs: number | null;
  monduntergangMs: number | null;
}

/**
 * Ermittelt für ein Zeitintervall [tagStartMs, tagEndeMs] die exakten Nulldurchgänge
 * (Aufgang & Untergang) für Sonne (-0.833° Refraktion) und Mond (+0.125°).
 */
export function berechneAufUndUntergang(
  tagStartMs: number,
  tagEndeMs: number,
  breitengrad: number,
  laengengrad: number
): TagesAstronomieEreignisse {
  const schrittMs = 10 * 60_000;
  const sonnenSchwelle = -0.833;
  const mondSchwelle = 0.125;

  let sonnenaufgangMs: number | null = null;
  let sonnenuntergangMs: number | null = null;
  let mondaufgangMs: number | null = null;
  let monduntergangMs: number | null = null;

  let vorSonne = berechneSonnenHoeheGrad(tagStartMs, breitengrad, laengengrad) - sonnenSchwelle;
  let vorMond = berechneMondHoeheGrad(tagStartMs, breitengrad, laengengrad) - mondSchwelle;

  for (let t = tagStartMs + schrittMs; t <= tagEndeMs; t += schrittMs) {
    const aktSonne = berechneSonnenHoeheGrad(t, breitengrad, laengengrad) - sonnenSchwelle;
    if (vorSonne <= 0 && aktSonne > 0 && sonnenaufgangMs === null) {
      const anteil = Math.abs(vorSonne) / (Math.abs(vorSonne) + Math.abs(aktSonne));
      sonnenaufgangMs = Math.round(t - schrittMs + anteil * schrittMs);
    } else if (vorSonne >= 0 && aktSonne < 0 && sonnenuntergangMs === null) {
      const anteil = Math.abs(vorSonne) / (Math.abs(vorSonne) + Math.abs(aktSonne));
      sonnenuntergangMs = Math.round(t - schrittMs + anteil * schrittMs);
    }
    vorSonne = aktSonne;

    const aktMond = berechneMondHoeheGrad(t, breitengrad, laengengrad) - mondSchwelle;
    if (vorMond <= 0 && aktMond > 0 && mondaufgangMs === null) {
      const anteil = Math.abs(vorMond) / (Math.abs(vorMond) + Math.abs(aktMond));
      mondaufgangMs = Math.round(t - schrittMs + anteil * schrittMs);
    } else if (vorMond >= 0 && aktMond < 0 && monduntergangMs === null) {
      const anteil = Math.abs(vorMond) / (Math.abs(vorMond) + Math.abs(aktMond));
      monduntergangMs = Math.round(t - schrittMs + anteil * schrittMs);
    }
    vorMond = aktMond;
  }

  return {
    sonnenaufgangMs,
    sonnenuntergangMs,
    mondaufgangMs,
    monduntergangMs,
  };
}
