/**
 * Short 9:16 desde la apertura viral: el procedimiento con puertas.
 *
 *   plan        escaleta + intro-plan de la apertura -> short-plan.json -> shorts:build
 *   render      shorts:render con un public aislado -> MP4 + QA tecnico
 *   review      hoja de fotogramas vertical, sonoridad y REVIEW-SHORT.md
 *   publishing  shorts:publishing (titulos, 14 hashtags, posts por plataforma)
 *   status      en que puerta esta
 *
 * No hay ingesta ni transcripcion nueva: el short apunta a la misma media que la
 * apertura (clips normalizados, recursos con procedencia, musica) y copia sus
 * transcripciones, asi que los indices de palabra de la escaleta valen tal cual. Lo
 * unico que el usuario o el agente tocan es `short.json` en el espacio de trabajo de
 * la apertura (omitir escenas, cambiar una escena, titulo); `short-plan.json` se
 * regenera en cada `plan`.
 */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, readdir, writeFile} from 'node:fs/promises';
import {readJson, writeJson} from '../../lib/utils.js';
import {projectDir as introProjectDir} from '../intro-studio/constants.js';
import {loadUserSoundPalette} from '../intro-studio/sound.js';
import {SHORT_FORMAT, projectDir as shortProjectDir, REMOTION_ROOT} from '../shorts-studio/constants.js';
import {buildShort} from '../shorts-studio/build.js';
import {renderShortProject} from '../shorts-studio/render-project.js';
import {buildShortPublishing} from '../shorts-studio/publishing.js';
import {analyzeArtwork} from '../video-studio/artwork.js';
import {isolatePublicDir} from '../video-studio/render-public.js';
import {freezeProject} from '../video-studio/project-lock.js';
import {frameSheet, measureLoudness} from '../video-studio/media-review.js';
import {workspacePaths} from '../intro-viral/workflow.js';
import {TARGET_MAX_SECONDS, introToShortPlan, shortSoundPalette} from './translate.js';

export const GATES = ['plan', 'render', 'review', 'publishing'];
export const LOUDNESS_TARGET = {integrated: -14, tolerance: 1, maxTruePeak: -1};
/** YouTube Shorts admite hasta 3 minutos; mas alla no es un short. */
export const HARD_MAX_SECONDS = 180;
const npmCmd = (stage, slug) => `npm run intro:short -- ${stage} --slug ${slug}`;
const check = (ok, label, detail = '', fix = '') => ({ok: Boolean(ok), label, detail, fix});

export function shortPaths(slug) {
  const work = workspacePaths(slug);
  return {
    ...work,
    overrides: path.join(work.dir, 'short.json'),
    reviewMd: path.join(work.dir, 'REVIEW-SHORT.md'),
    sheet: path.join(work.review, 'short-hoja.jpg')
  };
}

async function loadState(slug) {
  return readJson(workspacePaths(slug).state).catch(() => null);
}

async function saveGate(slug, gate, result, extra = {}) {
  const state = (await loadState(slug)) ?? {slug, gates: {}};
  state.short ??= {gates: {}};
  state.short.gates[gate] = {ok: result.ok, at: new Date().toISOString(), failed: result.checks.filter((c) => !c.ok).map((c) => c.label)};
  Object.assign(state.short, extra);
  await writeJson(workspacePaths(slug).state, state);
  return state;
}

/** Plantilla de short.json: lo unico editable del short. */
export function overridesTemplate() {
  return {
    version: 1,
    note: 'Cambios del short sobre la traduccion de la apertura. omit: ids de escena que no entran (para bajar de 60 s). scenes: {id: {campos de short-plan que se pisan}}. title y accentColor opcionales. music: false quita la cama musical.',
    omit: [],
    scenes: {}
  };
}

/**
 * Proyecto de shorts que comparte la media de la apertura. El manifest apunta a los
 * mismos ficheros de `public/projects/intro/<slug>/`: no se copia video y las
 * transcripciones son las mismas que leyo la escaleta.
 */
export async function shellFromIntro({slug, shortSlug}) {
  const from = introProjectDir(slug);
  const to = shortProjectDir(shortSlug);
  const manifest = await readJson(path.join(from, 'manifest.json'));
  await mkdir(path.join(to, 'transcripts'), {recursive: true});
  for (const file of await readdir(path.join(from, 'transcripts'))) {
    await copyFile(path.join(from, 'transcripts', file), path.join(to, 'transcripts', file));
  }
  const shortManifest = {
    ...manifest,
    slug: shortSlug,
    surface: 'shorts',
    format: SHORT_FORMAT,
    derivedFrom: {surface: 'intro', slug, createdAt: manifest.createdAt},
    createdAt: new Date().toISOString()
  };
  await writeJson(path.join(to, 'manifest.json'), shortManifest);
  return {project: to, manifest: shortManifest};
}

