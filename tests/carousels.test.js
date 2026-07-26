import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {importCarouselAsset, slideAssetDataUri} from '../src/modules/carousels/assets.js';
import {CAROUSEL_FORMATS, CAROUSEL_LAYOUTS} from '../src/modules/carousels/constants.js';
import {exportCarouselProject} from '../src/modules/carousels/exporter.js';
import {planCarousel} from '../src/modules/carousels/planner.js';
import {fitText, inspectCarouselLayout, renderCarouselSvg} from '../src/modules/carousels/renderer.js';
import {loadCarouselProject} from '../src/modules/carousels/repository.js';
import {createCarouselProject, updateCarouselProject} from '../src/modules/carousels/service.js';
import {contrastRatio, validateCarouselProject} from '../src/modules/carousels/validator.js';

const source = `Shortsmith incorpora un estudio de carruseles estáticos independiente del editor de vídeo. El sistema conserva cada afirmación con referencias a la fuente proporcionada. El renderer compone tipografía e imágenes mediante SVG para evitar deformaciones. La exportación genera variantes 1080 por 1350 y 1080 por 1920. Una persona debe revisar el resultado antes de publicarlo. Las imágenes se utilizan como apoyo visual y no como evidencia factual. Cada proyecto puede reabrirse para seguir editándolo.`;

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-carousels-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

test('planner creates a traceable 5-10 slide master with cover and CTA contracts', async () => {
  const plan = await planCarousel(source, {slideCount: 10, useLlm: false, theme: 'forge'});
  assert.equal(plan.slides.length, 10);
  assert.equal(plan.slides[0].layout, 'cover-hero');
  assert.equal(plan.slides[0].assetSlots.length, 1);
  assert.equal(plan.slides.at(-1).layout, 'cta');
  assert.equal(plan.slides.at(-1).assetSlots.length, 0);
  assert.ok(plan.slides.every((slide) => CAROUSEL_LAYOUTS.includes(slide.layout)));
  assert.ok(plan.slides.slice(0, -1).every((slide) => slide.evidenceRefs.every((id) => plan.evidence.some((item) => item.id === id))));
});

test('all ten layouts render deterministic SVG in both target formats', async () => {
  const plan = await planCarousel(source, {slideCount: 10, useLlm: false});
  plan.slides.forEach((slide, index) => { slide.layout = CAROUSEL_LAYOUTS[index]; });
  plan.slides[5].stat = '42%';
  plan.slides[3].body = 'Ventaja acreditada; límite acreditado';
  plan.slides[4].body = 'Situación anterior; situación actual';
  plan.slides[6].body = 'Primer paso; segundo paso; tercer paso';
  for (const format of Object.values(CAROUSEL_FORMATS)) {
    for (const slide of plan.slides) {
      const first = renderCarouselSvg(plan, slide.id, format.id);
      const second = renderCarouselSvg(plan, slide.id, format.id);
      assert.equal(first, second);
      assert.match(first, new RegExp(`width="${format.width}" height="${format.height}"`));
      assert.match(first, new RegExp(`data-layout="${slide.layout}"`));
      assert.doesNotMatch(first, /<script|foreignObject/i);
    }
  }
});

test('projects persist, reopen, reorder and reconcile image slots when layout changes', async (t) => {
  const root = await temporaryRoot(t);
  const project = await createCarouselProject({source, slideCount: 7, useLlm: false}, {root});
  const originalOrder = project.slides.map((slide) => slide.id);
  const target = project.slides[2];
  await updateCarouselProject(project.id, {theme: 'night', slideOrder: [originalOrder[0], originalOrder[2], originalOrder[1], ...originalOrder.slice(3)], slide: {id: target.id, layout: 'photo-annotation', headline: 'Una edición que sigue siendo trazable'}}, {root});
  let reopened = await loadCarouselProject(project.id, {root});
  assert.equal(reopened.theme, 'night');
  assert.equal(reopened.slides[1].id, target.id);
  assert.equal(reopened.slides[1].assetSlots.length, 1);
  await updateCarouselProject(project.id, {slide: {id: target.id, layout: 'feature-list'}}, {root});
  reopened = await loadCarouselProject(project.id, {root});
  assert.equal(reopened.slides.find((slide) => slide.id === target.id).assetSlots.length, 0);
});

test('asset import validates real image bytes and embeds only managed project assets', async (t) => {
  const root = await temporaryRoot(t);
  const project = await createCarouselProject({source, slideCount: 5, useLlm: false}, {root});
  const input = path.join(root, 'input.png');
  await sharp({create: {width: 640, height: 640, channels: 4, background: '#f05a28'}}).png().toFile(input);
  const slot = project.slides[0].assetSlots[0];
  const asset = await importCarouselAsset(project, {file: input, slideId: project.slides[0].id, slotId: slot.id, originalName: 'hero.png', root});
  assert.equal(asset.mimeType, 'image/png');
  assert.equal(asset.width, 640);
  assert.match(await slideAssetDataUri(project, project.slides[0], {root}), /^data:image\/png;base64,/);
  await assert.rejects(() => importCarouselAsset(project, {file: path.join(root, 'missing.png'), slideId: project.slides[0].id, slotId: slot.id, root}), /ENOENT/);
});

