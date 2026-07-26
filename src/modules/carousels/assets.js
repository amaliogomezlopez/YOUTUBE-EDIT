import {createHash, randomUUID} from 'node:crypto';
import {copyFile, readFile, stat, unlink} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ensureDir, safeFilename} from '../../lib/utils.js';
import {CAROUSEL_LIMITS} from './constants.js';
import {carouselDir, saveCarouselProject} from './repository.js';
import {validateCarouselProject} from './validator.js';

const FORMAT_EXTENSION = {jpeg: '.jpg', png: '.png', webp: '.webp'};
const FORMAT_MIME = {jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};

function targetSlot(project, slideId, slotId) {
  const slide = project.slides.find((item) => item.id === slideId);
  if (!slide) {
    const error = new Error('No se encontró la diapositiva para el asset.');
    error.status = 400;
    error.code = 'CAROUSEL_SLIDE_NOT_FOUND';
    throw error;
  }
  const slot = (slide.assetSlots || []).find((item) => item.id === slotId);
  if (!slot) {
    const error = new Error('No se encontró el slot visual seleccionado.');
    error.status = 400;
    error.code = 'CAROUSEL_SLOT_NOT_FOUND';
    throw error;
  }
  return {slide, slot};
}

export async function importCarouselAsset(project, {file, slideId, slotId, originalName, provider = 'uploaded', prompt = null, root} = {}) {
  const info = await stat(file);
  if (!info.isFile() || info.size <= 0) {
    const error = new Error('El asset está vacío o no es un archivo.'); error.status = 400; error.code = 'EMPTY_CAROUSEL_ASSET'; throw error;
  }
  if (info.size > CAROUSEL_LIMITS.imageBytes) {
    const error = new Error('La imagen supera el límite de 20 MB.'); error.status = 413; error.code = 'CAROUSEL_ASSET_TOO_LARGE'; throw error;
  }
  let metadata;
  try {
    metadata = await sharp(file, {limitInputPixels: 50_000_000}).metadata();
  } catch {
    const error = new Error('La imagen no se puede leer o su contenido no coincide con PNG, JPEG o WebP.');
    error.status = 400;
    error.code = 'INVALID_CAROUSEL_ASSET';
    throw error;
  }
  const extension = FORMAT_EXTENSION[metadata.format];
  if (!extension || !metadata.width || !metadata.height) {
    const error = new Error('Formato de imagen no admitido. Usa PNG, JPEG o WebP.'); error.status = 400; error.code = 'INVALID_CAROUSEL_ASSET'; throw error;
  }
  const {slot} = targetSlot(project, slideId, slotId);
  const replacedAsset = (project.assets || []).find((item) => item.id === slot.assetId);
  const id = `asset-${randomUUID().slice(0, 12)}`;
  const directory = path.join(carouselDir(project.id, root), 'assets');
  await ensureDir(directory);
  const filename = `${id}${extension}`;
  const destination = path.join(directory, filename);
  await copyFile(file, destination);
  const bytes = await readFile(destination);
  const asset = {
    id,
    filename,
    originalName: safeFilename(originalName || path.basename(file)),
    provider,
    prompt: prompt ? String(prompt).slice(0, 1200) : null,
    mimeType: FORMAT_MIME[metadata.format],
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    createdAt: new Date().toISOString()
  };
  project.assets = [...(project.assets || []).filter((item) => item.id !== slot.assetId), asset];
  slot.assetId = id;
  slot.status = 'ready';
  project.status = 'draft';
  if (project.renders?.outputs?.length) project.renders.stale = true;
  project.validation = validateCarouselProject(project);
  await saveCarouselProject(project, {root});
  if (replacedAsset?.filename) {
    await unlink(path.join(directory, replacedAsset.filename)).catch(() => {});
  }
  return asset;
}

export async function carouselAssetDataUri(project, assetId, {root} = {}) {
  if (!assetId) return null;
  const asset = (project.assets || []).find((item) => item.id === assetId);
  if (!asset) return null;
  const directory = path.resolve(carouselDir(project.id, root), 'assets');
  const file = path.resolve(directory, asset.filename);
  const relative = path.relative(directory, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta de asset fuera del proyecto.');
  const bytes = await readFile(file);
  return `data:${asset.mimeType};base64,${bytes.toString('base64')}`;
}

export async function slideAssetDataUri(project, slide, options = {}) {
  const assetId = (slide.assetSlots || []).find((slot) => slot.assetId)?.assetId;
  return carouselAssetDataUri(project, assetId, options);
}
