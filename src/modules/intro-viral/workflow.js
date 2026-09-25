/**
 * Apertura viral de un video largo: el procedimiento con puertas.
 *
 *   start   tomas numeradas + musica -> ingesta, transcripcion con indices,
 *           escaleta y peticion de recursos de partida
 *   assets  asset-requests.json -> ficheros con procedencia -> reingesta
 *   plan    escaleta.json -> intro-plan.json -> intro:build (reglas)
 *   render  intro:render -> MP4
 *   review  hoja de fotogramas, sonoridad, sonidos usados y REVIEW.md
 *
 * Cada etapa devuelve sus comprobaciones y se detiene con un mensaje que dice que
 * mirar y que orden ejecutar despues. No hay etapa de metadata ni de publicacion:
 * la apertura va dentro del video largo.
 */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {copyFile, link, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {DATA_DIR, readJson, writeJson} from '../../lib/utils.js';
import {ingestIntroProject} from '../intro-studio/ingest.js';
import {buildIntro} from '../intro-studio/build.js';
import {projectDir} from '../intro-studio/constants.js';
import {REMOTION_ROOT, VIDEO_EXTENSIONS} from '../video-studio/paths.js';
import {frameSheet, measureLoudness} from '../video-studio/media-review.js';
import {compileEscaleta, escaletaTemplate, loadDecisionTables, transcriptMarkdown, validateEscaleta} from './escaleta.js';
import {assetRequestsTemplate, resolveAssetRequests, validateAssetRequests} from './assets.js';

export const GATES = ['start', 'assets', 'plan', 'render', 'review'];
export const LOUDNESS_TARGET = {integrated: -14, tolerance: 1, maxTruePeak: -1};
const npmCmd = (stage, slug) => `npm run intro:viral -- ${stage} --slug ${slug}`;

export function workspaceDir(slug) {
  return path.join(DATA_DIR, 'intro-viral', slug);
}

export function workspacePaths(slug) {
  const dir = workspaceDir(slug);
  return {
    dir,
    tomas: path.join(dir, 'tomas'),
    assets: path.join(dir, 'assets'),
    raw: path.join(dir, 'raw'),
    review: path.join(dir, 'review'),
    state: path.join(dir, 'state.json'),
    escaleta: path.join(dir, 'escaleta.json'),
    requests: path.join(dir, 'asset-requests.json'),
    transcript: path.join(dir, 'TRANSCRIPCION.md'),
    reviewMd: path.join(dir, 'REVIEW.md')
  };
}

const check = (ok, label, detail = '', fix = '') => ({ok: Boolean(ok), label, detail, fix});

async function loadState(slug) {
  return readJson(workspacePaths(slug).state).catch(() => null);
}

async function saveGate(slug, gate, result, extra = {}) {
  const paths = workspacePaths(slug);
  const state = (await loadState(slug)) ?? {slug, gates: {}};
  state.gates[gate] = {ok: result.ok, at: new Date().toISOString(), failed: result.checks.filter((c) => !c.ok).map((c) => c.label)};
  Object.assign(state, extra);
  await writeJson(paths.state, state);
  return state;
}

async function loadProject(slug) {
  const project = projectDir(slug);
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const transcripts = {};
  for (const clip of manifest.clips) {
    transcripts[clip.id] = clip.transcript ? await readJson(path.join(project, clip.transcript)) : {words: []};
  }
  return {project, manifest, transcripts};
}

/** Toma numerada `N.ext` dentro de la carpeta de origen. */
export async function findNumberedClips(source, clips) {
  const entries = await readdir(source);
  return clips.map((number) => {
    const file = entries.find((name) => path.parse(name).name === String(number) && VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()));
    return {number, file: file ? path.join(source, file) : null};
  });
}

// ---------------------------------------------------------------------------

