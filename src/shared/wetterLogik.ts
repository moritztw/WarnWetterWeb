import type {
  AmtlicheWarnung,
  DwdWarnstufe,
  RadarFrame,
  RadarNowcastPunkt,
  StundenVorhersagePunkt,
  TagesVorhersagePunkt,
  WolkenGitterZeitreihe,
} from './wetterTypen.ts';

export interface RohWarnung {
  id?: number | string;
  alert_id?: number | string;
  status?: string | null;
  effective?: string | null;
  onset?: string | null;
  expires?: string | null;
  response_type?: string | null;
  urgency?: string | null;
  severity?: string | null;
  event_de?: string | null;
  event_en?: string | null;
  headline_de?: string | null;
  headline_en?: string | null;
  description_de?: string | null;
  description_en?: string | null;
  instruction_de?: string | null;
  instruction_en?: string | null;
}

export interface RohStundenWetter {
  timestamp: string;
  temperature?: number | null;
  dew_point?: number | null;
  relative_humidity?: number | null;
  precipitation?: number | null;
  precipitation_probability?: number | null;
  precipitation_probability_6h?: number | null;
  wind_speed?: number | null;
  wind_gust_speed?: number | null;
  wind_direction?: number | null;
  pressure_msl?: number | null;
  cloud_cover?: number | null;
  sunshine?: number | null;
  condition?: string | null;
  icon?: string | null;
}

export interface RohRadarEintrag {
  timestamp: string;
  source?: string | null;
  precipitation_5?: number[][] | null;
}

/**
 * Prüft geografische Koordinaten auf gültige numerische Grenzen.
 */
export function validiereKoordinaten(
  latEingabe: unknown,
  lonEingabe: unknown
): { gueltig: true; breitengrad: number; laengengrad: number } | { gueltig: false; fehler: string } {
  const breitengrad = typeof latEingabe === 'number' ? latEingabe : Number(latEingabe);
  const laengengrad = typeof lonEingabe === 'number' ? lonEingabe : Number(lonEingabe);

  if (!Number.isFinite(breitengrad) || !Number.isFinite(laengengrad)) {
    return { gueltig: false, fehler: 'Breiten- und Längengrad müssen gültige Zahlen sein.' };
  }
  if (breitengrad < -90 || breitengrad > 90) {
    return { gueltig: false, fehler: 'Breitengrad muss zwischen -90 und 90 liegen.' };
  }
  if (laengengrad < -180 || laengengrad > 180) {
    return { gueltig: false, fehler: 'Längengrad muss zwischen -180 und 180 liegen.' };
  }

  return {
    gueltig: true,
    breitengrad: Math.round(breitengrad * 10000) / 10000,
    laengengrad: Math.round(laengengrad * 10000) / 10000,
  };
}

/**
 * Wandelt Gradzahlen (0–360°) in deutsche 8er-Kompassabkürzungen um.
 */
export function formatiereWindrichtung(grad: number | null | undefined): string {
  if (grad === null || grad === undefined || !Number.isFinite(grad)) {
    return '–';
  }
  const normiert = ((grad % 360) + 360) % 360;
  const sektoren = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normiert / 45) % 8;
  return sektoren[index] ?? 'N';
}

/**
 * Wandelt Gradzahlen (0–360°) in ausgeschriebene deutsche Himmelsrichtungen um (z. B. "Nordwest").
 */
export function formatiereWindrichtungLang(grad: number | null | undefined): string {
  if (grad === null || grad === undefined || !Number.isFinite(grad)) {
    return 'Umlaufend';
  }
  const normiert = ((grad % 360) + 360) % 360;
  const sektoren = [
    'Nord',
    'Nordost',
    'Ost',
    'Südost',
    'Süd',
    'Südwest',
    'West',
    'Nordwest',
  ];
  const index = Math.round(normiert / 45) % 8;
  return sektoren[index] ?? 'Nord';
}

/**
 * Berechnet die relative Luftfeuchtigkeit (%) über die Magnus-Formel,
 * falls MOSMIX in fernen Vorhersagestunden nur Temperatur und Taupunkt liefert.
 */
