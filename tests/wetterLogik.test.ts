import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  berechneRelativeFeuchteFallback,
  bereiteRadarNowcastAuf,
  bereiteVorhersageAuf,
  erzeugeDwdWmsZeitachse,
  formatiereWindrichtung,
  formatiereWindrichtungLang,
  interpoliereWolkenFeldAufZeitpunkt,
  interpoliereWolkenWertBilinear,
  klassifiziereDwdWarnungen,
  validiereKoordinaten,
} from '../src/shared/wetterLogik.ts';
import {
  berechneAufUndUntergang,
  berechneSonnenHoeheGrad,
} from '../src/shared/astronomie.ts';

describe('Koordinaten-Validierung', () => {
  it('akzeptiert gültige Deutschland-Koordinaten und rundet auf 4 Nachkommastellen', () => {
    const res = validiereKoordinaten('50.110924', '8.682127');
    assert.equal(res.gueltig, true);
    if (res.gueltig) {
      assert.equal(res.breitengrad, 50.1109);
      assert.equal(res.laengengrad, 8.6821);
    }
  });

  it('weist ungültige Werte und Grenzüberschreitungen ab', () => {
    assert.equal(validiereKoordinaten('abc', 10).gueltig, false);
    assert.equal(validiereKoordinaten(95, 10).gueltig, false);
    assert.equal(validiereKoordinaten(50, -190).gueltig, false);
  });
});

describe('DWD 4-Stufen-Warnsystem & Vorabinformationen', () => {
  it('klassifiziert alle Warnstufen korrekt, filtert Testmeldungen und sortiert nach Schweregrad', () => {
    const warnungen = klassifiziereDwdWarnungen([
      {
        id: 1,
        severity: 'minor',
        event_de: 'NEBEL',
        headline_de: 'Amtliche WARNUNG vor NEBEL',
        description_de: 'Sichtweite unter 150 m.',
        onset: '2026-10-30T02:00:00Z',
      },
      {
        id: 2,
        status: 'test',
        severity: 'extreme',
        headline_de: 'TESTWARNUNG',
      },
      {
        id: 3,
        severity: 'severe',
        event_de: 'SCHWERE STURMBÖEN',
        headline_de: 'Amtliche UNWETTERWARNUNG vor SCHWEREN STURMBÖEN',
        description_de: 'Böen bis 105 km/h.',
        instruction_de: 'Aufenthalt im Freien vermeiden.',
        onset: '2026-10-30T06:00:00Z',
      },
      {
        id: 4,
        severity: 'moderate',
        event_de: 'DAUERREGEN',
        headline_de: 'VORABINFORMATION UNWETTER vor HEFTIGEM DAUERREGEN',
        onset: '2026-10-30T12:00:00Z',
      },
    ]);

    assert.equal(warnungen.length, 3);
    assert.equal(warnungen[0]?.warnstufe, 3);
    assert.equal(warnungen[0]?.stufenBezeichnung, 'Stufe 3 · Unwetterwarnung');
    assert.equal(warnungen[1]?.istVorabinformation, true);
    assert.equal(warnungen[1]?.warnstufe, 0);
    assert.equal(warnungen[2]?.warnstufe, 1);
  });
});

describe('Windrichtung & Relative Luftfeuchtigkeit (Magnus-Fallback)', () => {
  it('ordnet Kurz- und Langform der Himmelsrichtungen korrekt zu', () => {
    assert.equal(formatiereWindrichtung(0), 'N');
    assert.equal(formatiereWindrichtung(225), 'SW');
    assert.equal(formatiereWindrichtungLang(315), 'Nordwest');
    assert.equal(formatiereWindrichtungLang(135), 'Südost');
  });

  it('berechnet relative Feuchte aus Temperatur und Taupunkt, wenn Direktwert fehlt', () => {
    assert.equal(berechneRelativeFeuchteFallback(11.0, 7.4, null), 78);
    assert.equal(berechneRelativeFeuchteFallback(10, 10, null), 100);
    assert.equal(berechneRelativeFeuchteFallback(15, 5, 62), 62);
  });
});

