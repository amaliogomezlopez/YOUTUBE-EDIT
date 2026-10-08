#!/usr/bin/env node
/**
 * Montaje "escritorio" de un video largo: fondo de pantalla, grabacion en tarjeta
 * redondeada, webcam en burbuja y zooms con aceleracion donde el autor habla de algo.
 *
 *   start  -> ingesta, primer corte, webcam por toma, candidatos, TRANSCRIPCION.md
 *   (pantalla: el agente escribe zooms.json; camara: asset-requests.json y planos.json)
 *   assets -> descarga y cataloga los recursos pedidos (tomas a camara)
 *   plan   -> valida ritmo y cajas, compila el escenario y la hoja de objetivos
 *   preview-> un fotograma renderizado del plan
 *   render -> MP4, QA y REVIEW.md
 */
import path from 'node:path';
import {parseArgs} from 'node:util';
import {existsSync} from 'node:fs';
import {readFile, readdir, mkdir, writeFile, rm} from 'node:fs/promises';
import sharp from 'sharp';
import {run, loadDotEnv} from '../src/lib/utils.js';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {detectWebcamBox} from '../src/lib/webcam.js';
import {detectWebcamPanel, consensusPanels} from '../src/modules/video-studio/webcam-panel.js';
import {planEdit, orderTakes} from '../src/modules/youtube-studio/autoplan.js';
import {resolveBrandKit} from '../src/modules/editorial-memory/kit.js';
import {detectSilences} from '../src/modules/video-studio/silences.js';
import {qaRender} from '../src/modules/youtube-studio/qa.js';
import {reviewMarkdown} from '../src/modules/youtube-studio/review.js';
import {framedProfile, classifyTake, zoomCandidates, frameEditPlan, compileFramedPlan, cardRect, faceCrop, transcriptMarkdown, CANVAS} from '../src/modules/youtube-studio/framed.js';
import {cameraCrop} from '../src/modules/video-studio/camera-track.js';
import {excerptRenderPlan} from '../src/modules/youtube-studio/render-plan.js';
import {assetRequestsTemplate, validateAssetRequests, resolveAssetRequests} from '../src/modules/intro-viral/assets.js';

const USAGE = `Uso: npm run youtube:escritorio -- <comando>
  start   --source CARPETA --slug SLUG --wallpaper IMAGEN [--variant auto|pantalla|camara] [--intents JSON] [--profile escritorio-v1]
  assets  --slug SLUG [--force]     (descarga asset-requests.json: webs, noticias, YouTube, X, ficheros)
  plan    --slug SLUG
  preview --slug SLUG --at SEGUNDOS
  render  --slug SLUG [--no-sound] [--from S --to S]   (con --from/--to: solo ese tramo, sin QA)
  status  --slug SLUG
El agente solo escribe en data/youtube-escritorio/SLUG/: zooms.json (tomas de pantalla),
asset-requests.json y planos.json (tomas a camara). Ver docs/youtube-escritorio.md.`;
const CORPUS = path.resolve('data/editorial-memory/corpus');
const PUBLIC = path.resolve('remotion-animations/public');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const node = (script, args) => run(process.execPath, [script, ...args], {onStdout: (t) => process.stdout.write(t), onStderr: (t) => process.stderr.write(t)});
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const GRID = 160;
const THUMB = 960;

async function loadClips(project) {
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const silencesFile = path.join(project, 'silences.json');
  const cached = existsSync(silencesFile) ? await readJson(silencesFile) : {};
  const clips = [];
  for (const clip of manifest.clips) {
    cached[clip.id] ??= await detectSilences(path.join(PUBLIC, clip.file), {duration: clip.durationSeconds});
    clips.push({...clip, silences: cached[clip.id], words: clip.transcript ? (await readJson(path.join(project, clip.transcript))).words : []});
  }
  await save(silencesFile, cached);
  const assets = [];
  for (const asset of manifest.assets ?? []) {
    const size = asset.kind === 'image' ? await sharp(path.join(PUBLIC, asset.file)).metadata() : {};
    assets.push({...asset, width: asset.width ?? size.width, height: asset.height ?? size.height});
  }
  return {manifest, clips, assets};
}

