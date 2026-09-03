import path from 'node:path';
import {copyFile, readdir, rm, stat} from 'node:fs/promises';
import {extractAudio, ffprobe} from '../../lib/ffmpeg.js';
import {transcribeAudio} from '../../lib/stt.js';
import {ensureDir, readJson, round, run, TMP_DIR, writeJson} from '../../lib/utils.js';
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  naturalCompare,
  slugify,
  surfacePaths
} from './paths.js';
import {DEFAULT_FOCUS, trackFace} from './face-tracking.js';
import {analyzeMusicTrack} from './music.js';

/**
 * Ingesta de un proyecto de montaje "desde cero": una carpeta con clips grabados a
 * proposito, mas imagenes, videos de apoyo y (opcionalmente) una pista de musica.
 *
 * Es comun a las superficies porque el trabajo sucio no depende del formato: Chrome
 * no decodifica Matroska en ninguno, el audio de las grabaciones llega con picos a
 * 0 dBFS en ambos, y la cara y las palabras se detectan igual. Lo que cambia es el
 * reparto de carpetas y el formato de salida, y los dos entran por parametro.
 *
 * Salida:
 *   - `public/projects/<surface>/<slug>/clips|assets`: media remuxeada a MP4.
 *   - `projects/<surface>-<slug>/manifest.json`: inventario con duraciones, fps,
 *     punto focal de la cara y rutas staticFile().
 *   - `projects/<surface>-<slug>/transcripts/NN.json`: palabras con tiempos, la
 *     fuente de verdad temporal del montaje.
 *   - `projects/<surface>-<slug>/music.json`: rejilla de beats, si hay pista.
 */
export async function ingestMediaProject({
  surface,
  format,
  sourceDir,
  slug,
  assetsDir = null,
  musicFile = null,
  transcribe = true,
  reuseTranscripts = true,
  faceTracking = true,
  force = false,
  signal = null,
  log = () => {}
}) {
  const paths = surfacePaths(surface);
  const projectSlug = slugify(slug || path.basename(sourceDir));
  if (!projectSlug) throw new Error('No se pudo derivar un slug del proyecto.');

  const sourceEntries = await readdir(sourceDir, {withFileTypes: true});
  const clipFiles = sourceEntries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(naturalCompare);
  if (!clipFiles.length) throw new Error(`No hay clips de video en ${sourceDir}`);

  const resolvedAssetsDir = assetsDir ?? (await findAssetsDir(sourceDir, sourceEntries));
  // Una intro se apoya en b-roll y en overlays de video (destellos, grano), no solo
  // en imagenes, asi que la carpeta de assets admite las dos cosas y el manifest
  // declara de que tipo es cada una.
  const assetFiles = resolvedAssetsDir
    ? (await readdir(resolvedAssetsDir, {withFileTypes: true}))
      .filter((entry) => {
        if (!entry.isFile()) return false;
        const extension = path.extname(entry.name).toLowerCase();
        return IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
      })
      .map((entry) => entry.name)
      .sort(naturalCompare)
    : [];

  const media = paths.mediaDir(projectSlug);
  const project = paths.projectDir(projectSlug);
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
      file: paths.staticPath(projectSlug, 'clips', `${id}.mp4`),
      durationSeconds: round(probe.duration, 3),
      width: probe.width,
      height: probe.height,
      fps: round(probe.fps, 3),
      focus: face?.focus ?? DEFAULT_FOCUS,
      focusTrack: face?.track ?? null,
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
    const isVideo = VIDEO_EXTENSIONS.has(extension);
    const targetName = isVideo ? `${id}.mp4` : `${id}${extension === '.jpeg' ? '.jpg' : extension}`;
    const targetFile = path.join(media, 'assets', targetName);
    if (isVideo) {
      // Mismo motivo que con los clips: Chrome no decodifica Matroska. Un asset de
      // video no lleva locucion, asi que no se normaliza su audio.
      await toMp4(path.join(resolvedAssetsDir, name), targetFile, {signal, normalizeAudio: false});
    } else {
      await copyFile(path.join(resolvedAssetsDir, name), targetFile);
    }
    const size = await stat(targetFile);
    const probe = isVideo ? await ffprobe(targetFile, {signal}) : null;
    assets.push({
      id,
      kind: isVideo ? 'video' : 'image',
      sourceName: name,
      file: paths.staticPath(projectSlug, 'assets', targetName),
      bytes: size.size,
      ...(probe ? {durationSeconds: round(probe.duration, 3), width: probe.width, height: probe.height} : {})
    });
  }

  const music = musicFile
    ? await ingestMusic({musicFile, media, project, paths, projectSlug, reuse: reuseTranscripts, signal, log})
    : null;

  const manifest = {
    slug: projectSlug,
    surface,
    format,
    createdAt: new Date().toISOString(),
    source: {clipsDir: sourceDir, assetsDir: resolvedAssetsDir, musicFile},
    totalClipSeconds: round(clips.reduce((total, clip) => total + clip.durationSeconds, 0), 3),
    clips,
    assets,
    ...(music ? {music} : {})
  };
  await writeJson(path.join(project, 'manifest.json'), manifest);
  return manifest;
}

