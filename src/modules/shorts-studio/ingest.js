import path from 'node:path';
import {copyFile, readdir, rm, stat} from 'node:fs/promises';
import {extractAudio, ffprobe} from '../../lib/ffmpeg.js';
import {transcribeAudio} from '../../lib/stt.js';
import {ensureDir, readJson, round, run, TMP_DIR, writeJson} from '../../lib/utils.js';
import {
  IMAGE_EXTENSIONS,
  SHORT_FORMAT,
  VIDEO_EXTENSIONS,
  mediaDir,
  naturalCompare,
  projectDir,
  slugify,
  staticPath
} from './constants.js';
import {DEFAULT_FOCUS, trackFace} from './face-tracking.js';

/**
 * Ingesta de un proyecto de short "desde cero".
 *
 * Entrada: una carpeta con clips grabados y (opcionalmente) una subcarpeta de
 * assets con imagenes. Salida:
 *   - `remotion-animations/public/projects/shorts/<slug>/clips|assets`: media
 *     remuxeada a MP4 para que Chrome la decodifique en el render.
 *   - `remotion-animations/projects/shorts-<slug>/manifest.json`: inventario con
 *     duraciones, fps, punto focal de la cara y rutas staticFile().
 *   - `remotion-animations/projects/shorts-<slug>/transcripts/NN.json`: palabras
 *     con tiempos, que son la fuente de verdad temporal del montaje.
 */
export async function ingestShortProject({
  sourceDir,
  slug,
  assetsDir = null,
  transcribe = true,
  reuseTranscripts = true,
  faceTracking = true,
  force = false,
  signal = null,
  log = () => {}
}) {
  const projectSlug = slugify(slug || path.basename(sourceDir));
  if (!projectSlug) throw new Error('No se pudo derivar un slug del proyecto.');

  const sourceEntries = await readdir(sourceDir, {withFileTypes: true});
  const clipFiles = sourceEntries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(naturalCompare);
  if (!clipFiles.length) throw new Error(`No hay clips de video en ${sourceDir}`);

  const resolvedAssetsDir = assetsDir ?? (await findAssetsDir(sourceDir, sourceEntries));
  const assetFiles = resolvedAssetsDir
    ? (await readdir(resolvedAssetsDir, {withFileTypes: true}))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort(naturalCompare)
    : [];

  const media = mediaDir(projectSlug);
  const project = projectDir(projectSlug);
  if (force) await rm(media, {recursive: true, force: true});
  await ensureDir(path.join(media, 'clips'));
  await ensureDir(path.join(media, 'assets'));
  await ensureDir(path.join(project, 'transcripts'));

  const clips = [];
  for (let index = 0; index < clipFiles.length; index += 1) {
    signal?.throwIfAborted();
    const sourceFile = path.join(sourceDir, clipFiles[index]);
    const id = String(index + 1).padStart(2, '0');
    const targetFile = path.join(media, 'clips', `${id}.mp4`);
    log(`clip ${id}: ${clipFiles[index]}`);
    await toMp4(sourceFile, targetFile, {signal});
    const probe = await ffprobe(targetFile, {signal});

    let face = null;
    if (faceTracking) {
      try {
        face = await trackFace(targetFile, probe, {signal});
      } catch (error) {
        log(`  cara: sin deteccion (${error.message})`);
      }
    }

    let transcript = null;
    if (transcribe) {
      transcript = await transcribeClip({
        clipFile: targetFile,
        id,
        project,
        reuse: reuseTranscripts,
        signal,
        log
      });
    }

    clips.push({
      id,
      sourceName: clipFiles[index],
      file: staticPath(projectSlug, 'clips', `${id}.mp4`),
      durationSeconds: round(probe.duration, 3),
      width: probe.width,
      height: probe.height,
      fps: round(probe.fps, 3),
      focus: face?.focus ?? DEFAULT_FOCUS,
      faceBox: face?.box ?? null,
      faceConfidence: face?.confidence ?? 0,
      transcript: transcript ? `transcripts/${id}.json` : null,
      wordCount: transcript?.words.length ?? 0
    });
  }

  const assets = [];
  for (const name of assetFiles) {
    const rawExtension = path.extname(name);
    const extension = rawExtension.toLowerCase();
    // `path.basename(name, ext)` solo recorta si la extension coincide en
    // mayusculas/minusculas: con "costs.PNG" hay que pasarle la original.
    const id = slugify(path.basename(name, rawExtension));
    const targetName = `${id}${extension === '.jpeg' ? '.jpg' : extension}`;
    const targetFile = path.join(media, 'assets', targetName);
    await copyFile(path.join(resolvedAssetsDir, name), targetFile);
    const size = await stat(targetFile);
    assets.push({
      id,
      sourceName: name,
      file: staticPath(projectSlug, 'assets', targetName),
      bytes: size.size
    });
  }

  const manifest = {
    slug: projectSlug,
    format: SHORT_FORMAT,
    createdAt: new Date().toISOString(),
    source: {clipsDir: sourceDir, assetsDir: resolvedAssetsDir},
    totalClipSeconds: round(clips.reduce((total, clip) => total + clip.durationSeconds, 0), 3),
    clips,
    assets
  };
  await writeJson(path.join(project, 'manifest.json'), manifest);
  return manifest;
}