export function berechneRelativeFeuchteFallback(
  temperatur: number | null | undefined,
  taupunkt: number | null | undefined,
  direktFeuchte: number | null | undefined
): number | null {
  if (typeof direktFeuchte === 'number' && Number.isFinite(direktFeuchte)) {
    return Math.max(0, Math.min(100, Math.round(direktFeuchte)));
  }
  if (
    typeof temperatur === 'number' &&
    Number.isFinite(temperatur) &&
    typeof taupunkt === 'number' &&
    Number.isFinite(taupunkt)
  ) {
    const zaehler = Math.exp((17.625 * taupunkt) / (243.04 + taupunkt));
    const nenner = Math.exp((17.625 * temperatur) / (243.04 + temperatur));
    return Math.max(0, Math.min(100, Math.round((zaehler / nenner) * 100)));
  }
  return null;
}

/**
 * Übersetzt Bright-Sky-/DWD-Wetterzustände in präzise deutsche Bezeichnungen.
 */
export function uebersetzeWetterzustand(
  condition: string | null | undefined,
  icon: string | null | undefined
): string {
  const schluessel = (condition || icon || '').toLowerCase();

  switch (schluessel) {
    case 'thunderstorm':
      return 'Gewitter';
    case 'hail':
      return 'Hagel';
    case 'sleet':
      return 'Schneeregen';
    case 'snow':
      return 'Schneefall';
    case 'rain':
      return 'Regen';
    case 'fog':
      return 'Nebel';
    case 'wind':
      return 'Starker Wind';
    case 'cloudy':
      return 'Stark bewölkt';
    case 'partly-cloudy-day':
    case 'partly-cloudy-night':
      return 'Heiter bis wolkig';
    case 'clear-day':
      return 'Sonnig / Klar';
    case 'clear-night':
      return 'Klar';
    case 'dry':
      if (icon?.includes('partly-cloudy')) return 'Heiter bis wolkig';
      if (icon?.includes('clear-day')) return 'Sonnig';
      if (icon?.includes('clear-night')) return 'Klar';
      if (icon?.includes('cloudy')) return 'Bewölkt, trocken';
      return 'Trocken';
    default:
      if (icon?.includes('partly-cloudy')) return 'Wechselnd bewölkt';
      if (icon?.includes('clear')) return 'Klar';
      return 'Bedeckt';
  }
}

/**
 * Ordnet CAP-Warnungen des DWD dem offiziellen 4-Stufen-Farbsystem inkl. Vorabinformation zu.
 */
export function klassifiziereDwdWarnungen(rohWarnungen: RohWarnung[]): AmtlicheWarnung[] {
  const ergebnis: AmtlicheWarnung[] = [];

  for (const roh of rohWarnungen) {
    if ((roh.status || '').toLowerCase() === 'test') {
      continue;
    }

    const schlagzeile = (roh.headline_de || roh.headline_en || 'Amtliche Wetterinformation').trim();
    const istVorabinformation =
      schlagzeile.toUpperCase().includes('VORABINFORMATION') ||
      ((roh.response_type || '').toLowerCase() === 'monitor' &&
        schlagzeile.toUpperCase().includes('VORAB'));

    const severity = (roh.severity || '').toLowerCase();
    let warnstufe: DwdWarnstufe = 1;
    let stufenBezeichnung = 'Stufe 1 · Wetterwarnung';

    if (istVorabinformation) {
      warnstufe = 0;
      stufenBezeichnung = 'Vorabinformation Unwetter';
    } else if (severity === 'extreme') {
      warnstufe = 4;
      stufenBezeichnung = 'Stufe 4 · Extremes Unwetter';
    } else if (severity === 'severe') {
      warnstufe = 3;
      stufenBezeichnung = 'Stufe 3 · Unwetterwarnung';
    } else if (severity === 'moderate') {
      warnstufe = 2;
      stufenBezeichnung = 'Stufe 2 · Markantes Wetter';
    } else {
      warnstufe = 1;
      stufenBezeichnung = 'Stufe 1 · Wetterwarnung';
    }

    ergebnis.push({
      id: String(roh.alert_id ?? roh.id ?? `${schlagzeile}-${roh.onset ?? ''}`),
      warnstufe,
      stufenBezeichnung,
      istVorabinformation,
      ereignis: (roh.event_de || roh.event_en || 'Wetterereignis').trim(),
      schlagzeile,
      beschreibung: (roh.description_de || roh.description_en || '').trim(),
      handlungsempfehlung: (roh.instruction_de || roh.instruction_en || '').trim() || null,
      gueltigAb: roh.onset || roh.effective || new Date().toISOString(),
      gueltigBis: roh.expires || null,
      dringlichkeit: (roh.urgency || 'unknown').toLowerCase(),
    });
  }

  return ergebnis.sort((a, b) => {
    const gewichtA = a.istVorabinformation ? 2.5 : a.warnstufe;
    const gewichtB = b.istVorabinformation ? 2.5 : b.warnstufe;
    if (gewichtB !== gewichtA) {
      return gewichtB - gewichtA;
    }
    return a.gueltigAb.localeCompare(b.gueltigAb);
  });
}