describe('MOSMIX Endlos-Zeitreihe (inkl. Vortag) & Tageskacheln', () => {
  it('liefert Vergangenheits- und Zukunftsstunden mit Kacheln für Gestern, Heute und Folgetage', () => {
    const startGestern = '2026-10-29T00:00:00Z';
    const jetzt = '2026-10-30T10:00:00Z';
    const stunden = Array.from({ length: 96 }, (_, idx) => ({
      timestamp: new Date(Date.parse(startGestern) + idx * 3600_000).toISOString(),
      temperature: 7 + (idx % 8),
      dew_point: 5,
      precipitation: idx % 12 === 0 ? 1.0 : 0,
      wind_gust_speed: 18,
      wind_direction: 315,
      pressure_msl: 1030,
      sunshine: 15,
      condition: 'cloudy',
      icon: 'cloudy',
    }));

    const { stundenvorhersage, alleTageKacheln, tagesvorhersage } = bereiteVorhersageAuf(
      stunden,
      jetzt
    );

    assert.equal(stundenvorhersage.length, 96);
    assert.equal(stundenvorhersage[0]?.istVergangenheit, true);
    assert.equal(stundenvorhersage[0]?.windrichtungLang, 'Nordwest');
    assert.ok((stundenvorhersage[0]?.luftfeuchtigkeit ?? 0) > 50);

    // alleTageKacheln enthält den Vortag (29.10.), tagesvorhersage startet erst bei Heute (30.10.)
    assert.equal(alleTageKacheln[0]?.istVergangenheit, true);
    assert.equal(tagesvorhersage[0]?.istHeute, true);
    assert.equal(tagesvorhersage[0]?.kachelTitel, 'Heute');
  });
});

describe('DWD RV 2-Stunden-Radar-Nowcast & Astronomie (Sonne & Mond)', () => {
  it('rechnet 0.01 mm / 5 Min. exakt in mm und mm/h um', () => {
    const nowcast = bereiteRadarNowcastAuf([
      {
        timestamp: '2026-10-30T08:35:00+00:00',
        source: 'RADARCOMP::RV::2026-10-30T08:35:00+00:00',
        precipitation_5: [[25]],
      },
      {
        timestamp: '2026-10-30T09:15:00+00:00',
        source: 'RADARCOMP::RV::2026-10-30T08:35:00+00:00',
        precipitation_5: [[50]],
      },
    ]);
    assert.equal(nowcast[0]?.istPrognose, false);
    assert.equal(nowcast[0]?.intensitaetMmProStunde, 3.0);
    assert.equal(nowcast[1]?.istPrognose, true);
    assert.equal(nowcast[1]?.intensitaetMmProStunde, 6.0);

    const wmsFallback = erzeugeDwdWmsZeitachse([], Date.parse('2026-10-30T08:37:12Z'));
    assert.equal(wmsFallback.frames.length, 37);
  });

  it('berechnet Sonnenhöhe sowie Sonnenaufgang und Sonnenuntergang für Hannover plausibel', () => {
    // Hannover (52.3759° N, 9.7320° O) am 30. Oktober 2026
    const tagStart = Date.parse('2026-10-30T00:00:00+01:00');
    const tagEnde = Date.parse('2026-10-30T23:59:59+01:00');
    const mittag = Date.parse('2026-10-30T12:00:00+01:00');
    const mitternacht = Date.parse('2026-10-30T01:00:00+01:00');

    assert.ok(berechneSonnenHoeheGrad(mittag, 52.3759, 9.732) > 15);
    assert.ok(berechneSonnenHoeheGrad(mitternacht, 52.3759, 9.732) < -20);

    const ereignisse = berechneAufUndUntergang(tagStart, tagEnde, 52.3759, 9.732);
    assert.ok(ereignisse.sonnenaufgangMs !== null);
    assert.ok(ereignisse.sonnenuntergangMs !== null);
    assert.ok(ereignisse.sonnenuntergangMs > ereignisse.sonnenaufgangMs);
  });

  it('interpoliert das DWD-ICON-D2-Wolkengitter zeitlich (5-Min.-Zwischenschritte) und räumlich bilinear', () => {
    const t0 = Date.parse('2026-10-30T10:00:00Z');
    const t1 = Date.parse('2026-10-30T10:15:00Z');
    const gitter = {
      aktualisiertAm: '2026-10-30T10:00:00Z',
      latMin: 48.0,
      latMax: 52.0,
      lonMin: 8.0,
      lonMax: 12.0,
      zeilen: 2,
      spalten: 2,
      zeitpunkteMs: [t0, t1],
      werteJeZeitpunkt: [
        [0, 30, 60, 90],
        [30, 60, 90, 90],
      ],
    };

    // 5 Minuten nach t0 (= 1/3 des 15-Minuten-Intervalls)
    const feldNach5Min = interpoliereWolkenFeldAufZeitpunkt(gitter, t0 + 5 * 60_000);
    assert.equal(Math.round(feldNach5Min[0] ?? -1), 10);
    assert.equal(Math.round(feldNach5Min[1] ?? -1), 40);

    // Exakte Gittermitte (50°N, 10°O) bei t0 -> Mittelwert aus [0, 30, 60, 90] = 45 %
    const mitteWert = interpoliereWolkenWertBilinear(
      gitter,
      gitter.werteJeZeitpunkt[0]!,
      50.0,
      10.0
    );
    assert.equal(mitteWert, 45);
  });
});

