import {randomUUID} from 'node:crypto';
import {readFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ensureDir} from '../../lib/utils.js';
import {CAROUSEL_FORMATS} from './constants.js';
import {slideAssetDataUri} from './assets.js';
import {renderCarouselSvg} from './renderer.js';
import {carouselDir, saveCarouselProject} from './repository.js';
import {validateCarouselProject} from './validator.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[character]));
}

async function contactSheet(project, pngFiles, outputFile) {
  const columns = Math.min(3, pngFiles.length);
  const rows = Math.ceil(pngFiles.length / columns);
  const cardWidth = 280;
  const cardHeight = 350;
  const gap = 26;
  const top = 110;
  const width = gap + columns * (cardWidth + gap);
  const height = top + rows * (cardHeight + 58 + gap);
  const cards = await Promise.all(pngFiles.map(async (file, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      input: await sharp(await readFile(file)).resize(cardWidth, cardHeight, {fit: 'cover'}).png().toBuffer(),
      left: gap + column * (cardWidth + gap),
      top: top + row * (cardHeight + 58 + gap)
    };
  }));
  const labels = project.slides.map((slide, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = gap + column * (cardWidth + gap);
    const y = top + row * (cardHeight + 58 + gap) + cardHeight + 34;
    return `<text x="${x}" y="${y}" fill="#f5f6f8" font-family="Arial" font-size="21" font-weight="700">${String(index + 1).padStart(2, '0')} · ${esc(slide.layout)}</text>`;
  }).join('');
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${gap}" y="52" fill="#f5f6f8" font-family="Arial" font-size="30" font-weight="800">${esc(project.title)}</text><text x="${gap}" y="82" fill="#aeb5c0" font-family="Arial" font-size="17">Hoja de contacto · ${project.slides.length} piezas</text>${labels}</svg>`;
  await sharp({create: {width, height, channels: 4, background: '#0d0f12'}}).composite([...cards, {input: Buffer.from(overlay), left: 0, top: 0}]).png({compressionLevel: 9}).toFile(outputFile);
}

export async function exportCarouselProject(project, {formats = Object.keys(CAROUSEL_FORMATS), root, quality = 90} = {}) {
  const validation = validateCarouselProject(project);
  project.validation = validation;
  if (!validation.valid) {
    const error = new Error(`El carrusel no supera la validación: ${validation.errors.join(' ')}`);
    error.code = 'CAROUSEL_VALIDATION_FAILED';
    error.status = 400;
    throw error;
  }
  const outputRoot = path.join(carouselDir(project.id, root), 'renders');
  const stagingRoot = path.join(carouselDir(project.id, root), `.renders-${randomUUID()}`);
  const selectedFormats = [...new Set(formats)].filter((name) => CAROUSEL_FORMATS[name]);
  if (!selectedFormats.length) {
    const error = new Error('No se ha seleccionado ningún formato de exportación válido.');
    error.status = 400;
    error.code = 'INVALID_CAROUSEL_FORMAT';
    throw error;
  }
  const jpegQuality = Math.min(100, Math.max(1, Number(quality) || 90));
  await ensureDir(stagingRoot);
  const outputs = [];
  try {
    for (const formatName of selectedFormats) {
      const format = CAROUSEL_FORMATS[formatName];
      const directory = path.join(stagingRoot, formatName);
      await ensureDir(directory);
      for (const [index, slide] of project.slides.entries()) {
        const assetDataUri = await slideAssetDataUri(project, slide, {root});
        const svg = renderCarouselSvg(project, slide.id, formatName, {assetDataUri});
        const stem = `${String(index + 1).padStart(2, '0')}-${slide.id}`;
        const pngName = `${stem}.png`;
        const jpegName = `${stem}.jpg`;
        await sharp(Buffer.from(svg), {density: 144}).resize(format.width, format.height).png({compressionLevel: 9}).toFile(path.join(directory, pngName));
        await sharp(Buffer.from(svg), {density: 144}).resize(format.width, format.height).jpeg({quality: jpegQuality, chromaSubsampling: '4:4:4'}).toFile(path.join(directory, jpegName));
        outputs.push({format: formatName, slideId: slide.id, width: format.width, height: format.height, pngName, jpegName});
      }
    }
    const feedPngs = outputs.filter((item) => item.format === 'instagram-feed').map((item) => path.join(stagingRoot, item.format, item.pngName));
    const contactSheetName = 'contact-sheet.png';
    if (feedPngs.length) await contactSheet(project, feedPngs, path.join(stagingRoot, contactSheetName));
    await rm(outputRoot, {recursive: true, force: true});
    await rename(stagingRoot, outputRoot);
    project.renders = {outputs, contactSheetName: feedPngs.length ? contactSheetName : null, stale: false};
  } catch (error) {
    await rm(stagingRoot, {recursive: true, force: true}).catch(() => {});
    throw error;
  }
  project.renderedAt = new Date().toISOString();
  project.status = 'rendered';
  await saveCarouselProject(project, {root});
  return project.renders;
}