export async function startStage({source, clips, slug, music, log = console.log}) {
  const paths = workspacePaths(slug);
  const checks = [];
  if (!source || !existsSync(source)) {
    return {ok: false, checks: [check(false, 'carpeta de tomas', source ?? '(sin --source)', 'Pasa --source con la carpeta donde estan 1.mkv, 2.mkv…')]};
  }
  const found = await findNumberedClips(source, clips);
  for (const clip of found) checks.push(check(clip.file, `toma ${clip.number}`, clip.file ?? 'no existe', `Tiene que haber un fichero ${clip.number}.mkv (o .mp4) en ${source}`));
  const musicFile = music ?? process.env.INTRO_VIRAL_MUSIC ?? null;
  checks.push(check(musicFile && existsSync(musicFile), 'pista de musica', musicFile ?? '(sin --music)', 'Pasa --music con una pista de pulso claro (la skill dice cual funciono) o define INTRO_VIRAL_MUSIC'));
  if (checks.some((c) => !c.ok)) return {ok: false, checks};

  await mkdir(paths.tomas, {recursive: true});
  await mkdir(paths.assets, {recursive: true});
  for (const clip of found) {
    const target = path.join(paths.tomas, path.basename(clip.file));
    if (existsSync(target)) continue;
    // Enlace duro: la ingesta coge todo lo que haya en la carpeta y asi no se copia
    // un .mkv de varios GB. Si el disco no lo permite, se copia.
    await link(clip.file, target).catch(() => copyFile(clip.file, target));
  }
  log(`Ingesta de ${found.length} tomas (la transcripcion y la musica se cachean)…`);
  await ingestIntroProject({sourceDir: paths.tomas, slug, assetsDir: paths.assets, musicFile, log});

  const {manifest, transcripts} = await loadProject(slug);
  const tables = loadDecisionTables();
  for (const clip of manifest.clips) {
    const words = transcripts[clip.id]?.words?.length ?? 0;
    checks.push(check(words > 0, `transcripcion ${clip.id} (${clip.sourceName})`, `${words} palabras`, 'Repite con --retranscribe o revisa el audio de la toma'));
    checks.push(check(clip.faceBox, `cara en ${clip.id}`, clip.faceBox ? `confianza ${clip.faceConfidence ?? '?'}` : 'no detectada', 'Sin cara no se mide IN-R-011; revisa el encuadre a ojo'));
  }
  const total = manifest.clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
  const m = manifest.music;
  checks.push(check(m?.bpm, 'rejilla de beats', m ? `${m.bpm} BPM, confianza ${m.confidence}` : 'sin analisis', 'Fija bpm/offsetSeconds a mano o usa otra pista'));
  checks.push(check(m && m.durationSeconds >= total + tables.music.minMarginSeconds, 'la musica dura mas que las tomas',
    m ? `${m.durationSeconds.toFixed(1)} s de musica para ${total.toFixed(1)} s de tomas` : '-', 'Elige una pista mas larga'));

  await writeFile(paths.transcript, transcriptMarkdown({manifest, transcripts, tables}));
  if (!existsSync(paths.escaleta)) await writeJson(paths.escaleta, escaletaTemplate({slug, manifest, transcripts, tables}));
  if (!existsSync(paths.requests)) await writeJson(paths.requests, assetRequestsTemplate());

  // La cara es un aviso, no un bloqueo: una toma sin cara detectada se puede montar.
  const blocking = checks.filter((c) => !c.ok && !c.label.startsWith('cara'));
  const result = {ok: !blocking.length, checks, next: npmCmd('assets', slug)};
  await saveGate(slug, 'start', result, {source, clips, music: musicFile});
  return result;
}

