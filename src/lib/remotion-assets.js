import {createHash} from 'node:crypto';
import {readFile, mkdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from './utils.js';

const REMOTION_ROOT = path.join(ROOT, 'remotion-animations');
const DEFAULT_LIBRARY_ROOT = path.join(
  REMOTION_ROOT,
  'public',
  'assets',
  'library'
);
const DEFAULT_CATALOG_FILE = path.join(
  REMOTION_ROOT,
  'catalog',
  'visuals',
  'images.json'
);
const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg'
]);
const ALLOWED_ASSET_TYPES = new Set([
  'photo',
  'screenshot',
  'chart',
  'illustration',
  'texture',
  'logo'
]);
const MAX_ASSET_BYTES = 50 * 1024 * 1024;

function slug(value, label) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new Error(`${label} no puede quedar vacío.`);
  return normalized;
}

function cleanList(values, minimum = 0) {
  const result = [...new Set(
    (Array.isArray(values) ? values : String(values || '').split(','))
      .map((value) => String(value).trim())
      .filter(Boolean)
  )];
  if (result.length < minimum) {
    throw new Error(`Se necesitan al menos ${minimum} etiquetas semánticas.`);
  }
  return result;
}

function normalizeFocalPoint(focalPoint) {
  return {
    x: Math.min(100, Math.max(0, Number(focalPoint?.x ?? 50))),
    y: Math.min(100, Math.max(0, Number(focalPoint?.y ?? 50)))
  };
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function buildManagedAssetRecord({
  id,
  publicPath,
  alt,
  width,
  height,
  sha256: fileHash,
  sourceSha256,
  source,
  author,
  license,
  attribution,
  tags,
  focalPoint,
  assetType,
  treatment = 'natural',
  importedAt = new Date().toISOString()
}) {
  if (!ALLOWED_ASSET_TYPES.has(assetType)) {
    throw new Error(`Tipo de asset no válido: ${assetType}.`);
  }
  return {
    id: slug(id, 'El ID'),
    publicPath,
    alt: String(alt || '').trim(),
    width: Math.round(Number(width)),
    height: Math.round(Number(height)),
    sha256: fileHash,
    sourceSha256,
    source: String(source || '').trim(),
    author: String(author || '').trim() || undefined,
    license: String(license || '').trim(),
    attribution: String(attribution || '').trim() || undefined,
    tags: cleanList(tags, 2),
    focalPoint: normalizeFocalPoint(focalPoint),
    assetType,
    treatment: String(treatment || 'natural').trim(),
    importedAt
  };
}

export async function importRemotionAsset(input, {
  libraryRoot = DEFAULT_LIBRARY_ROOT,
  catalogFile = DEFAULT_CATALOG_FILE
} = {}) {
  const sourceFile = path.resolve(String(input.sourceFile || ''));
  const sourceInfo = await stat(sourceFile).catch(() => null);
  if (!sourceInfo?.isFile()) {
    throw new Error(`El asset de origen no existe: ${sourceFile}`);
  }
  if (sourceInfo.size > MAX_ASSET_BYTES) {
    throw new Error('El asset supera el máximo de 50 MB.');
  }
  const sourceExtension = path.extname(sourceFile).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(sourceExtension)) {
    throw new Error(`Formato no admitido: ${sourceExtension || 'sin extensión'}.`);
  }
  const id = slug(input.id, 'El ID');
  const collection = slug(input.collection || input.assetType || 'general', 'La colección');
  const outputExtension =
    sourceExtension === '.jpg' || sourceExtension === '.jpeg' ? '.jpg' : '.png';
  const targetDirectory = path.resolve(libraryRoot, collection);
  const targetFile = path.join(targetDirectory, `${id}${outputExtension}`);
  const relativeTarget = path.relative(path.resolve(libraryRoot), targetFile);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error('La ruta de destino sale de la biblioteca Remotion.');
  }
  await mkdir(targetDirectory, {recursive: true});

  const pipeline = sharp(sourceFile, {
    density: sourceExtension === '.svg' ? 240 : undefined,
    failOn: 'warning',
    limitInputPixels: 90_000_000
  }).rotate();
  if (outputExtension === '.jpg') {
    await pipeline
      .flatten({background: '#FFFFFF'})
      .jpeg({quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true})
      .toFile(targetFile);
  } else {
    await pipeline.png({compressionLevel: 9, adaptiveFiltering: true}).toFile(targetFile);
  }

  const metadata = await sharp(targetFile).metadata();
  const fileHash = await sha256(targetFile);
  const originalHash = await sha256(sourceFile);
  const publicPath = `assets/library/${collection}/${path.basename(targetFile)}`.replaceAll('\\', '/');
  const record = buildManagedAssetRecord({
    ...input,
    id,
    publicPath,
    width: metadata.width,
    height: metadata.height,
    sha256: fileHash,
    sourceSha256: originalHash,
    importedAt: new Date().toISOString()
  });
  if (!record.alt || !record.source || !record.license) {
    throw new Error('alt, source y license son obligatorios para registrar el asset.');
  }

  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  const existingIndex = catalog.images.findIndex((item) => item.id === id);
  if (existingIndex >= 0 && input.replace !== true) {
    throw new Error(`El asset ${id} ya existe. Usa replace=true para actualizarlo.`);
  }
  if (existingIndex >= 0) catalog.images[existingIndex] = record;
  else catalog.images.push(record);
  catalog.images.sort((left, right) => left.id.localeCompare(right.id));
  await writeJson(catalogFile, catalog);
  return {
    record,
    sourceFile,
    targetFile,
    normalizedFromSvg: sourceExtension === '.svg'
  };
}

export const remotionAssetTypes = [...ALLOWED_ASSET_TYPES];
export const remotionAssetLibraryRoot = DEFAULT_LIBRARY_ROOT;