export function extrahiereRadarAnalyseMs(source: string | null | undefined): number | null {
  if (!source) return null;
  const teile = source.split('::');
  const isoKandidat = teile[teile.length - 1];
  if (!isoKandidat) return null;
  const ms = Date.parse(isoKandidat);
  return Number.isFinite(ms) ? ms : null;
}

export function bereiteRadarNowcastAuf(
  rohRadar: RohRadarEintrag[],
  fallbackJetztMs: number = Date.now()
): RadarNowcastPunkt[] {
  if (!Array.isArray(rohRadar) || rohRadar.length === 0) {
    return [];
  }

  let analyseGrenzeMs = fallbackJetztMs;
  const gefundeneLaeufe = rohRadar
    .map((r) => extrahiereRadarAnalyseMs(r.source))
    .filter((ms): ms is number => ms !== null);

  if (gefundeneLaeufe.length > 0) {
    analyseGrenzeMs = Math.max(...gefundeneLaeufe);
  }

  const punkte: RadarNowcastPunkt[] = [];

  for (const eintrag of rohRadar) {
    const zeitMs = Date.parse(eintrag.timestamp);
    if (!Number.isFinite(zeitMs)) continue;

    const matrix = eintrag.precipitation_5;
    let rohWert = 0;
    if (Array.isArray(matrix) && matrix.length > 0) {
      const mitteY = Math.floor(matrix.length / 2);
      const zeile = matrix[mitteY] ?? matrix[0];
      if (Array.isArray(zeile) && zeile.length > 0) {
        const mitteX = Math.floor(zeile.length / 2);
        const kandidat = zeile[mitteX] ?? zeile[0] ?? 0;
        if (typeof kandidat === 'number' && Number.isFinite(kandidat) && kandidat > 0) {
          rohWert = kandidat;
        }
      }
    }

    const niederschlag5MinMm = Math.round(rohWert) / 100;
    const intensitaetMmProStunde = Math.round(niederschlag5MinMm * 12 * 10) / 10;

    punkte.push({
      zeitpunkt: new Date(zeitMs).toISOString(),
      niederschlag5MinMm,
      intensitaetMmProStunde,
      istPrognose: zeitMs > analyseGrenzeMs,
    });
  }

  return punkte;
}