export async function assetsStage({slug, force = false, log = console.log}) {
  const paths = workspacePaths(slug);
  const requests = await readJson(paths.requests).catch(() => null);
  if (!requests) return {ok: false, checks: [check(false, 'asset-requests.json', 'no existe', `Ejecuta primero ${npmCmd('start', slug)}`)]};
  const errors = validateAssetRequests(requests);
  if (errors.length) return {ok: false, checks: errors.map((e) => check(false, 'contrato de recursos', e, 'Corrige asset-requests.json'))};

  const result = await resolveAssetRequests(requests, {assetsDir: paths.assets, rawDir: paths.raw, force, log});
  const state = await loadState(slug);
  log('Reingesta con los recursos…');
  await ingestIntroProject({sourceDir: paths.tomas, slug, assetsDir: paths.assets, musicFile: state?.music, log});
  const {manifest} = await loadProject(slug);
  const ingested = new Set(manifest.assets.map((asset) => asset.id));
  const checks = [
    ...result.failed.map((f) => check(false, `recurso ${f.id}`, `${f.kind} ${f.url}: ${f.reason}`,
      `Capturalo a mano y dejalo como ${path.join(paths.assets, f.id)}.png (o .mp4), o cambia la fuente`)),
    ...(requests.assets ?? []).map((asset) => check(ingested.has(asset.id), `ingerido ${asset.id}`, ingested.has(asset.id) ? '' : 'no aparece en manifest.json',
      'Revisa que el fichero se llame exactamente como su id'))
  ];
  for (const asset of manifest.assets.filter((a) => a.kind === 'video')) {
    const d = asset.durationSeconds ?? 0;
    checks.push(check(d >= 2 && d <= 12, `duracion de ${asset.id}`, `${d.toFixed(1)} s`, 'El b-roll va en fragmentos de 4-8 s: el fondo se reproduce desde el principio y en bucle'));
  }
  if (!checks.length) checks.push(check(true, 'sin recursos pedidos', 'la escaleta solo podra usar frase, enfasis y cifra'));
  const out = {ok: checks.every((c) => c.ok), checks, next: npmCmd('plan', slug), assets: [...ingested].filter((id) => id !== 'music')};
  await saveGate(slug, 'assets', out);
  return out;
}

export async function planStage({slug, log = console.log}) {
  const paths = workspacePaths(slug);
  const escaleta = await readJson(paths.escaleta).catch((error) => ({__error: error.message}));
  if (escaleta.__error) return {ok: false, checks: [check(false, 'escaleta.json', escaleta.__error, 'Tiene que ser JSON valido')]};
  const {project, manifest, transcripts} = await loadProject(slug);
  const tables = loadDecisionTables();
  const {errors, warnings} = validateEscaleta(escaleta, {manifest, transcripts, tables});
  const checks = [
    ...errors.map((e) => check(false, 'escaleta', e)),
    ...warnings.map((w) => ({...check(true, 'aviso de escaleta', w), warning: true}))
  ];
  if (errors.length) {
    const out = {ok: false, checks};
    await saveGate(slug, 'plan', out);
    return out;
  }
  const music = await readJson(path.join(project, 'music.json')).catch(() => null);
  const beats = music?.beatSeconds ?? manifest.music?.beatSeconds ?? [];
  const compiled = compileEscaleta(escaleta, {manifest, transcripts, beats, tables});
  const planFile = path.join(project, 'intro-plan.json');
  if (existsSync(planFile)) await copyFile(planFile, path.join(project, 'intro-plan.prev.json'));
  await writeJson(planFile, compiled.plan);
  for (const w of compiled.warnings) checks.push({...check(true, 'aviso del compilador', w), warning: true});

  let build;
  try {
    build = await buildIntro({slug, log});
  } catch (error) {
    checks.push(check(false, 'intro:build', error.message, 'Cada error nombra la regla y la escena: cambia la escaleta, no el plan'));
    const out = {ok: false, checks, report: compiled.report};
    await saveGate(slug, 'plan', out);
    return out;
  }
  const {summary, issues} = build.rules;
  checks.push(check(summary.failed === 0, 'reglas sin errores', `${summary.passed}/${summary.total} pasan`));
  for (const issue of issues.filter((i) => i.severity !== 'error')) {
    checks.push(check(false, `aviso ${issue.ruleId}`, `${issue.sceneId ?? ''} ${issue.message}`, fixForRule(issue.ruleId)));
  }
  const out = {ok: checks.every((c) => c.ok), checks, report: compiled.report, next: npmCmd('render', slug)};
  await saveGate(slug, 'plan', out);
  return out;
}