/** Style profile and brand kit of the author's own edits, as the automatic first cut uses them. */
async function styleAndKit() {
  const file = path.join(CORPUS, 'style-profile.json');
  if (!existsSync(file)) throw Error('Falta el perfil de estilo: npm run editorial:corpus -- scan y -- profile');
  const profile = (await readJson(file)).horizontal;
  const edits = [];
  for (const name of await readdir(path.join(CORPUS, 'edits'))) {
    const edit = await readJson(path.join(CORPUS, 'edits', name));
    if (edit.format === 'horizontal' && !(profile.excluded ?? []).includes(edit.project)) edits.push(edit);
  }
  const kit = await resolveBrandKit(edits, {readFile, probe: async (f) => {const i = await ffprobe(f); return {duration: i.duration, width: i.width, height: i.height};}});
  return {profile, kit};
}

async function grab(file, seconds, out, width = THUMB) {
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, seconds)), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, out]);
}

/** Median colour of the strips left of and below the webcam panel: what the patch fills. */
async function patchColor(png, webcam, clip) {
  const img = sharp(png), meta = await img.metadata(), s = meta.width / clip.width;
  const {data, info} = await img.raw().toBuffer({resolveWithObject: true});
  const px = [];
  const take = (x0, y0, w, h) => {
    for (let y = Math.max(0, Math.round(y0 * s)); y < Math.min(info.height, Math.round((y0 + h) * s)); y++)
      for (let x = Math.max(0, Math.round(x0 * s)); x < Math.min(info.width, Math.round((x0 + w) * s)); x++) {
        const i = (y * info.width + x) * info.channels;
        px.push([data[i], data[i + 1], data[i + 2]]);
      }
  };
  take(webcam.x - 24, webcam.y, 16, webcam.h);
  take(webcam.x, webcam.y + webcam.h + 8, webcam.w, 16);
  if (!px.length) return '#111111';
  const med = (k) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1];
  return '#' + [0, 1, 2].map((k) => med(k).toString(16).padStart(2, '0')).join('');
}

/** Frame with a labelled grid in source pixels, so boxes are read straight off the image. */
async function gridFrame(png, out, clip, {webcam, boxes = []} = {}) {
  const s = THUMB / clip.width, h = Math.round(clip.height * s);
  const lines = [];
  for (let x = GRID; x < clip.width; x += GRID) lines.push(`<line x1="${x * s}" y1="0" x2="${x * s}" y2="${h}" stroke="#00e5ff" stroke-opacity=".35"/><text x="${x * s + 2}" y="12" fill="#00e5ff" font-size="11" font-family="Arial">${x}</text>`);
  for (let y = GRID; y < clip.height; y += GRID) lines.push(`<line x1="0" y1="${y * s}" x2="${THUMB}" y2="${y * s}" stroke="#00e5ff" stroke-opacity=".35"/><text x="2" y="${y * s - 2}" fill="#00e5ff" font-size="11" font-family="Arial">${y}</text>`);
  if (webcam) lines.push(`<rect x="${webcam.x * s}" y="${webcam.y * s}" width="${webcam.w * s}" height="${webcam.h * s}" fill="none" stroke="#ff4d4d" stroke-width="2" stroke-dasharray="6 4"/><text x="${webcam.x * s + 4}" y="${(webcam.y + webcam.h) * s - 6}" fill="#ff4d4d" font-size="13" font-family="Arial">webcam</text>`);
  for (const b of boxes) lines.push(`<rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" fill="none" stroke="${b.color}" stroke-width="3"/>${b.label ? `<text x="${b.x * s + 4}" y="${b.y * s + 16}" fill="${b.color}" font-size="14" font-weight="bold" font-family="Arial">${b.label}</text>` : ''}`);
  const svg = Buffer.from(`<svg width="${THUMB}" height="${h}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`);
  await sharp(png).resize(THUMB, h).composite([{input: svg}]).jpeg({quality: 86}).toFile(out);
}