async function findAssetsDir(sourceDir, entries) {
  const match = entries.find((entry) => entry.isDirectory() && /^assets$/i.test(entry.name));
  return match ? path.join(sourceDir, match.name) : null;
}

/**
 * Chrome (y por tanto Remotion) no decodifica Matroska, asi que hay que pasar a
 * MP4. El video se copia sin recomprimir cuando ya es H.264; solo se recodifica
 * si el contenedor rechaza el stream tal cual.
 *
 * El audio si se procesa siempre: las grabaciones llegan con picos a 0 dBFS y con
 * niveles distintos entre clips, asi que se normaliza a -14 LUFS con techo en
 * -1.5 dBTP. Es el objetivo al que YouTube, TikTok e Instagram renormalizan, de
 * modo que dejarlo ahi evita que la plataforma vuelva a tocar la mezcla y da
 * margen para que los efectos sumen sin recortar.
 */
const LOUDNESS_FILTER = 'loudnorm=I=-14:TP=-1.5:LRA=11';

async function toMp4(sourceFile, targetFile, {signal} = {}) {
  const audio = ['-af', LOUDNESS_FILTER, '-c:a', 'aac', '-b:a', '192k'];
  const base = ['-y', '-i', sourceFile, '-movflags', '+faststart'];
  try {
    await run('ffmpeg', [...base, '-c:v', 'copy', ...audio, targetFile], {signal});
    return targetFile;
  } catch {
    await run('ffmpeg', [
      ...base,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      ...audio,
      targetFile
    ], {signal});
    return targetFile;
  }
}

async function transcribeClip({clipFile, id, project, reuse, signal, log}) {
  const transcriptFile = path.join(project, 'transcripts', `${id}.json`);
  if (reuse) {
    // Transcribir es lo mas caro de la ingesta. Si ya hay palabras con tiempos
    // para este clip, se reutilizan salvo que se pida --retranscribe.
    try {
      const existing = await readJson(transcriptFile);
      if (existing.words?.length) {
        log(`  transcripcion: ${existing.words.length} palabras (reutilizada)`);
        return existing;
      }
    } catch {
      // No hay transcripcion previa: se genera.
    }
  }
  const workspace = path.join(TMP_DIR, 'shorts-stt');
  await ensureDir(workspace);
  const audioFile = path.join(workspace, `${id}-${Date.now()}.wav`);
  try {
    await extractAudio(clipFile, audioFile, {signal});
    const segments = await transcribeAudio(audioFile, {signal});
    const words = flattenWords(segments);
    const transcript = {
      clipId: id,
      language: segments[0]?.language ?? null,
      segments,
      words
    };
    await writeJson(transcriptFile, transcript);
    log(`  transcripcion: ${words.length} palabras`);
    return transcript;
  } catch (error) {
    log(`  transcripcion fallida: ${error.message}`);
    return null;
  } finally {
    await rm(audioFile, {force: true});
  }
}

/**
 * Indice plano de palabras con tiempos absolutos dentro del clip. Es la unica
 * fuente de verdad para subtitulos karaoke y para anclar cues de imagen/sonido.
 */
export function flattenWords(segments) {
  const words = [];
  for (const segment of segments ?? []) {
    const segmentWords = segment.words?.length
      ? segment.words
      : approximateWords(segment);
    for (const word of segmentWords) {
      const text = String(word.word ?? word.text ?? '').trim();
      if (!text) continue;
      words.push({
        index: words.length,
        text,
        start: round(Number(word.start ?? segment.start ?? 0), 3),
        end: round(Number(word.end ?? segment.end ?? 0), 3),
        confidence: word.probability === undefined ? null : round(Number(word.probability), 3),
        timing: segment.words?.length ? 'word' : 'approximate'
      });
    }
  }
  return words;
}

function approximateWords(segment) {
  const tokens = String(segment.text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const start = Number(segment.start ?? 0);
  const end = Number(segment.end ?? start);
  const step = (end - start) / tokens.length;
  return tokens.map((text, index) => ({
    word: text,
    start: start + step * index,
    end: start + step * (index + 1)
  }));
}