export async function planStage({slug, shortSlug = slug, force = false, log = console.log}) {
  const paths = shortPaths(slug);
  const state = await loadState(slug);
  const introPlanFile = path.join(introProjectDir(slug), 'intro-plan.json');
  const checks = [
    check(state?.gates?.plan?.ok, 'apertura compilada (intro:viral plan)', state?.gates?.plan ? `${state.gates.plan.ok ? 'superada' : 'bloqueada'}` : 'pendiente',
      `El short sale de la apertura: termina antes npm run intro:viral -- plan --slug ${slug}`),
    check(existsSync(paths.escaleta), 'escaleta.json', paths.escaleta),
    check(existsSync(introPlanFile), 'intro-plan.json', introPlanFile)
  ];
  if (checks.some((c) => !c.ok)) {
    const out = {ok: false, checks};
    await saveGate(slug, 'plan', out);
    return out;
  }
  const target = shortProjectDir(shortSlug);
  const planFile = path.join(target, 'short-plan.json');
  if (existsSync(planFile)) {
    const previous = await readJson(planFile).catch(() => null);
    if (previous && previous.derivedFrom?.workflow !== 'intro-short') {
      if (!force) {
        const out = {ok: false, checks: [...checks, check(false, 'short-plan.json montado a mano', planFile,
          `Ya hay un short ${shortSlug} que no sale de este flujo. Usa --short-slug <otro> o --force (se guarda como short-plan.manual.json)`)]};
        await saveGate(slug, 'plan', out);
        return out;
      }
      await copyFile(planFile, path.join(target, 'short-plan.manual.json'));
      log(`short-plan.json a mano guardado como short-plan.manual.json`);
    } else if (previous) {
      await copyFile(planFile, path.join(target, 'short-plan.prev.json'));
    }
  }

  const {manifest} = await shellFromIntro({slug, shortSlug});
  const transcripts = {};
  for (const clip of manifest.clips) {
    transcripts[clip.id] = clip.transcript ? await readJson(path.join(target, clip.transcript)) : {words: []};
  }
  if (!existsSync(paths.overrides)) await writeJson(paths.overrides, overridesTemplate());
  const overrides = await readJson(paths.overrides);
  const escaleta = await readJson(paths.escaleta);
  const introPlan = await readJson(introPlanFile);
  const requests = await readJson(paths.requests).catch(() => null);
  const art = {};
  for (const asset of manifest.assets.filter((a) => a.kind === 'image')) {
    art[asset.id] = await analyzeArtwork(asset.file).catch(() => null);
  }
  let sounds = null;
  try {
    sounds = shortSoundPalette(await loadUserSoundPalette());
  } catch (error) {
    checks.push({...check(true, 'sonidos', `SONIDOS-REELS no disponible (${error.message}); suena la libreria`), warning: true});
  }
  const {plan, report} = introToShortPlan({
    escaleta, introPlan, manifest, transcripts, requests, art, sounds,
    overrides: {...overrides, slug: shortSlug}
  });
  await writeJson(planFile, plan);

  let build;
  try {
    build = await buildShort({slug: shortSlug, log});
  } catch (error) {
    checks.push(check(false, 'shorts:build', error.message, 'Arregla con short.json (omit o scenes); no edites short-plan.json, se regenera'));
    const out = {ok: false, checks, report};
    await saveGate(slug, 'plan', out, {shortSlug});
    return out;
  }
  const {summary, issues} = build.rules;
  checks.push(check(summary.failed === 0, 'reglas SH-R sin errores', `${summary.passed}/${summary.total} pasan, ${summary.warnings} avisos`));
  for (const issue of issues.filter((i) => i.severity !== 'error')) {
    checks.push({...check(true, `aviso ${issue.ruleId}`, `${issue.sceneId ?? ''} ${issue.message}`), warning: true});
  }
  const seconds = build.durationSeconds;
  checks.push(check(seconds <= HARD_MAX_SECONDS, 'duracion de short', `${seconds} s`, `Quita escenas en short.json (omit) hasta bajar de ${TARGET_MAX_SECONDS} s`));
  if (seconds > TARGET_MAX_SECONDS) {
    checks.push({...check(true, `mas de ${TARGET_MAX_SECONDS} s`, `${seconds} s: TikTok y Reels lo aceptan, pero un Short corto retiene mejor. Valora omitir escenas en short.json`), warning: true});
  }
  for (const warning of report.warnings) checks.push({...check(true, 'traduccion', warning), warning: true});
  for (const dropped of report.dropped) checks.push({...check(true, 'no trasladado', `${dropped.scene}: ${dropped.reason}`), warning: true});
  const out = {ok: checks.every((c) => c.ok), checks, report: {escenas: report.scenes, segundos: seconds, recursos: report.media.length, palabrasClaveNoTrasladadas: report.keywordsDropped.length}, next: npmCmd('render', slug)};
  await saveGate(slug, 'plan', out, {shortSlug, durationSeconds: seconds});
  return out;
}