const dirs = (slug) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) throw Error('Slug invalido');
  const work = path.resolve('data/youtube-escritorio', slug);
  return {work, project: path.resolve('remotion-animations/projects', `youtube-${slug}`), state: path.join(work, 'state.json'), zooms: path.join(work, 'zooms.json')};
};
const latestPlan = async (work) => {
  const plans = (await readdir(work)).filter((n) => n.startsWith('plan-')).sort();
  if (!plans.length) throw Error('Sin plan: npm run youtube:escritorio -- plan --slug SLUG');
  return path.join(work, plans.at(-1));
};

async function start(v) {
  const d = dirs(v.slug);
  if (!v.source || !v.wallpaper) throw Error(USAGE);
  const profile = framedProfile(v.profile);
  if (!existsSync(path.join(d.project, 'manifest.json'))) await node('scripts/youtube-studio.js', ['ingest', '--source', path.resolve(v.source), '--slug', v.slug]);
  await mkdir(path.join(d.work, 'frames'), {recursive: true});
  const wallpaperFile = path.resolve(v.wallpaper), wp = await sharp(wallpaperFile).metadata();
  const warnings = [];
  const upscale = Math.max(CANVAS.width / wp.width, CANVAS.height / wp.height);
  if (upscale > profile.wallpaper.maxUpscale) warnings.push(`El fondo mide ${wp.width}x${wp.height}: se amplia ${round(upscale, 2)}x para cubrir el lienzo. Un degradado suave lo aguanta; una foto con detalle se vera borrosa (mejor 1920x1080 o mayor).`);
  const {clips, assets} = await loadClips(d.project);
  const {profile: style, kit} = await styleAndKit();
  const intents = v.intents ? await readJson(v.intents) : {};
  const basePlan = planEdit({clips, profile: style, kit, intents, assets});
  const {takes: ordered} = orderTakes(clips);
  const takesFile = path.join(d.work, 'takes.json');
  const reviewed = existsSync(takesFile) ? Object.fromEntries(Object.entries(await readJson(takesFile)).filter(([, t]) => t.reviewed)) : {};
  // Webcam panel per take from the face the ingest tracked; takes of one video share the OBS scene.
  const variant = v.variant ?? 'auto';
  if (!['auto', 'pantalla', 'camara'].includes(variant)) throw Error('--variant auto, pantalla o camara');
  const panels = {}, faces = {};
  for (const clip of ordered) {
    if (variant === 'camara' || reviewed[clip.id] || (variant === 'auto' && (clip.focus?.faceHeightRatio ?? 0) >= 0.32)) continue;
    const media = {width: clip.width, height: clip.height, duration: clip.durationSeconds}, file = path.join(PUBLIC, clip.file);
    let face = clip.faceBox;
    if (!face) {
      const detected = await detectWebcamBox(file, media).catch(() => null);
      face = detected && Number.isFinite(detected.w) ? {x: detected.x + detected.w * 0.1, y: detected.y + detected.h * 0.23, w: detected.w * 0.8, h: detected.h * 0.57} : null;
    }
    faces[clip.id] = face;
    panels[clip.id] = face ? await detectWebcamPanel(file, media, face).catch((e) => {warnings.push(`Toma ${clip.sourceName}: deteccion de webcam fallida (${e.message})`); return null;}) : null;
  }
  const agreed = consensusPanels(panels, faces, {width: CANVAS.width, height: CANVAS.height});
  const takes = {};
  for (const clip of ordered) {
    const file = path.join(PUBLIC, clip.file);
    const panel = agreed[clip.id];
    const info = reviewed[clip.id] ?? (variant === 'camara' ? {kind: 'camera', webcam: null}
      : variant === 'pantalla' ? {kind: 'screen', webcam: panel ? {x: panel.x, y: panel.y, w: panel.w, h: panel.h} : null}
        : classifyTake(clip, panel ? {sourceBox: panel} : null));
    const png = path.join(d.work, 'frames', `take-${clip.id}.png`);
    await grab(file, clip.durationSeconds / 2, png, clip.width);
    if (info.webcam && !reviewed[clip.id]) info.patchColor = await patchColor(png, info.webcam, clip);
    // A camera take shows what the corner bubble will crop around the face.
    const bubble = info.kind === 'camera' ? [{...faceCrop(clip, profile.camera), color: '#ffd400', label: 'burbuja'}] : [];
    await gridFrame(png, path.join(d.work, 'frames', `take-${clip.id}.jpg`), clip, {webcam: info.webcam, boxes: bubble});
    await rm(png);
    takes[clip.id] = reviewed[clip.id] ?? {...info, sourceName: clip.sourceName, width: clip.width, height: clip.height, detection: panel?.method ?? null, frame: `frames/take-${clip.id}.jpg`, reviewed: false};
    if (info.kind === 'screen' && !info.webcam) warnings.push(`Toma ${clip.sourceName}: pantalla sin webcam detectada; si la lleva, corregir takes.json (webcam {x,y,w,h}, reviewed: true)`);
  }
  const candidates = zoomCandidates(basePlan, clips, takes);
  for (const [i, c] of candidates.entries()) {
    const clip = clips.find((x) => x.id === c.clipId);
    const png = path.join(d.work, 'frames', `c${i}.png`);
    await grab(path.join(PUBLIC, clip.file), c.sourceSeconds + 0.5, png, clip.width);
    c.frame = `frames/cand-${String(i + 1).padStart(3, '0')}.jpg`;
    await gridFrame(png, path.join(d.work, c.frame), clip, {webcam: takes[c.clipId].webcam});
    await rm(png);
  }
  await save(path.join(d.work, 'base-plan.json'), basePlan);
  await save(takesFile, takes);
  await save(path.join(d.work, 'candidates.json'), {version: 1, note: 'Sugerencias, no decisiones: numeros y palabras que senalan algo en tomas de pantalla. Coordenadas de la rejilla en pixeles de la toma.', candidates});
  if (!existsSync(d.zooms)) await save(d.zooms, {version: 1, zooms: []});
  await writeFile(path.join(d.work, 'TRANSCRIPCION.md'), transcriptMarkdown(basePlan, clips, takes));
  if (!existsSync(path.join(d.work, 'asset-requests.json'))) await save(path.join(d.work, 'asset-requests.json'), assetRequestsTemplate());
  if (!existsSync(path.join(d.work, 'planos.json'))) await save(path.join(d.work, 'planos.json'), {version: 1,
    note: 'Tomas a camara. layout corner: recurso en tarjeta sobre el fondo y la cara en la burbuja; cover: el recurso tapa todo mientras sigue la voz. asset = id de asset-requests.json.', planos: []});
  await save(d.state, {version: 1, slug: v.slug, project: d.project, profile: profile.id, variant, wallpaper: {file: wallpaperFile, width: wp.width, height: wp.height}, intents: v.intents ? path.resolve(v.intents) : null, warnings, createdAt: new Date().toISOString()});
  const kinds = Object.values(takes).reduce((acc, t) => ({...acc, [t.kind]: (acc[t.kind] ?? 0) + 1}), {});
  const next = [kinds.screen ? 'pantalla: revisar frames/take-*.jpg (webcam) y frames/cand-*.jpg, escribir zooms.json' : null,
    kinds.camera ? 'camara: leer TRANSCRIPCION.md, pedir recursos en asset-requests.json, ejecutar assets y escribir planos.json' : null, 'luego plan'].filter(Boolean).join('; ');
  console.log(JSON.stringify({work: d.work, duration: basePlan.duration, takes: kinds, candidates: candidates.length, warnings, next}, null, 2));
}

