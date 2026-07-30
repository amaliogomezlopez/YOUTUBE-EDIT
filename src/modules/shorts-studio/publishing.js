import path from 'node:path';
import {captionsToText} from '../../lib/transcript.js';
import {
  buildClipPublishing,
  generatePublishingMetadata,
  postForPlatform
} from '../../lib/publishing.js';
import {ensureDir, readJson, round, writeJson} from '../../lib/utils.js';
import {projectDir} from './constants.js';

export const PLATFORMS = ['youtube', 'youtube_shorts', 'instagram', 'tiktok', 'x'];

/** Corte de pagina de la transcripcion montada: una pausa larga abre caption nueva. */
const CAPTION_PAUSE_SECONDS = 0.6;
const CAPTION_MAX_WORDS = 14;

/**
 * Transcripcion del short **montado**, no de los clips crudos.
 *
 * Cada escena aporta solo las palabras que caen dentro de su recorte, rebasadas al
 * tiempo global del short. Sin esto la metadata describe audio que se recorto: en
 * `harness-vs-modelo` sobran casi 6 s de silencio y el clip 02 esta partido en dos
 * escenas, asi que los tiempos crudos no coinciden con nada de lo que se oye.
 *
 * Se agrupa por palabra y no por segmento a proposito: un segmento que cruza el
 * limite entre dos escenas del mismo clip aparecería duplicado en las dos.
 */
export function assembleShortCaptions(build, wordsByClip) {
  const {fps} = build.format;
  const captions = [];
  for (const scene of build.scenes) {
    const words = wordsByClip.get(scene.clipId) ?? [];
    const offset = scene.from / fps - scene.trimStartSeconds;
    let current = null;
    for (const word of words) {
      if (word.start < scene.trimStartSeconds || word.start >= scene.trimEndSeconds) continue;
      const start = round(word.start + offset, 3);
      const end = round(Math.min(word.end, scene.trimEndSeconds) + offset, 3);
      const text = String(word.text ?? '').trim();
      if (!text) continue;
      const broken = !current ||
        start - current.end > CAPTION_PAUSE_SECONDS ||
        current.words >= CAPTION_MAX_WORDS;
      if (broken) {
        current = {start, end, text, words: 1};
        captions.push(current);
        continue;
      }
      current.end = end;
      current.text = `${current.text} ${text}`;
      current.words += 1;
    }
  }
  return captions.map(({start, end, text}) => ({start, end, text}));
}

/** Transcripcion montada de un proyecto ya compilado. */
export async function loadShortCaptions(slug) {
  const project = projectDir(slug);
  const build = await readJson(path.join(project, 'short-build.json'));
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const wordsByClip = new Map();
  for (const clip of manifest.clips) {
    if (!clip.transcript) continue;
    const transcript = await readJson(path.join(project, clip.transcript));
    wordsByClip.set(clip.id, transcript.words ?? []);
  }
  return {build, captions: assembleShortCaptions(build, wordsByClip)};
}

/**
 * Hook del short: lo que se oye en la primera escena. Es la frase que decide si
 * alguien sigue viendo, y la que mejor funciona como primera linea del caption.
 */
function hookFrom(build, captions) {
  const firstSceneEnd = build.scenes[0].durationInFrames / build.format.fps;
  const hook = captions.filter((caption) => caption.start < firstSceneEnd);
  return captionsToText(hook.length ? hook : captions.slice(0, 1));
}

/**
 * El contrato pide 10 titulos por plataforma. `buildClipPublishing` aporta hasta
 * cinco variantes derivadas del texto, asi que las restantes quedan marcadas como
 * pendientes en vez de rellenarse con relleno que pareceria una propuesta real.
 */
function localTitles(variants) {
  const entries = variants.map((title, index) => ({
    title,
    reason: 'Derivado del texto del short sin LLM; revisar antes de publicar.',
    score: 70 - index * 2
  }));
  while (entries.length < 10) {
    entries.push({
      title: `Pendiente ${entries.length + 1}: configurar LLM para 10 propuestas`,
      reason: 'Sin LLM solo hay variantes locales; no se inventan titulos.',
      score: 0
    });
  }
  return Object.fromEntries(PLATFORMS.map((platform) => [platform, entries]));
}

