/**
 * Gemeinsame Datenstrukturen für Server-Proxy, Logik-Tests und React-Client.
 */

export type DwdWarnstufe = 0 | 1 | 2 | 3 | 4;

export interface Standort {
  id: string;
  name: string;
  bundesland?: string;
  landkreis?: string;
  land?: string;
  breitengrad: number;
  laengengrad: number;
  hoeheMeter?: number;
}

export interface StationsMeta {
  name: string;
  dwdStationId: string | null;
  hoeheMeter: number | null;
  entfernungKm: number | null;
  warnzelleName: string | null;
  bundesland: string | null;
}

export interface AktuellesWetter {
  zeitpunkt: string;
  temperatur: number | null;
  taupunkt: number | null;
  luftfeuchtigkeit: number | null;
  luftdruckHpa: number | null;
  windgeschwindigkeitKmh: number | null;
  windboeenKmh: number | null;
  windrichtungGrad: number | null;
  windrichtungKompass: string;
  niederschlagLetzteStundeMm: number | null;
  bewoelkungProzent: number | null;
  sichtweiteKm: number | null;
  sonnenscheinMinuten: number | null;
  zustandCode: string;
  zustandText: string;
  iconCode: string;
}

export interface StundenVorhersagePunkt {
  zeitpunkt: string;
  datumSchluessel: string;
  istVergangenheit: boolean;
  temperatur: number | null;
  taupunkt: number | null;
  luftfeuchtigkeit: number | null;
  niederschlagMm: number;
  regenwahrscheinlichkeit: number | null;
  windgeschwindigkeitKmh: number | null;
  windboeenKmh: number | null;
  windrichtungGrad: number | null;
  windrichtungKompass: string;
  windrichtungLang: string;
  luftdruckHpa: number | null;
  bewoelkungProzent: number | null;
  sonnenscheinMinuten: number | null;
  zustandText: string;
  iconCode: string;
}

export interface TagesVorhersagePunkt {
  datum: string;
  wochentagKurz: string;
  kachelTitel: string;
  istVergangenheit: boolean;
  istHeute: boolean;
  temperaturMin: number;
  temperaturMax: number;
  niederschlagSummeMm: number;
  regenwahrscheinlichkeitMax: number | null;
  maxWindboeenKmh: number | null;
  sonnenscheinStunden: number | null;
  zustandText: string;
  iconCode: string;
}

export interface RadarNowcastPunkt {
  zeitpunkt: string;
  niederschlag5MinMm: number;
  intensitaetMmProStunde: number;
  istPrognose: boolean;
}

export interface AmtlicheWarnung {
  id: string;
  warnstufe: DwdWarnstufe;
  stufenBezeichnung: string;
  istVorabinformation: boolean;
  ereignis: string;
  schlagzeile: string;
  beschreibung: string;
  handlungsempfehlung: string | null;
  gueltigAb: string;
  gueltigBis: string | null;
  dringlichkeit: string;
}

export interface WetterPaket {
  abgerufenAm: string;
  koordinaten: {
    breitengrad: number;
    laengengrad: number;
  };
  station: StationsMeta;
  aktuell: AktuellesWetter;
  radarNowcast: RadarNowcastPunkt[];
  stundenvorhersage: StundenVorhersagePunkt[];
  alleTageKacheln: TagesVorhersagePunkt[];
  tagesvorhersage: TagesVorhersagePunkt[];
  warnungen: AmtlicheWarnung[];
}

export interface DeutschlandWarnUebersicht {
  aktualisiertAm: string;
  gesamtAktiv: number;
  nachStufe: {
    stufe1: number;
    stufe2: number;
    stufe3: number;
    stufe4: number;
    vorabinfo: number;
  };
  schwerpunkte: Array<{
    ereignis: string;
    warnstufe: DwdWarnstufe;
    anzahlGebiete: number;
  }>;
}

export interface RadarFrame {
  zeitpunktIso: string;
  zeitpunktMs: number;
  istPrognose: boolean;
  relativMinuten: number;
}

export interface RadarZeitachse {
  wmsUrl: string;
  layerName: string;
  analyseZeitpunktIso: string | null;
  frames: RadarFrame[];
}

export interface WolkenGitterZeitreihe {
  aktualisiertAm: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  zeilen: number;
  spalten: number;
  zeitpunkteMs: number[];
  werteJeZeitpunkt: number[][];
}

