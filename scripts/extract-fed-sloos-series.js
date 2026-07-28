#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SLOOS_SERIES_ID = 'SUBLPDCILS_N.Q';

export function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export function extractSloosSeries(csv, seriesId = SLOOS_SERIES_ID) {
  const rows = parseCsvRows(csv);
  const headerIndex = rows.findIndex((row) => row[0] === 'Time Period');
  if (headerIndex < 0) throw new Error('No se encontró la fila Time Period.');
  const columnIndex = rows[headerIndex].indexOf(seriesId);
  if (columnIndex < 0) throw new Error(`No se encontró la serie ${seriesId}.`);
  const description = rows[0]?.[columnIndex] ?? '';
  const observations = rows
    .slice(headerIndex + 1)
    .map((row) => {
      const rawValue = String(row[columnIndex] ?? '').trim();
      return {
        period: String(row[0] ?? '').trim(),
        value: rawValue === '' ? Number.NaN : Number(rawValue)
      };
    })
    .filter((datum) =>
      /^\d{4}Q[1-4]$/.test(datum.period) && Number.isFinite(datum.value)
    );
  if (!observations.length) throw new Error(`La serie ${seriesId} no contiene observaciones.`);
  return {seriesId, description, observations};
}

function parseArgs(argv) {
  const args = {input: '', output: ''};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input') args.input = argv[++index] ?? '';
    else if (token.startsWith('--input=')) args.input = token.slice(8);
    else if (token === '--output') args.output = argv[++index] ?? '';
    else if (token.startsWith('--output=')) args.output = token.slice(9);
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/extract-fed-sloos-series.js --input <SLOOS.csv> --output <serie.json>');
    return;
  }
  if (!args.input || !args.output) {
    throw new Error('Se requieren --input <SLOOS.csv> y --output <serie.json>.');
  }
  const inputFile = path.resolve(args.input);
  const outputFile = path.resolve(args.output);
  const bytes = await readFile(inputFile);
  const series = extractSloosSeries(bytes.toString('utf8'));
  const payload = {
    version: 1,
    provider: 'Board of Governors of the Federal Reserve System',
    release: 'Senior Loan Officer Opinion Survey on Bank Lending Practices',
    sourceUrl: 'https://www.federalreserve.gov/datadownload/Choose.aspx?rel=sloos',
    seriesUrl: 'https://fred.stlouisfed.org/series/DRTSCILM',
    sourceSeriesId: series.seriesId,
    title: series.description,
    frequency: 'quarterly',
    unit: 'net percentage of domestic banks',
    inputSha256: createHash('sha256').update(bytes).digest('hex'),
    range: {
      start: series.observations[0].period,
      end: series.observations.at(-1).period
    },
    observations: series.observations
  };
  await mkdir(path.dirname(outputFile), {recursive: true});
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Serie verificada: ${outputFile}`);
  console.log(`Rango: ${payload.range.start}–${payload.range.end}`);
  console.log(`Observaciones: ${payload.observations.length}`);
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