/** Downloads the requested assets (shared with intro-viral) and catalogues them for the shots. */
async function assets(v) {
  const d = dirs(v.slug);
  const requests = await readJson(path.join(d.work, 'asset-requests.json'));
  const errors = validateAssetRequests(requests);
  if (errors.length) throw Error('asset-requests.json:\n' + errors.map((e) => '- ' + e).join('\n'));
  const assetsDir = path.join(d.work, 'assets');
  const result = await resolveAssetRequests(requests, {assetsDir, rawDir: path.join(d.work, 'assets-raw'), force: v.force, log: console.log});
  const catalog = {};
  for (const name of existsSync(assetsDir) ? await readdir(assetsDir) : []) {
    if (name.endsWith('.json')) continue;
    const file = path.join(assetsDir, name), id = path.parse(name).name;
    const video = /\.(mp4|mov|webm|mkv)$/i.test(name);
    const meta = video ? await ffprobe(file) : await sharp(file).metadata();
    catalog[id] = {id, kind: video ? 'video' : 'image', file, width: meta.width, height: meta.height, ...(video ? {durationSeconds: round(meta.duration, 3)} : {}),
      reason: requests.assets.find((a) => a.id === id)?.reason ?? 'fichero dejado a mano'};
  }
  await save(path.join(d.work, 'assets.json'), catalog);
  // One tile per asset so the agent sees what each id is before placing it.
  const ids = Object.keys(catalog), tw = 480, th = 270;
  if (ids.length) {
    const tiles = [];
    for (const [i, id] of ids.entries()) {
      const a = catalog[id];
      let still = a.file;
      if (a.kind === 'video') {still = path.join(d.work, 'assets-raw', `${id}-still.png`); await mkdir(path.dirname(still), {recursive: true}); await grab(a.file, Math.min(1, a.durationSeconds / 2), still, 960);}
      const label = Buffer.from(`<svg width="${tw}" height="24"><rect width="${tw}" height="24" fill="#000"/><text x="6" y="17" fill="#fff" font-size="14" font-family="Arial">${id} · ${a.kind}${a.durationSeconds ? ' ' + a.durationSeconds + ' s' : ''}</text></svg>`);
      tiles.push({input: await sharp(still).resize(tw, th, {fit: 'contain', background: '#222'}).toBuffer(), left: (i % 4) * tw, top: Math.floor(i / 4) * (th + 24) + 24}, {input: label, left: (i % 4) * tw, top: Math.floor(i / 4) * (th + 24)});
    }
    await sharp({create: {width: 4 * tw, height: Math.ceil(ids.length / 4) * (th + 24), channels: 3, background: '#111'}}).composite(tiles).jpeg({quality: 85}).toFile(path.join(d.work, 'assets-sheet.jpg'));
  }
  console.log(JSON.stringify({assets: ids, failed: result.failed, sheet: ids.length ? path.join(d.work, 'assets-sheet.jpg') : null,
    next: result.failed.length ? 'Resolver los fallidos (otra fuente o fichero a mano en assets/<id>.png) y repetir' : 'Escribir planos.json y ejecutar plan'}, null, 2));
  if (result.failed.length) process.exitCode = 2;
}