/** Arreglo de cada aviso en terminos de escaleta: el agente no toca el plan compilado. */
export function fixForRule(ruleId) {
  return ({
    'IN-R-042': 'Demasiados golpes seguidos: pasa a `frase` la escena `enfasis` mas cercana del tramo (o quita su hitWord si es gancho). Nunca subas el techo.',
    'IN-R-060': 'Tramo sin cambio visible: anade una keyword muda en esa escena o partela en dos escenas (la camara cambia sola).',
    'IN-R-050': 'Un cue sin sonido necesita soundNote: lo pone el compilador; si sale, revisa la escaleta.',
    'IN-R-061': 'Duracion fuera del perfil: revisa si falta o sobra una toma.',
    'IN-R-040': 'Golpe fuera de beat: cambia el hitWord a la palabra fuerte mas cercana a un beat.'
  })[ruleId] ?? 'Lee docs/intro-playbook.md para esta regla.';
}

export async function renderStage({slug, log = console.log}) {
  const result = spawnSync(process.execPath, [path.join('scripts', 'intro-render.js'), '--slug', slug], {stdio: 'inherit'});
  const mp4 = await latestRender(slug);
  const checks = [
    check(result.status === 0, 'intro:render', `salida ${result.status}`),
    check(mp4, 'MP4 renderizado', mp4 ?? 'no encontrado')
  ];
  const out = {ok: checks.every((c) => c.ok), checks, next: npmCmd('review', slug), mp4};
  await saveGate(slug, 'render', out);
  log(mp4 ? `MP4: ${mp4}` : 'sin MP4');
  return out;
}

export async function latestRender(slug) {
  const root = path.join(REMOTION_ROOT, 'out', `intro-${slug}`);
  if (!existsSync(root)) return null;
  const files = (await readdir(root, {recursive: true})).filter((file) => path.basename(file) === `${slug}.mp4`);
  let best = null;
  for (const file of files) {
    const full = path.join(root, file);
    const info = await stat(full);
    if (!best || info.mtimeMs > best.mtime) best = {file: full, mtime: info.mtimeMs};
  }
  return best?.file ?? null;
}

/** Instante de cada escena que mejor la representa: la palabra clave ya escrita o la mitad. */
export function reviewMoments(build, count = 20) {
  const fps = build.format.fps;
  const moments = build.scenes.map((scene) => {
    const cue = scene.cues.find((c) => c.type === 'keyword' || c.type === 'stat') ?? scene.cues[0];
    const local = cue ? Math.min(cue.fromFrame + 45, scene.durationInFrames - 6) : Math.round(scene.durationInFrames * 0.6);
    return {seconds: (scene.from + local) / fps, label: `${scene.id} · ${scene.layout}${cue?.text ? ' · ' + cue.text : ''}`};
  });
  if (moments.length <= count) return moments;
  return Array.from({length: count}, (_, i) => moments[Math.round(i * (moments.length - 1) / (count - 1))]);
}

export async function reviewStage({slug, deliver = false, log = console.log}) {
  const paths = workspacePaths(slug);
  const {project} = await loadProject(slug);
  const build = await readJson(path.join(project, 'intro-build.json'));
  const mp4 = await latestRender(slug);
  if (!mp4) return {ok: false, checks: [check(false, 'MP4', 'no hay render', `Ejecuta ${npmCmd('render', slug)}`)]};
  await mkdir(paths.review, {recursive: true});
  const sheet = path.join(paths.review, 'hoja-20.jpg');
  await frameSheet({file: mp4, frames: reviewMoments(build), output: sheet});
  const loud = await measureLoudness(mp4);

  const library = build.soundLibrary?.files ?? {};
  const tally = {};
  const foreign = [];
  for (const cue of build.soundCues) {
    const name = library[cue.file] ?? cue.file;
    tally[name] = (tally[name] ?? 0) + 1;
    if (!library[cue.file]) foreign.push(cue.file);
  }
  const {summary, issues} = build.rules;
  const t = LOUDNESS_TARGET;
  const checks = [
    check(summary.failed === 0 && issues.length === 0, 'reglas en verde', `${summary.passed}/${summary.total}, ${issues.length} avisos`),
    check(!issues.some((i) => i.ruleId === 'IN-R-042'), 'IN-R-042 sin avisos (respiro entre golpes)'),
    check(Number.isFinite(loud.integrated) && Math.abs(loud.integrated - t.integrated) <= t.tolerance, `sonoridad ${t.integrated} ±${t.tolerance} LUFS`,
      `${loud.integrated} LUFS, pico ${loud.truePeak} dBTP`, 'Ajusta music.gainDb o soundMix del perfil, no el master'),
    check(!Number.isFinite(loud.truePeak) || loud.truePeak <= t.maxTruePeak, `pico real ≤ ${t.maxTruePeak} dBTP`, `${loud.truePeak} dBTP`),
    check(!foreign.length, 'todos los sonidos son de SONIDOS-REELS', foreign.length ? `${foreign.length} de la libreria: ${[...new Set(foreign)].join(', ')}` : '',
      'Anade a SONIDOS-REELS el uso que falta (prefijo del fichero) o justifica el sonido de libreria')
  ];

  let delivered = null;
  const state = await loadState(slug);
  if (deliver && state?.source) {
    delivered = path.join(state.source, `INTRO_${(state.clips ?? []).join('-')}_viral.mp4`);
    await copyFile(mp4, delivered);
  }
  await writeFile(paths.reviewMd, reviewMarkdown({slug, build, mp4, sheet, loud, tally, checks, delivered}));
  const out = {ok: checks.every((c) => c.ok), checks, sheet, mp4, loudness: loud, tally, delivered, review: paths.reviewMd};
  await saveGate(slug, 'review', out);
  return out;
}