async function findAssetsDir(sourceDir, entries) {
  const match = entries.find((entry) => entry.isDirectory() && /^assets$/i.test(entry.name));
  return match ? path.join(sourceDir, match.name) : null;
}

/**
 * Pista de musica: se copia a la media del proyecto y se analiza su rejilla de
 * beats. El analisis se cachea en `music.json` igual que las transcripciones,
 * porque es determinista y no hace falta repetirlo en cada ingesta.
 */
async function ingestMusic({musicFile, media, project, paths, projectSlug, reuse, signal, log}) {
  const extension = path.extname(musicFile).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw new Error(`La pista de musica "${musicFile}" no tiene extension de audio conocida.`);
  }
  const targetName = `music${extension}`;
  const targetFile = path.join(media, 'assets', targetName);
  await copyFile(musicFile, targetFile);
  const staticFile = paths.staticPath(projectSlug, 'assets', targetName);
  const analysisFile = path.join(project, 'music.json');

  if (reuse) {
    const existing = await readJson(analysisFile).catch(() => null);
    if (existing?.beatSeconds?.length && existing.sourceName === path.basename(musicFile)) {
      log(`musica: ${existing.bpm} BPM (reutilizada)`);
      return {...existing, file: staticFile};
    }
  }

  const analysis = await analyzeMusicTrack(targetFile, {signal});
  const music = {
    sourceName: path.basename(musicFile),
    file: staticFile,
    ...analysis
  };
  await writeJson(analysisFile, music);
  log(`musica: ${analysis.bpm} BPM, ${analysis.beatSeconds.length} beats (confianza ${analysis.confidence})`);
  return music;
}

/**
 * Chrome (y por tanto Remotion) no decodifica Matroska, asi que hay que pasar a
 * MP4. El video se copia sin recomprimir cuando ya es H.264; solo se recodifica
 * si el contenedor rechaza el stream tal cual.
 *
 * El audio si se procesa siempre en los clips: las grabaciones llegan con picos a
 * 0 dBFS y con niveles distintos entre clips, asi que se normaliza a -14 LUFS con
 * techo en -1.5 dBTP. Es el objetivo al que YouTube, TikTok e Instagram
 * renormalizan, de modo que dejarlo ahi evita que la plataforma vuelva a tocar la
 * mezcla y da margen para que los efectos sumen sin recortar.
 */
const LOUDNESS_FILTER = 'loudnorm=I=-14:TP=-1.5:LRA=11';

async function toMp4(sourceFile, targetFile, {signal, normalizeAudio = true} = {}) {
  const audio = normalizeAudio
    ? ['-af', LOUDNESS_FILTER, '-c:a', 'aac', '-b:a', '192k']
    : ['-c:a', 'aac', '-b:a', '128k'];
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
  const workspace = path.join(TMP_DIR, 'video-studio-stt');
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
