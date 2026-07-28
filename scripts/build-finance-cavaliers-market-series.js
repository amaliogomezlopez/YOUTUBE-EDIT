#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MAGS = path.join(ROOT, 'data', 'tmp', 'mags-yahoo-2025-2026.json');
const DEFAULT_SPY = path.join(ROOT, 'data', 'tmp', 'spy-yahoo-2025-2026.json');
const DEFAULT_OUTPUT = path.join(
  ROOT,
  'channels',
  'finance-cavaliers',
  'data',
  'mags-spy-relative-2025-2026.json'
);

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? path.resolve(process.argv[index + 1]) : fallback;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseYahooChart(raw, expectedSymbol) {
  const payload = JSON.parse(raw);
  const result = payload?.chart?.result?.[0];
  if (!result || result.meta?.symbol !== expectedSymbol) {
    throw new Error(`El archivo no contiene la serie ${expectedSymbol}.`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: Number(closes[index])
    }))
    .filter((datum) => Number.isFinite(datum.close));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function downsample(data, stride = 5) {
  const selected = data.filter((_, index) => index % stride === 0);
  const last = data.at(-1);
  if (last && selected.at(-1)?.date !== last.date) selected.push(last);
  return selected;
}

const magsFile = argument('mags', DEFAULT_MAGS);
const spyFile = argument('spy', DEFAULT_SPY);
const outputFile = argument('output', DEFAULT_OUTPUT);
const [magsRaw, spyRaw] = await Promise.all([
  readFile(magsFile, 'utf8'),
  readFile(spyFile, 'utf8')
]);
const mags = parseYahooChart(magsRaw, 'MAGS');
const spy = parseYahooChart(spyRaw, 'SPY');
const spyByDate = new Map(spy.map((datum) => [datum.date, datum.close]));
const aligned = mags
  .filter((datum) => spyByDate.has(datum.date))
  .map((datum) => ({
    date: datum.date,
    magsClose: datum.close,
    spyClose: spyByDate.get(datum.date)
  }));

if (aligned.length < 20) {
  throw new Error('No hay suficientes sesiones coincidentes entre MAGS y SPY.');
}

const base = aligned[0];
const baseRatio = base.magsClose / base.spyClose;
const normalized = aligned.map((datum) => ({
  date: datum.date,
  spy: round((datum.spyClose / base.spyClose) * 100),
  mag7Relative: round(
    ((datum.magsClose / datum.spyClose) / baseRatio) * 100
  )
}));
const peak = normalized.reduce(
  (best, datum) =>
    datum.mag7Relative > best.mag7Relative ? datum : best,
  normalized[0]
);
const latest = normalized.at(-1);
const series = downsample(normalized);
const output = {
  version: 1,
  title: 'SPY y fuerza relativa MAGS/SPY',
  methodology: [
    'Cierres diarios de SPY y MAGS.',
    `Ambas series parten de base 100 el ${base.date}.`,
    'La fuerza relativa divide el cierre de MAGS por el cierre de SPY y normaliza el cociente a 100.',
    'La visual usa una muestra semanal; los cálculos resumen usan todas las sesiones coincidentes.'
  ],
  source: {
    provider: 'Yahoo Finance',
    landingPages: [
      'https://finance.yahoo.com/quote/MAGS/history/',
      'https://finance.yahoo.com/quote/SPY/history/'
    ],
    queryUrls: [
      'https://query1.finance.yahoo.com/v8/finance/chart/MAGS?period1=1735689600&period2=1784332800&interval=1d&events=history',
      'https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=1735689600&period2=1784332800&interval=1d&events=history'
    ],
    rawSha256: {
      mags: sha256(magsRaw),
      spy: sha256(spyRaw)
    },
    note: 'Datos de mercado de terceros. Conservar atribución y no presentar la serie como un índice oficial de Bloomberg.'
  },
  range: {
    start: base.date,
    end: latest.date,
    observations: aligned.length,
    plottedObservations: series.length
  },
  summary: {
    spyEnd: latest.spy,
    mag7RelativeEnd: latest.mag7Relative,
    relativePeakDate: peak.date,
    relativePeak: peak.mag7Relative,
    relativeChangeFromPeakPercent: round(
      (latest.mag7Relative / peak.mag7Relative - 1) * 100,
      1
    )
  },
  series
};

await mkdir(path.dirname(outputFile), {recursive: true});
await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Serie reproducible guardada en ${outputFile}`);
console.log(
  `MAGS/SPY desde máximo relativo: ${output.summary.relativeChangeFromPeakPercent}%`
);