function reviewMarkdown({slug, build, mp4, sheet, loud, tally, checks, delivered}) {
  const mark = (ok) => (ok ? '[x]' : '[ ]');
  return [
    `# Revision de la apertura ${slug}`,
    '',
    `- MP4: \`${mp4}\``,
    `- Duracion: ${build.durationSeconds} s, ${build.scenes.length} escenas, ${build.soundCues.length} sonidos`,
    `- Hoja de 20 fotogramas: \`${sheet}\``,
    `- Sonoridad: ${loud.integrated} LUFS integrados, LRA ${loud.range} LU, pico ${loud.truePeak} dBTP`,
    delivered ? `- Entregado en: \`${delivered}\`` : '- Sin entregar (repite con `--deliver` cuando este aprobado)',
    '',
    '## Comprobaciones automaticas',
    '',
    ...checks.map((c) => `- ${mark(c.ok)} ${c.label}${c.detail ? ` — ${c.detail}` : ''}${!c.ok && c.fix ? ` → ${c.fix}` : ''}`),
    '',
    '## Revision visual (la hace el agente mirando la hoja, y luego el usuario)',
    '',
    '- [ ] Ninguna palabra clave tapa la cara ni se sale de la zona segura',
    '- [ ] Ningun texto va dentro de pastillas, cajas ni rectangulos redondeados',
    '- [ ] Cada b-roll corresponde a lo que se dice en ese momento',
    '- [ ] Las capturas con texto se leen enteras en `insert` (la esquina del sujeto no tapa el titular)',
    '- [ ] El titular sale una vez, cuando se nombra el producto',
    '- [ ] Escuchado entero: ningun golpe fuera de sitio, ningun sonido pisa otro, el riser acaba en el primer corte',
    '',
    '## Sonidos usados',
    '',
    ...Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([name, n]) => `- ${n} × ${name}`),
    '',
    '## Antes de dar por cerrado un cambio de codigo',
    '',
    '- [ ] `npm test`',
    '- [ ] `npm run intro:playbook:check`',
    ''
  ].join('\n');
}

export async function statusStage({slug}) {
  const state = await loadState(slug);
  if (!state) return {ok: false, checks: [check(false, 'proyecto', 'no empezado', 'npm run intro:viral -- start --source <carpeta> --clips 1,2,3 --slug ' + slug)]};
  const checks = GATES.map((gate) => {
    const g = state.gates?.[gate];
    return check(g?.ok, gate, g ? `${g.ok ? 'superada' : 'bloqueada'} ${g.at}${g.failed?.length ? ' — ' + g.failed.join('; ') : ''}` : 'pendiente');
  });
  const pending = GATES.find((gate) => !state.gates?.[gate]?.ok);
  return {ok: !pending, checks, next: pending ? npmCmd(pending, slug) : null};
}