async function plan(v) {
  const d = dirs(v.slug);
  const state = await readJson(d.state);
  const profile = framedProfile(state.profile);
  const {clips, assets} = await loadClips(state.project);
  const {kit} = await styleAndKit();
  const takes = await readJson(path.join(d.work, 'takes.json'));
  const basePlan = await readJson(path.join(d.work, 'base-plan.json'));
  const {zooms} = await readJson(d.zooms);
  const planosFile = path.join(d.work, 'planos.json'), catalogFile = path.join(d.work, 'assets.json');
  const shots = existsSync(planosFile) ? (await readJson(planosFile)).planos ?? [] : [];
  const catalog = existsSync(catalogFile) ? await readJson(catalogFile) : {};
  const {errors, plan: framed} = frameEditPlan(basePlan, {clips, takes, zooms, shots, assets: catalog, profile, kit});
  if (errors.length) {
    console.error('El plan no compila:\n' + errors.map((e) => '- ' + e).join('\n'));
    process.exitCode = 1;
    return;
  }
  const renderPlan = compileFramedPlan(framed, {clips, takes, profile, wallpaper: state.wallpaper, kit, assets: [...assets, ...Object.values(catalog)]});
  const out = path.join(d.work, 'plan-' + new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(out);
  await save(path.join(out, 'edit-plan.json'), framed);
  await save(path.join(out, 'render-plan.json'), renderPlan);
  // One tile per zoom: the chosen box (green) and what will actually fill the screen (yellow).
  const tiles = [];
  for (const [i, z] of framed.zooms.entries()) {
    const clip = clips.find((c) => c.id === z.clipId), card = cardRect(profile, clip);
    const crop = cameraCrop({x: 0, y: 0, w: CANVAS.width, h: CANVAS.height}, z.target);
    const seen = {x: (crop.x - card.x) / card.k, y: (crop.y - card.y) / card.k, w: crop.w / card.k, h: crop.h / card.k, color: '#ffd400', label: `${z.target.zoom}x`};
    const png = path.join(out, `z${i}.png`), jpg = path.join(out, `zoom-${String(i + 1).padStart(2, '0')}.jpg`);
    await grab(path.join(PUBLIC, clip.file), clip.words[z.atWord].start + 0.6, png, clip.width);
    await gridFrame(png, jpg, clip, {webcam: takes[z.clipId].webcam, boxes: [{...z.box, color: '#39ff6a', label: `#${i + 1} ${z.at}s`}, seen]});
    await rm(png);
    tiles.push(jpg);
  }
  let sheet = null;
  if (tiles.length) {
    const h = Math.round(THUMB * 9 / 16), cols = 2, rows = Math.ceil(tiles.length / cols);
    sheet = path.join(out, 'targets-sheet.jpg');
    await sharp({create: {width: cols * THUMB, height: rows * h, channels: 3, background: '#111'}})
      .composite(await Promise.all(tiles.map(async (t, i) => ({input: await sharp(t).resize(THUMB, h, {fit: 'contain', background: '#111'}).toBuffer(), left: (i % cols) * THUMB, top: Math.floor(i / cols) * h}))))
      .jpeg({quality: 85}).toFile(sheet);
  }
  console.log(JSON.stringify({plan: out, duration: framed.duration, zooms: framed.zooms.length, planos: framed.shots.length, targetsSheet: sheet, warnings: framed.warnings}, null, 2));
}

async function prepare(d, planDir) {
  const existing = path.join(planDir, 'package.txt');
  if (existsSync(existing)) return (await readFile(existing, 'utf8')).trim();
  if (!existsSync(path.join(planDir, 'render-plan.json'))) throw Error('Falta render-plan.json en ' + planDir);
  const prepared = await node('scripts/youtube-render.js', ['prepare', '--project', path.basename(d.work), '--render-plan', path.join(planDir, 'render-plan.json')]);
  const pkg = JSON.parse(prepared.stdout.slice(prepared.stdout.indexOf('{'))).package;
  await writeFile(existing, pkg);
  return pkg;
}

async function preview(v) {
  const d = dirs(v.slug), planDir = await latestPlan(d.work);
  const at = Number(v.at);
  const editPlan = await readJson(path.join(planDir, 'edit-plan.json'));
  if (!(at >= 0 && at < editPlan.duration)) throw Error('--at fuera del montaje');
  const pkg = await prepare(d, planDir);
  await node('scripts/youtube-render.js', ['still', '--project', v.slug, '--package', pkg, '--frame', String(Math.round(at * CANVAS.fps))]);
}

async function render(v) {
  const d = dirs(v.slug);
  let planDir = await latestPlan(d.work);
  const excerpt = v.from != null || v.to != null;
  if (excerpt) {
    const from = Number(v.from), to = Number(v.to);
    if (!(to > from && from >= 0)) throw Error('--from y --to en segundos del montaje');
    const dir = path.join(planDir, `tramo-${from}-${to}`);
    if (!existsSync(dir)) {
      await mkdir(dir);
      await save(path.join(dir, 'render-plan.json'), excerptRenderPlan(await readJson(path.join(planDir, 'render-plan.json')), from, to));
    }
    planDir = dir;
  }
  const pkg = await prepare(d, planDir);
  const rendered = await node('scripts/youtube-render.js', ['render', '--project', v.slug, '--package', pkg, ...(v['no-sound'] ? ['--sound-disabled'] : [])]);
  const video = /Final MP4: ([^\r\n]+)/.exec(rendered.stdout)?.[1];
  if (!video) throw Error('El render no devolvio MP4');
  if (excerpt) {console.log(JSON.stringify({video, excerpt: planDir}, null, 2)); return;}
  const plan = await readJson(path.join(planDir, 'edit-plan.json'));
  const qaDir = path.join(planDir, 'qa');
  const qa = await qaRender({file: video, plan, expected: {width: 1920, height: 1080, duration: plan.duration}, outDir: qaDir, sharp});
  await save(path.join(qaDir, 'qa.json'), qa);
  await writeFile(path.join(planDir, 'REVIEW.md'), reviewMarkdown({slug: v.slug, steps: ['start', 'zooms del agente', 'plan', 'render', 'qa'], planFile: path.join(planDir, 'edit-plan.json'), plan, video, qa}));
  console.log(JSON.stringify({video, qa: {passed: qa.passed, errors: qa.errors, warnings: qa.warnings.length, reviewSheet: qa.reviewSheet}, review: path.join(planDir, 'REVIEW.md')}, null, 2));
  if (!qa.passed) process.exitCode = 2;
}

async function status(v) {
  const d = dirs(v.slug);
  const has = (f) => existsSync(path.join(d.work, f));
  const zooms = has('zooms.json') ? (await readJson(d.zooms)).zooms.length : 0;
  const planos = has('planos.json') ? ((await readJson(path.join(d.work, 'planos.json'))).planos ?? []).length : 0;
  const requested = has('asset-requests.json') ? (await readJson(path.join(d.work, 'asset-requests.json'))).assets.length : 0;
  const ready = has('assets.json') ? Object.keys(await readJson(path.join(d.work, 'assets.json'))).length : 0;
  const plans = existsSync(d.work) ? (await readdir(d.work)).filter((n) => n.startsWith('plan-')).sort() : [];
  const last = plans.at(-1);
  const next = !has('state.json') ? 'start' : requested > ready ? 'assets' : !zooms && !planos ? 'escribir zooms.json y/o planos.json' : !last ? 'plan' : 'render';
  console.log(JSON.stringify({slug: v.slug, started: has('state.json'), zooms, assets: {requested, ready}, planos, plans: plans.length,
    rendered: Boolean(last && existsSync(path.join(d.work, last, 'REVIEW.md'))), next}, null, 2));
}

try {
  const {values: v, positionals: p} = parseArgs({allowPositionals: true, options: {source: {type: 'string'}, slug: {type: 'string'}, wallpaper: {type: 'string'},
    intents: {type: 'string'}, profile: {type: 'string'}, variant: {type: 'string'}, force: {type: 'boolean'}, at: {type: 'string'}, from: {type: 'string'}, to: {type: 'string'}, 'no-sound': {type: 'boolean'}}});
  const commands = {start, assets, plan, preview, render, status};
  if (p.length !== 1 || !commands[p[0]] || !v.slug) throw Error(USAGE);
  await loadDotEnv();
  await commands[p[0]](v);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
