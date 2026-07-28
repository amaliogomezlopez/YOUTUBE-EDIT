#!/usr/bin/env node

import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as fontAwesome from '@fortawesome/free-brands-svg-icons';
import * as simpleIcons from 'simple-icons';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const requested = argument('name');
const output = argument('output');
const color = argument('color');
if (!requested || !output) {
  throw new Error(
    'Uso: node scripts/export-offline-brand-logo.js --name <marca> --output <archivo.svg> [--color <hex>]'
  );
}

const wanted = normalize(requested);
const simple = Object.values(simpleIcons).find(
  (icon) =>
    icon &&
    typeof icon === 'object' &&
    typeof icon.path === 'string' &&
    [icon.title, icon.slug].some((value) => normalize(value) === wanted)
);

let svg;
let provider;
let license;
let source;
if (simple) {
  const fill = color || `#${simple.hex}`;
  svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttribute(simple.title)}" viewBox="0 0 24 24"><path fill="${escapeAttribute(fill)}" d="${simple.path}"/></svg>`;
  provider = 'Simple Icons';
  license = 'Simple Icons CC0; trademark rights retained by brand owner';
  source = simple.source;
} else {
  const icon = Object.values(fontAwesome).find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      Array.isArray(candidate.icon) &&
      normalize(candidate.iconName) === wanted
  );
  if (!icon) throw new Error(`No se encontró la marca "${requested}" en los paquetes offline.`);
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];
  const fill = color || '#FFFFFF';
  svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttribute(icon.iconName)}" viewBox="0 0 ${width} ${height}">${paths.map((datum) => `<path fill="${escapeAttribute(fill)}" d="${datum}"/>`).join('')}</svg>`;
  provider = 'Font Awesome Free Brands';
  license = 'CC BY 4.0; trademark rights retained by brand owner';
  source = `https://fontawesome.com/icons/${icon.iconName}?f=brands&s=solid`;
}

await mkdir(path.dirname(path.resolve(output)), {recursive: true});
await writeFile(path.resolve(output), `${svg}\n`, 'utf8');
console.log(JSON.stringify({output: path.resolve(output), provider, license, source}));