// ---------------------------------------------------------------------------
// Versiones: la misma escaleta con distintos estilos de texto y colores
// ---------------------------------------------------------------------------

/** Plantilla de `variantes.json`: una linea por version, sin codigo. */
export function variantsTemplate() {
  return {
    version: 1,
    note: 'Cada version es la misma escaleta con otro estilo de texto (src/modules/intro-studio/text-styles.json) y otro color de acento. id en minusculas con guiones.',
    variants: [
      {id: 'a-v3', textStyle: 'v3-fraunces', accentColor: '#D97757', note: 'control: la v3 aprobada'},
      {id: 'b-serif', textStyle: 'serif-editorial', accentColor: '#D97757'},
      {id: 'c-bricolage', textStyle: 'bricolage-mascara', accentColor: '#43F56C'},
      {id: 'd-anton', textStyle: 'anton-impacto', accentColor: '#FFD60A'},
      {id: 'e-sobrio', textStyle: 'fraunces-sobrio', accentColor: '#7CC4FF'},
      {id: 'f-mixto', textStyle: 'mixto-serif-anton', accentColor: '#FF5A36'}
    ]
  };
}

/** Momentos que mejor comparan estilos de texto: palabras clave, titular y cifras. */
export function comparisonMoments(build, count = 6) {
  const fps = build.format.fps;
  const picked = [];
  const add = (scene, cue, label) => {
    if (!scene || picked.some((p) => p.id === scene.id)) return;
    picked.push({id: scene.id, seconds: (scene.from + Math.min(cue.fromFrame + 50, scene.durationInFrames - 6)) / fps, label});
  };
  const withCue = (test) => build.scenes.map((scene) => ({scene, cue: scene.cues.find(test)})).filter((x) => x.cue);
  const keywords = withCue((c) => c.type === 'keyword');
  const hero = keywords.find((x) => x.scene.layout === 'hero');
  if (hero) add(hero.scene, hero.cue, 'palabra clave');
  const insert = keywords.find((x) => x.scene.layout === 'insert');
  if (insert) add(insert.scene, insert.cue, 'b-roll + palabra');
  for (const x of withCue((c) => c.type === 'stat').slice(0, 2)) add(x.scene, x.cue, 'cifra');
  const money = keywords.find((x) => x.cue.soundUse === 'money' && !picked.some((p) => p.id === x.scene.id));
  if (money) add(money.scene, money.cue, 'dinero');
  if (build.titleCard) picked.push({id: 'titular', seconds: (build.titleCard.fromFrame + 70) / fps, label: 'titular'});
  for (const x of keywords.slice(1)) if (picked.length < count) add(x.scene, x.cue, 'palabra clave');
  return picked.slice(0, count).sort((a, b) => a.seconds - b.seconds);
}

async function copyProjectShell(fromSlug, toSlug) {
  const from = projectDir(fromSlug);
  const to = projectDir(toSlug);
  await mkdir(path.join(to, 'transcripts'), {recursive: true});
  for (const file of ['manifest.json', 'music.json']) {
    if (existsSync(path.join(from, file))) await copyFile(path.join(from, file), path.join(to, file));
  }
  for (const file of await readdir(path.join(from, 'transcripts'))) {
    await copyFile(path.join(from, 'transcripts', file), path.join(to, 'transcripts', file));
  }
}

/**
 * Compila (y con `render`, renderiza) una version por linea de `variantes.json`. Cada
 * version es un proyecto `intro-<slug>-<id>` que comparte la media del proyecto base
 * (su manifest apunta a ella): no se copia video. Termina con una hoja comparativa
 * (una fila por version, los mismos momentos en columnas) y `VARIANTES.md`.
 */