export async function renderStage({slug, log = console.log}) {
  const state = await loadState(slug);
  const shortSlug = state?.short?.shortSlug ?? slug;
  if (!state?.short?.gates?.plan?.ok) {
    return {ok: false, checks: [check(false, 'puerta plan', 'pendiente o bloqueada', `Ejecuta ${npmCmd('plan', slug)}`)]};
  }
  // El render es de una version congelada (la media pasa a `projects/_locked/<hash>`),
  // y el bundler copia `public` entero al temporal: se monta uno con lo que usa esa
  // version y nada mas.
  const frozen = await freezeProject(shortProjectDir(shortSlug));
  const isolated = await isolatePublicDir({
    publicRoot: path.join(REMOTION_ROOT, 'public'),
    build: frozen.build,
    target: path.join(REMOTION_ROOT, 'out', `shorts-${shortSlug}`, 'public')
  });
  const previous = process.env.SHORTSMITH_RENDER_PUBLIC_DIR;
  process.env.SHORTSMITH_RENDER_PUBLIC_DIR = isolated.target;
  log(`public aislado: ${isolated.files} ficheros del build + carpetas comunes`);
  let result = null;
  let failure = null;
  try {
    result = await renderShortProject({slug: shortSlug, version: frozen.id});
  } catch (error) {
    failure = error.message;
  } finally {
    if (previous === undefined) delete process.env.SHORTSMITH_RENDER_PUBLIC_DIR;
    else process.env.SHORTSMITH_RENDER_PUBLIC_DIR = previous;
  }
  const checks = [
    check(!failure, 'shorts:render', failure ?? `version ${result.version}`),
    check(result?.qa?.passed ?? false, 'QA tecnico (duracion, audio, codec)', result?.qa?.errors?.join('; ') ?? ''),
    check(result?.review?.passed ?? false, 'revision de transiciones', result?.review?.passed === false ? 'hay saltos que revisar en el run' : '')
  ];
  const out = {ok: checks.every((c) => c.ok), checks, mp4: result?.output ?? null, next: npmCmd('review', slug)};
  await saveGate(slug, 'render', out, {mp4: result?.output ?? null});
  if (result?.output) log(`MP4: ${result.output}`);
  return out;
}

/** Un fotograma por escena, en el momento en que su recurso ya esta en pantalla. */
export function reviewMoments(build, count = 24) {
  const fps = build.format.fps;
  const moments = build.scenes.map((scene) => {
    const cue = scene.cues[0];
    const local = cue ? Math.min(cue.fromFrame + 40, scene.durationInFrames - 4) : Math.round(scene.durationInFrames * 0.5);
    return {seconds: (scene.from + local) / fps, label: `${scene.id} · ${scene.layout}`};
  });
  if (moments.length <= count) return moments;
  return Array.from({length: count}, (_, i) => moments[Math.round(i * (moments.length - 1) / (count - 1))]);
}

export async function reviewStage({slug, deliver = false, log = console.log}) {
  const paths = shortPaths(slug);
  const state = await loadState(slug);
  const shortSlug = state?.short?.shortSlug ?? slug;
  const mp4 = state?.short?.mp4;
  if (!mp4 || !existsSync(mp4)) return {ok: false, checks: [check(false, 'MP4', 'no hay render', `Ejecuta ${npmCmd('render', slug)}`)]};
  const build = await readJson(path.join(shortProjectDir(shortSlug), 'short-build.json'));
  await mkdir(paths.review, {recursive: true});
  await frameSheet({file: mp4, frames: reviewMoments(build), output: paths.sheet, columns: 8, cellWidth: 240, aspect: 9 / 16});
  const loud = await measureLoudness(mp4);
  const t = LOUDNESS_TARGET;
  const {summary, issues} = build.rules;
  const checks = [
    check(summary.failed === 0, 'reglas SH-R en verde', `${summary.passed}/${summary.total}, ${issues.length} avisos`),
    check(Number.isFinite(loud.integrated) && Math.abs(loud.integrated - t.integrated) <= t.tolerance, `sonoridad ${t.integrated} ±${t.tolerance} LUFS`,
      `${loud.integrated} LUFS, pico ${loud.truePeak} dBTP`, 'Baja music.volume en short.json o revisa el mix'),
    check(!Number.isFinite(loud.truePeak) || loud.truePeak <= t.maxTruePeak, `pico real ≤ ${t.maxTruePeak} dBTP`, `${loud.truePeak} dBTP`)
  ];
  let delivered = null;
  if (deliver && state?.source) {
    delivered = path.join(state.source, `SHORT_${slug}_9x16.mp4`);
    if (existsSync(delivered)) await copyFile(delivered, delivered.replace(/\.mp4$/, '.anterior.mp4'));
    await copyFile(mp4, delivered);
    log(`Entregado: ${delivered}`);
  }
  await writeFile(paths.reviewMd, reviewMarkdown({slug, shortSlug, build, mp4, sheet: paths.sheet, loud, checks, delivered}));
  const out = {ok: checks.every((c) => c.ok), checks, sheet: paths.sheet, mp4, delivered, review: paths.reviewMd, next: npmCmd('publishing', slug)};
  await saveGate(slug, 'review', out, {delivered});
  return out;
}