export function erzeugeDwdWmsZeitachse(
  rohRadar: RohRadarEintrag[],
  jetztMs: number = Date.now()
): { analyseZeitpunktIso: string | null; frames: RadarFrame[] } {
  if (Array.isArray(rohRadar) && rohRadar.length > 0) {
    const laeufe = rohRadar
      .map((r) => extrahiereRadarAnalyseMs(r.source))
      .filter((ms): ms is number => ms !== null);

    const analyseMs = laeufe.length > 0 ? Math.max(...laeufe) : jetztMs;
    const frames: RadarFrame[] = [];

    for (const r of rohRadar) {
      const zeitMs = Date.parse(r.timestamp);
      if (!Number.isFinite(zeitMs)) continue;
      frames.push({
        zeitpunktIso: new Date(zeitMs).toISOString(),
        zeitpunktMs: zeitMs,
        istPrognose: zeitMs > analyseMs,
        relativMinuten: Math.round((zeitMs - analyseMs) / 60_000),
      });
    }

    if (frames.length > 0) {
      return {
        analyseZeitpunktIso: new Date(analyseMs).toISOString(),
        frames,
      };
    }
  }

  const fuenfMinMs = 5 * 60_000;
  const basisAnalyseMs = Math.floor((jetztMs - fuenfMinMs) / fuenfMinMs) * fuenfMinMs;
  const fallbackFrames: RadarFrame[] = [];

  for (let schritt = -12; schritt <= 24; schritt++) {
    const zeitMs = basisAnalyseMs + schritt * fuenfMinMs;
    fallbackFrames.push({
      zeitpunktIso: new Date(zeitMs).toISOString(),
      zeitpunktMs: zeitMs,
      istPrognose: schritt > 0,
      relativMinuten: schritt * 5,
    });
  }

  return {
    analyseZeitpunktIso: new Date(basisAnalyseMs).toISOString(),
    frames: fallbackFrames,
  };
}

const ICON_PRIORITAET: Record<string, number> = {
  thunderstorm: 9,
  hail: 8,
  snow: 7,
  sleet: 6,
  rain: 5,
  fog: 4,
  wind: 3,
  cloudy: 2,
  'partly-cloudy-day': 1,
  'clear-day': 0,
};

/**
 * Normiert alle stündlichen Einträge (inkl. Vortag "Gestern" + 7 Vorhersagetage)
 * für die endlos horizontal scrollbare WarnWetter-Kombiansicht sowie die 7-Tage-Übersicht.
 */