export async function variantsStage({slug, render = false, only = null, log = console.log}) {
  const paths = workspacePaths(slug);
  const file = path.join(paths.dir, 'variantes.json');
  if (!existsSync(file)) await writeJson(file, variantsTemplate());
  const spec = await readJson(file);
  const escaleta = await readJson(paths.escaleta).catch(() => null);
  if (!escaleta) return {ok: false, checks: [check(false, 'escaleta.json', 'no existe', `Ejecuta antes ${npmCmd('start', slug)} y rellena la escaleta`)]};
  const {manifest, transcripts, project} = await loadProject(slug);
  const tables = loadDecisionTables();
  const music = await readJson(path.join(project, 'music.json')).catch(() => null);
  const beats = music?.beatSeconds ?? manifest.music?.beatSeconds ?? [];
  const checks = [];
  const results = [];
  for (const variant of spec.variants.filter((v) => !only || only.includes(v.id))) {
    if (!/^[a-z0-9-]+$/.test(variant.id ?? '')) {
      checks.push(check(false, `version ${variant.id}`, 'id en minusculas, numeros y guiones'));
      continue;
    }
    const vslug = `${slug}-${variant.id}`;
    const escaletaV = {...escaleta, textStyle: variant.textStyle, accentColor: variant.accentColor ?? escaleta.accentColor};
    const {errors} = validateEscaleta(escaletaV, {manifest, transcripts, tables});
    if (errors.length) {
      checks.push(check(false, `version ${variant.id}`, errors.join(' | ')));
      continue;
    }
    await copyProjectShell(slug, vslug);
    const {plan} = compileEscaleta(escaletaV, {manifest, transcripts, beats, tables});
    await writeJson(path.join(projectDir(vslug), 'intro-plan.json'),
      {...plan, note: `${plan.note} Version ${variant.id}: ${variant.textStyle}, acento ${escaletaV.accentColor}.`});
    try {
      const build = await buildIntro({slug: vslug, log: () => {}});
      const {summary, issues} = build.rules;
      checks.push(check(summary.failed === 0 && !issues.length, `version ${variant.id} (${variant.textStyle}, ${escaletaV.accentColor})`,
        `${summary.passed}/${summary.total} reglas, ${issues.length} avisos`));
      results.push({...variant, accentColor: escaletaV.accentColor, slug: vslug, build});
    } catch (error) {
      checks.push(check(false, `version ${variant.id}`, error.message));
    }
  }
  for (const result of results) {
    if (render) {
      log(`Render ${result.slug}…`);
      const run = spawnSync(process.execPath, [path.join('scripts', 'intro-render.js'), '--slug', result.slug], {stdio: 'inherit'});
      result.mp4 = run.status === 0 ? await latestRender(result.slug) : null;
      checks.push(check(result.mp4, `render ${result.id}`, result.mp4 ?? `salida ${run.status}`));
    } else {
      result.mp4 = await latestRender(result.slug);
    }
  }
  const rendered = results.filter((result) => result.mp4);
  let sheet = null;
  if (rendered.length) {
    const moments = comparisonMoments(rendered[0].build);
    await mkdir(paths.review, {recursive: true});
    sheet = path.join(paths.review, 'variantes.jpg');
    await frameSheet({
      output: sheet,
      columns: moments.length,
      cellWidth: 480,
      frames: rendered.flatMap((result) => moments.map((m) => ({file: result.mp4, seconds: m.seconds, label: `${result.id} · ${m.label}`})))
    });
  }
  const md = [
    `# Versiones de ${slug}`,
    '',
    'La misma escaleta con distintos estilos de texto. Vota por version o por rasgo (fuente, revelado, cifra, color):',
    'lo que elijas pasa a `text-styles.json` como estilo por defecto, no a codigo.',
    '',
    sheet ? `Hoja comparativa: \`${sheet}\` (una fila por version).` : 'Sin renders todavia: repite con `--render`.',
    '',
    '| Version | Estilo | Acento | MP4 |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.textStyle} | ${r.accentColor} | ${r.mp4 ? `\`${r.mp4}\`` : '-'} |`),
    ''
  ].join('\n');
  await writeFile(path.join(paths.dir, 'VARIANTES.md'), md);
  return {
    ok: checks.every((c) => c.ok),
    checks,
    sheet,
    review: path.join(paths.dir, 'VARIANTES.md'),
    next: render ? null : `${npmCmd('variants', slug)} --render`
  };
}