function reviewMarkdown({slug, shortSlug, build, mp4, sheet, loud, checks, delivered}) {
  const mark = (ok) => (ok ? '[x]' : '[ ]');
  return [
    `# Revision del short de ${slug}`,
    '',
    `- Proyecto: \`remotion-animations/projects/shorts-${shortSlug}\``,
    `- MP4: \`${mp4}\``,
    `- Duracion: ${build.durationSeconds} s, ${build.scenes.length} escenas, ${build.soundCues.length} sonidos`,
    `- Hoja de fotogramas: \`${sheet}\``,
    `- Sonoridad: ${loud.integrated} LUFS integrados, pico ${loud.truePeak} dBTP`,
    delivered ? `- Entregado en: \`${delivered}\`` : '- Sin entregar (repite con `--deliver` cuando este aprobado)',
    '',
    '## Comprobaciones automaticas',
    '',
    ...checks.map((c) => `- ${mark(c.ok)} ${c.label}${c.detail ? ` — ${c.detail}` : ''}${!c.ok && c.fix ? ` → ${c.fix}` : ''}`),
    '',
    '## Revision visual (el agente mirando la hoja, y luego el usuario)',
    '',
    '- [ ] Cada recurso de arriba corresponde a lo que se dice abajo',
    '- [ ] Las capturas de texto (stage) se leen en el movil',
    '- [ ] El subtitulo verde no tapa la cara ni el recurso',
    '- [ ] La cara se ve entera en la mitad de abajo (talking-head) y en full',
    '- [ ] Nada informativo por debajo de la interfaz de Shorts (y > 1748)',
    '- [ ] Escuchado entero: sonidos solo en cambios de imagen, la musica no tapa la voz',
    ''
  ].join('\n');
}

export async function publishingStage({slug, useLlm = true, log = console.log}) {
  const state = await loadState(slug);
  const shortSlug = state?.short?.shortSlug ?? slug;
  if (!state?.short?.gates?.review?.ok) {
    return {ok: false, checks: [check(false, 'puerta review', 'pendiente o bloqueada', `Ejecuta ${npmCmd('review', slug)}`)]};
  }
  const {payload, files} = await buildShortPublishing({slug: shortSlug, useLlm, outputDir: null, log});
  const checks = [
    check(payload.hashtags?.split(/\s+/).filter(Boolean).length === 14, '14 hashtags', payload.hashtags),
    check(payload.titles?.youtube_shorts?.length, 'titulos de Shorts', payload.titles?.youtube_shorts?.[0]?.title ?? ''),
    check(['youtube_shorts', 'instagram', 'tiktok'].every((p) => payload.platform_posts?.[p]), 'posts de Shorts, Reels y TikTok'),
    ...(payload.warning ? [{...check(true, 'aviso', payload.warning), warning: true}] : [])
  ];
  const out = {ok: checks.every((c) => c.ok), checks, files, next: `npm run shorts:publish -- --slug ${shortSlug} --platforms youtube,instagram,tiktok (solo si el usuario lo pide)`};
  await saveGate(slug, 'publishing', out);
  return out;
}

export async function statusStage({slug}) {
  const state = await loadState(slug);
  if (!state?.short) return {ok: false, checks: [check(false, 'short', 'no empezado', npmCmd('plan', slug))]};
  const checks = GATES.map((gate) => {
    const g = state.short.gates?.[gate];
    return check(g?.ok, gate, g ? `${g.ok ? 'superada' : 'bloqueada'} ${g.at}${g.failed?.length ? ' — ' + g.failed.join('; ') : ''}` : 'pendiente');
  });
  const pending = GATES.find((gate) => !state.short.gates?.[gate]?.ok);
  return {ok: !pending, checks, next: pending ? npmCmd(pending, slug) : null};
}