export function bereiteVorhersageAuf(
  rohStunden: RohStundenWetter[],
  jetztIso: string = new Date().toISOString()
): {
  stundenvorhersage: StundenVorhersagePunkt[];
  alleTageKacheln: TagesVorhersagePunkt[];
  tagesvorhersage: TagesVorhersagePunkt[];
} {
  const datumFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const wochentagFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  });
  const tagMonatFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: 'numeric',
    month: 'short',
  });

  const jetztMs = new Date(jetztIso).getTime();
  const heuteSchluessel = datumFormatter.format(new Date(jetztMs));
  const gesternDatum = new Date(Date.parse(`${heuteSchluessel}T12:00:00Z`) - 24 * 3600_000);
  const gesternSchluessel = datumFormatter.format(gesternDatum);
  const morgenDatum = new Date(Date.parse(`${heuteSchluessel}T12:00:00Z`) + 24 * 3600_000);
  const morgenSchluessel = datumFormatter.format(morgenDatum);

  // Alle Stunden ab Gestern 00:00 Uhr bis Ende Tag 7 (~192–216 Stunden) behalten
  const gefilterteRohStunden = rohStunden.filter((eintrag) => {
    const zeit = new Date(eintrag.timestamp);
    if (!Number.isFinite(zeit.getTime())) return false;
    const tagSchluessel = datumFormatter.format(zeit);
    return tagSchluessel >= gesternSchluessel;
  });

  const stundenvorhersage: StundenVorhersagePunkt[] = gefilterteRohStunden
    .slice(0, 216)
    .map((stunde) => {
      const zeitMs = new Date(stunde.timestamp).getTime();
      const iconCode = stunde.icon || stunde.condition || 'cloudy';
      const windGrad = stunde.wind_direction ?? null;
      return {
        zeitpunkt: stunde.timestamp,
        datumSchluessel: datumFormatter.format(new Date(stunde.timestamp)),
        istVergangenheit: zeitMs <= jetztMs,
        temperatur: stunde.temperature ?? null,
        taupunkt: stunde.dew_point ?? null,
        luftfeuchtigkeit: berechneRelativeFeuchteFallback(
          stunde.temperature,
          stunde.dew_point,
          stunde.relative_humidity
        ),
        niederschlagMm: Math.max(0, Number(stunde.precipitation ?? 0)),
        regenwahrscheinlichkeit:
          stunde.precipitation_probability ?? stunde.precipitation_probability_6h ?? null,
        windgeschwindigkeitKmh: stunde.wind_speed ?? null,
        windboeenKmh: stunde.wind_gust_speed ?? null,
        windrichtungGrad: windGrad,
        windrichtungKompass: formatiereWindrichtung(windGrad),
        windrichtungLang: formatiereWindrichtungLang(windGrad),
        luftdruckHpa: stunde.pressure_msl ?? null,
        bewoelkungProzent: stunde.cloud_cover ?? null,
        sonnenscheinMinuten:
          typeof stunde.sunshine === 'number' ? Math.round(stunde.sunshine) : null,
        zustandText: uebersetzeWetterzustand(stunde.condition, stunde.icon),
        iconCode,
      };
    });

  const tagesGruppen = new Map<string, RohStundenWetter[]>();
  for (const stunde of gefilterteRohStunden) {
    const zeit = new Date(stunde.timestamp);
    const tagSchluessel = datumFormatter.format(zeit);
    const liste = tagesGruppen.get(tagSchluessel) ?? [];
    liste.push(stunde);
    tagesGruppen.set(tagSchluessel, liste);
  }

  const alleTageKacheln: TagesVorhersagePunkt[] = [];

  for (const [datum, eintraege] of tagesGruppen.entries()) {
    if (eintraege.length < 4 && datum !== heuteSchluessel) continue;

    const temperaturen = eintraege
      .map((e) => e.temperature)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));

    if (temperaturen.length === 0) continue;

    const niederschlagSummeMm =
      Math.round(
        eintraege.reduce((summe, e) => summe + Math.max(0, Number(e.precipitation ?? 0)), 0) * 10
      ) / 10;

    const wahrscheinlichkeiten = eintraege
      .map((e) => e.precipitation_probability ?? e.precipitation_probability_6h)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));

    const boeen = eintraege
      .map((e) => e.wind_gust_speed)
      .filter((b): b is number => typeof b === 'number' && Number.isFinite(b));

    const sonnenscheinWerte = eintraege
      .map((e) => e.sunshine)
      .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));

    const sonnenscheinStunden =
      sonnenscheinWerte.length > 0
        ? Math.round((sonnenscheinWerte.reduce((a, b) => a + Math.max(0, b), 0) / 60) * 10) / 10
        : null;

    let dominantesIcon = 'partly-cloudy-day';
    let dominanteCondition: string | null = null;
    let hoechstePrioritaet = -1;

    for (const e of eintraege) {
      const rohIcon = (e.icon || 'cloudy').replace('-night', '-day');
      const prio = ICON_PRIORITAET[e.condition || ''] ?? ICON_PRIORITAET[rohIcon] ?? 1;
      if (prio > hoechstePrioritaet) {
        hoechstePrioritaet = prio;
        dominantesIcon = rohIcon;
        dominanteCondition = e.condition ?? null;
      }
    }

    const referenzDatum = new Date(`${datum}T12:00:00Z`);
    const wt = wochentagFormatter.format(referenzDatum).replace('.', '');
    const tm = tagMonatFormatter.format(referenzDatum);
    const istHeute = datum === heuteSchluessel;
    const istVergangenheit = datum < heuteSchluessel;

    const wochentagKurz = istHeute ? 'Heute' : datum === morgenSchluessel ? 'Morgen' : wt;
    const kachelTitel = istHeute ? 'Heute' : `${wt} ${tm}`;

    alleTageKacheln.push({
      datum,
      wochentagKurz,
      kachelTitel,
      istVergangenheit,
      istHeute,
      temperaturMin: Math.round(Math.min(...temperaturen) * 10) / 10,
      temperaturMax: Math.round(Math.max(...temperaturen) * 10) / 10,
      niederschlagSummeMm,
      regenwahrscheinlichkeitMax:
        wahrscheinlichkeiten.length > 0 ? Math.max(...wahrscheinlichkeiten) : null,
      maxWindboeenKmh: boeen.length > 0 ? Math.round(Math.max(...boeen)) : null,
      sonnenscheinStunden,
      zustandText: uebersetzeWetterzustand(dominanteCondition, dominantesIcon),
      iconCode: dominantesIcon,
    });

    if (alleTageKacheln.length >= 9) break;
  }

  const tagesvorhersage = alleTageKacheln.filter((t) => !t.istVergangenheit).slice(0, 7);

  return { stundenvorhersage, alleTageKacheln, tagesvorhersage };
}