test('backend export produces PNG, JPEG and a contact sheet with exact dimensions', async (t) => {
  const root = await temporaryRoot(t);
  const project = await createCarouselProject({source, slideCount: 5, useLlm: false}, {root});
  const renders = await exportCarouselProject(project, {root, formats: ['instagram-feed', 'vertical']});
  assert.equal(renders.outputs.length, 10);
  assert.equal(renders.contactSheetName, 'contact-sheet.png');
  for (const output of renders.outputs) {
    const file = path.join(root, project.id, 'renders', output.format, output.pngName);
    assert.ok((await stat(file)).size > 1_000);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, CAROUSEL_FORMATS[output.format].width);
    assert.equal(metadata.height, CAROUSEL_FORMATS[output.format].height);
    assert.ok((await stat(path.join(root, project.id, 'renders', output.format, output.jpegName))).size > 1_000);
  }
  const persisted = JSON.parse(await readFile(path.join(root, project.id, 'project.json'), 'utf8'));
  assert.equal(persisted.status, 'rendered');
});

test('validation blocks overflow and measures contrast using WCAG ratios', async () => {
  const plan = await planCarousel(source, {slideCount: 5, useLlm: false});
  plan.slides[1].headline = 'una '.repeat(100);
  const validation = validateCarouselProject(plan);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((item) => item.includes('desborda') || item.includes('límite')));
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('invalid', '#ffffff'), 0);
});

test('bold headline fitting wraps conservative real-world Arial widths', () => {
  const fitted = fitText('YA NO SOLO RESPONDE: EJECUTA', {width: 918, maxHeight: 280, startSize: 88, minSize: 46, maxLines: 3, weight: 900});
  assert.equal(fitted.overflow, undefined);
  assert.ok(fitted.lines.every((line) => line.length <= 15));
  assert.deepEqual(fitted.lines, ['YA NO SOLO', 'RESPONDE:', 'EJECUTA']);
});

test('comparison layout accepts semantic column labels', async () => {
  const plan = await planCarousel(source, {slideCount: 5, useLlm: false});
  plan.slides[2] = {...plan.slides[2], layout: 'comparison', accent: 'SONNET 5 | OPUS 4.8', body: '$3 entrada; $5 entrada'};
  const svg = renderCarouselSvg(plan, plan.slides[2].id, 'instagram-feed');
  assert.match(svg, />SONNET 5<\/text>/);
  assert.match(svg, />OPUS 4\.8<\/text>/);
  assert.doesNotMatch(svg, />ANTES<\/text>/);
});

test('layout diagnostics keep text and assets separated in both formats', async () => {
  const plan = await planCarousel(source, {slideCount: 10, useLlm: false});
  plan.slides.forEach((slide, index) => { slide.layout = CAROUSEL_LAYOUTS[index]; });
  plan.slides[0].headline = 'Modelo 5: más agente y menor coste';
  plan.slides[1].body = 'Crea planes y ejecuta tareas con herramientas.';
  plan.slides[2].body = 'Mejor razonamiento; Más herramientas; Avances en programación';
  plan.slides[3].body = 'Ventaja clara; Riesgo acreditado';
  plan.slides[4].body = '$3 entrada; $5 entrada';
  plan.slides[5].stat = '$2 / $10';
  plan.slides[5].accent = 'ENTRADA | SALIDA';
  plan.slides[6].body = 'Primer paso; Segundo paso; Tercer paso';
  plan.slides[7].body = 'Una cita breve y verificable.';
  plan.slides[8].body = 'Hay mejoras medibles, aunque también límites que revisar.';
  for (const format of Object.values(CAROUSEL_FORMATS)) {
    for (const slide of plan.slides) {
      const inspection = inspectCarouselLayout(plan, slide.id, format.id, {assetDataUri: 'data:image/png;base64,iVBORw0KGgo='});
      assert.deepEqual(inspection.overflows, [], `${slide.layout} overflow in ${format.id}`);
      assert.deepEqual(inspection.collisions, [], `${slide.layout} collision in ${format.id}`);
    }
  }
});

test('asset crops follow the configured focal position', async () => {
  const plan = await planCarousel(source, {slideCount: 5, useLlm: false});
  plan.slides[0].assetSlots[0].composition.subjectPosition = 'bottom-right';
  const svg = renderCarouselSvg(plan, plan.slides[0].id, 'instagram-feed', {assetDataUri: 'data:image/png;base64,iVBORw0KGgo='});
  assert.match(svg, /preserveAspectRatio="xMaxYMax slice"/);
});