/**
 * Metadata de publicacion del short montado, ya resuelta pero sin escribir.
 *
 * Reutiliza `generatePublishingMetadata` (resumen, 10 titulos por plataforma, 14
 * hashtags y capitulos) y `buildClipPublishing` (posts por plataforma con hook
 * real en vez del titulo generico del fallback). Sin LLM configurado el modulo
 * base ya devuelve fallback local con warning; aqui solo se propaga.
 */
export async function composeShortPublishing({slug, build, plan, captions, useLlm = true}) {
  const metadata = await generatePublishingMetadata(captions, {useLlm});
  const transcript = captionsToText(captions);
  const clip = {
    publishing: buildClipPublishing(
      {
        text: transcript,
        hook: hookFrom(build, captions),
        suggestedTitle: plan.title ?? metadata.titles.youtube_shorts?.[0]?.title,
        rank: 1
      },
      {hashtags: metadata.hashtags}
    )
  };

  // Sin LLM el fallback base devuelve «Idea de titulo N» y la lista de hashtags
  // generica, mientras que `buildClipPublishing` ya sabe derivar titulos y
  // hashtags del texto real. Se usa esa via y se reconstruye la descripcion de
  // YouTube para que no queden dos juegos de hashtags distintos en el mismo JSON.
  const llmUsed = metadata.llmUsed === true;
  const hashtags = llmUsed ? metadata.hashtags : clip.publishing.hashtags;
  const titles = llmUsed ? metadata.titles : localTitles(clip.publishing.titleVariants);
  const youtubeDescription = llmUsed
    ? metadata.summary.youtube_description
    : `${metadata.summary.medium}\n\nCapitulos:\n${metadata.timestamps.join('\n')}\n\n${hashtags}`;

  const platformPosts = Object.fromEntries(
    PLATFORMS.map((platform) => [platform, postForPlatform(metadata, clip, platform)])
  );
  platformPosts.youtube = {
    ...platformPosts.youtube,
    title: titles.youtube[0].title,
    description: youtubeDescription,
    tags: hashtags.split(' ').map((tag) => tag.slice(1))
  };

  return {
    slug,
    generatedAt: new Date().toISOString(),
    title: plan.title ?? null,
    durationSeconds: build.durationSeconds,
    llmUsed,
    ...(metadata.warning ? {warning: metadata.warning} : {}),
    summary: {...metadata.summary, youtube_description: youtubeDescription},
    titles,
    hashtags,
    timestamps: metadata.timestamps,
    platform_posts: platformPosts,
    editorial: clip.publishing.editorial,
    schedule: clip.publishing.schedule
  };
}

/** Resuelve el proyecto en disco, compone la metadata y la escribe. */
export async function buildShortPublishing({slug, useLlm = true, outputDir = null, log = () => {}}) {
  const project = projectDir(slug);
  const plan = await readJson(path.join(project, 'short-plan.json'));
  const {build, captions} = await loadShortCaptions(slug);
  if (!captions.length) {
    throw new Error(
      `El short "${slug}" no tiene transcripcion montada: sin palabras no hay ` +
      'resumen, titulos ni capitulos que no sean inventados.'
    );
  }

  const payload = await composeShortPublishing({slug, build, plan, captions, useLlm});

  const files = [path.join(project, 'publishing-metadata.json')];
  if (outputDir) {
    await ensureDir(outputDir);
    files.push(path.join(outputDir, 'publishing-metadata.json'));
  }
  for (const file of files) await writeJson(file, payload);

  log(
    `publishing: ${captions.length} captions montadas, ` +
    `${payload.hashtags.split(' ').length} hashtags, ` +
    `${payload.timestamps.length} capitulos, LLM=${payload.llmUsed ? 'si' : 'no'}`
  );
  if (payload.warning) log(`  aviso: ${payload.warning}`);
  return {payload, files, captions};
}