/**
 * Interpoliert das 15-Minuten-DWD-ICON-D2-Wolkengitter linear auf einen beliebigen
 * 5-Minuten-Zeitpunkt (Vergangenheit, Live oder +120 Min. Prognose).
 */
export function interpoliereWolkenFeldAufZeitpunkt(
  gitter: WolkenGitterZeitreihe,
  zielMs: number
): number[] {
  const anzahlZellen = gitter.zeilen * gitter.spalten;
  const zeiten = gitter.zeitpunkteMs;
  if (zeiten.length === 0 || gitter.werteJeZeitpunkt.length === 0) {
    return new Array<number>(anzahlZellen).fill(0);
  }

  if (zielMs <= (zeiten[0] ?? 0) || zeiten.length === 1) {
    return (gitter.werteJeZeitpunkt[0] ?? []).slice(0, anzahlZellen);
  }

  const letzterIdx = zeiten.length - 1;
  if (zielMs >= (zeiten[letzterIdx] ?? 0)) {
    return (gitter.werteJeZeitpunkt[letzterIdx] ?? []).slice(0, anzahlZellen);
  }

  let i0 = 0;
  for (let i = 0; i < letzterIdx; i++) {
    if (zielMs >= (zeiten[i] ?? 0) && zielMs <= (zeiten[i + 1] ?? 0)) {
      i0 = i;
      break;
    }
  }

  const t0 = zeiten[i0] ?? zielMs;
  const t1 = zeiten[i0 + 1] ?? zielMs;
  const faktor = t1 > t0 ? (zielMs - t0) / (t1 - t0) : 0;
  const feld0 = gitter.werteJeZeitpunkt[i0] ?? [];
  const feld1 = gitter.werteJeZeitpunkt[i0 + 1] ?? feld0;

  const ergebnis = new Array<number>(anzahlZellen);
  for (let k = 0; k < anzahlZellen; k++) {
    const w0 = feld0[k] ?? 0;
    const w1 = feld1[k] ?? w0;
    ergebnis[k] = Math.max(0, Math.min(100, w0 + (w1 - w0) * faktor));
  }
  return ergebnis;
}

/**
 * Bilineare räumliche Interpolation des Bewölkungsgrads (0–100 %) an Koordinate (lat, lon).
 */
export function interpoliereWolkenWertBilinear(
  gitter: WolkenGitterZeitreihe,
  feld: readonly number[],
  lat: number,
  lon: number
): number {
  if (gitter.zeilen < 2 || gitter.spalten < 2) return 0;

  const normZeile =
    ((lat - gitter.latMin) / (gitter.latMax - gitter.latMin)) * (gitter.zeilen - 1);
  const normSpalte =
    ((lon - gitter.lonMin) / (gitter.lonMax - gitter.lonMin)) * (gitter.spalten - 1);

  const zClamped = Math.max(0, Math.min(gitter.zeilen - 1, normZeile));
  const sClamped = Math.max(0, Math.min(gitter.spalten - 1, normSpalte));

  const z0 = Math.min(gitter.zeilen - 2, Math.floor(zClamped));
  const s0 = Math.min(gitter.spalten - 2, Math.floor(sClamped));
  const z1 = z0 + 1;
  const s1 = s0 + 1;

  const fz = zClamped - z0;
  const fs = sClamped - s0;

  const w00 = feld[z0 * gitter.spalten + s0] ?? 0;
  const w01 = feld[z0 * gitter.spalten + s1] ?? 0;
  const w10 = feld[z1 * gitter.spalten + s0] ?? 0;
  const w11 = feld[z1 * gitter.spalten + s1] ?? 0;

  const unten = w00 + (w01 - w00) * fs;
  const oben = w10 + (w11 - w10) * fs;
  return unten + (oben - unten) * fz;
}

